from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import (
    Order, OrderCreate, OrderItemAdd,
    ProductInstance, ProductStatus, Movement
)
from routes.auth import verify_token
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("")
async def get_orders(payload: dict = Depends(verify_token)):
    docs = await db.orders.find({}, {"_id": 0}).to_list(1000)

    # Enrich with supplier info and item counts
    supplier_ids = list(set(d.get("supplier_id") for d in docs if d.get("supplier_id")))
    suppliers_map = {}
    if supplier_ids:
        suppliers = await db.suppliers.find({"id": {"$in": supplier_ids}}, {"_id": 0}).to_list(1000)
        suppliers_map = {s["id"]: s for s in suppliers}

    for doc in docs:
        doc["supplier"] = suppliers_map.get(doc.get("supplier_id"), {})
        # Count items (instances linked to this order)
        total = await db.product_instances.count_documents({"order_id": doc["id"]})
        received = await db.product_instances.count_documents({
            "order_id": doc["id"],
            "status": {"$gte": ProductStatus.RECEIVED}
        })
        doc["total_items"] = total
        doc["received_items"] = received

    return docs


@router.get("/{order_id}")
async def get_order(order_id: str, payload: dict = Depends(verify_token)):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Commande non trouvée")

    # Enrich with supplier
    if doc.get("supplier_id"):
        doc["supplier"] = await db.suppliers.find_one({"id": doc["supplier_id"]}, {"_id": 0}) or {}

    # Get all instances for this order
    instances = await db.product_instances.find({"order_id": order_id}, {"_id": 0}).to_list(5000)

    # Enrich instances with product info
    product_ids = list(set(i.get("product_id") for i in instances if i.get("product_id")))
    products_map = {}
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
        products_map = {p["id"]: p for p in products}

    for inst in instances:
        inst["product"] = products_map.get(inst.get("product_id"), {})

    doc["items"] = instances
    return doc


@router.post("")
async def create_order(data: OrderCreate, payload: dict = Depends(verify_token)):
    """Create a new order with product instances in ORDERED status"""
    # Validate supplier
    supplier = await db.suppliers.find_one({"id": data.supplier_id})
    if not supplier:
        raise HTTPException(status_code=400, detail="Fournisseur non trouvé")

    # Validate all products belong to this supplier
    for item in data.items:
        product = await db.products.find_one({"id": item["product_id"]})
        if not product:
            raise HTTPException(status_code=400, detail=f"Produit {item['product_id']} non trouvé")
        if product.get("supplier_id") != data.supplier_id:
            raise HTTPException(
                status_code=400,
                detail=f"Le produit '{product.get('description')}' n'appartient pas à ce fournisseur"
            )

    order = Order(supplier_id=data.supplier_id, grm_number=data.grm_number)
    order_doc = order.model_dump()
    order_doc["creation_date"] = order_doc["creation_date"].isoformat()
    order_doc["created_at"] = order_doc["created_at"].isoformat()
    await db.orders.insert_one(order_doc)

    # Create ProductInstances with status ORDERED (no serial/lot/expiry yet)
    instances_created = 0
    for item in data.items:
        quantity = item.get("quantity", 1)
        for _ in range(quantity):
            instance = ProductInstance(
                product_id=item["product_id"],
                status=ProductStatus.ORDERED,
                order_id=order.id,
            )
            inst_doc = instance.model_dump()
            inst_doc["created_at"] = inst_doc["created_at"].isoformat()
            await db.product_instances.insert_one(inst_doc)
            instances_created += 1

            # Record movement
            mv = Movement(
                instance_id=instance.id,
                product_id=item["product_id"],
                type="commande",
                user_id=payload.get("id"),
                reason="Produit commandé",
            )
            mv_doc = mv.model_dump()
            mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
            await db.movements.insert_one(mv_doc)

    order_doc.pop("_id", None)
    order_doc["total_items"] = instances_created
    order_doc["received_items"] = 0
    return order_doc


@router.put("/{order_id}/send")
async def send_order(order_id: str, data: dict = None, payload: dict = Depends(verify_token)):
    """Send order — sets order_date, locks modifications"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    if order.get("order_date"):
        raise HTTPException(status_code=400, detail="Commande déjà envoyée")

    update = {
        "order_date": datetime.now(timezone.utc).isoformat(),
        "status": "sent"
    }
    if data and data.get("grm_number"):
        update["grm_number"] = data["grm_number"]

    await db.orders.update_one({"id": order_id}, {"$set": update})
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated


@router.put("/{order_id}/receive")
async def receive_order_items(order_id: str, data: dict, payload: dict = Depends(verify_token)):
    """
    Receive items from an order. Assigns serial/lot/expiry to ORDERED instances.
    data.items = [{instance_id, serial_number, lot_number?, expiration_date?}]
    """
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")

    items = data.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Aucun article à réceptionner")

    # Check for duplicate serial numbers within the batch
    serials_in_batch = [item.get("serial_number", "").strip() for item in items if item.get("serial_number", "").strip()]
    seen = set()
    for s in serials_in_batch:
        if s in seen:
            raise HTTPException(status_code=400, detail=f"Numéro de série '{s}' en double dans cette réception")
        seen.add(s)

    received_count = 0
    for item in items:
        instance_id = item.get("instance_id")
        if not instance_id:
            continue

        instance = await db.product_instances.find_one({"id": instance_id, "order_id": order_id})
        if not instance:
            continue
        if instance.get("status") != ProductStatus.ORDERED:
            continue

        # Validate serial number
        serial = item.get("serial_number", "").strip()
        if not serial:
            raise HTTPException(status_code=400, detail="Le numéro de série est requis")

        # Validate expiration date
        if not item.get("expiration_date"):
            raise HTTPException(status_code=400, detail=f"La date d'expiration est requise pour le N° série '{serial}'")

        # Validate serial number uniqueness in DB
        existing = await db.product_instances.find_one({
            "serial_number": serial,
            "id": {"$ne": instance_id}
        })
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Numéro de série '{serial}' déjà utilisé"
            )

        update_data = {
            "status": ProductStatus.RECEIVED,
            "reception_date": datetime.now(timezone.utc).isoformat(),
        }
        if serial:
            update_data["serial_number"] = serial
        if item.get("lot_number"):
            update_data["lot_number"] = item["lot_number"]
        if item.get("expiration_date"):
            update_data["expiration_date"] = item["expiration_date"]

        await db.product_instances.update_one({"id": instance_id}, {"$set": update_data})

        # Record movement
        movement = Movement(
            instance_id=instance_id,
            product_id=instance.get("product_id"),
            type="reception",
            user_id=payload.get("id"),
            reason="Réception de commande",
            order_id=order_id,
        )
        mv_doc = movement.model_dump()
        mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
        await db.movements.insert_one(mv_doc)

        received_count += 1

    # Update order status
    total = await db.product_instances.count_documents({"order_id": order_id})
    received_total = await db.product_instances.count_documents({
        "order_id": order_id,
        "status": {"$gte": ProductStatus.RECEIVED}
    })

    new_status = "partially_received" if received_total < total else "received"
    await db.orders.update_one({"id": order_id}, {"$set": {"status": new_status}})

    return {"received": received_count, "total": total, "received_total": received_total}


@router.post("/{order_id}/items")
async def add_order_item(order_id: str, data: OrderItemAdd, payload: dict = Depends(verify_token)):
    """Add more items to a draft order"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    if order.get("order_date"):
        raise HTTPException(status_code=400, detail="Impossible de modifier une commande envoyée")

    product = await db.products.find_one({"id": data.product_id})
    if not product:
        raise HTTPException(status_code=400, detail="Produit non trouvé")

    created = 0
    for _ in range(data.quantity):
        instance = ProductInstance(
            product_id=data.product_id,
            status=ProductStatus.ORDERED,
            order_id=order_id,
        )
        inst_doc = instance.model_dump()
        inst_doc["created_at"] = inst_doc["created_at"].isoformat()
        await db.product_instances.insert_one(inst_doc)
        created += 1

    return {"added": created}


@router.delete("/{order_id}")
async def cancel_order(order_id: str, payload: dict = Depends(verify_token)):
    """Cancel a draft order and delete its ORDERED instances"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    if order.get("order_date"):
        raise HTTPException(status_code=400, detail="Impossible d'annuler une commande envoyée")

    # Delete all ORDERED instances for this order
    deleted = await db.product_instances.delete_many({
        "order_id": order_id,
        "status": ProductStatus.ORDERED
    })

    await db.orders.update_one({"id": order_id}, {"$set": {"status": "cancelled"}})
    return {"cancelled": True, "instances_deleted": deleted.deleted_count}
