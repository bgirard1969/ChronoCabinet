from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import ProductInstance, ProductStatus, Movement, Order
from routes.auth import verify_token
from sio import emit_event
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from collections import defaultdict
import bcrypt
import uuid

router = APIRouter(prefix="/api/instances", tags=["instances"])


@router.get("")
async def get_instances(
    status: int = None,
    product_id: str = None,
    order_id: str = None,
    payload: dict = Depends(verify_token),
):
    query = {}
    if status is not None:
        query["status"] = status
    if product_id:
        query["product_id"] = product_id
    if order_id:
        query["order_id"] = order_id

    docs = await db.product_instances.find(query, {"_id": 0}).to_list(5000)

    # Enrich with product info
    product_ids = list(set(d.get("product_id") for d in docs if d.get("product_id")))
    products_map = {}
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
        products_map = {p["id"]: p for p in products}

    for doc in docs:
        doc["product"] = products_map.get(doc.get("product_id"), {})

    return docs


@router.get("/pending-placement")
async def get_pending_placement(payload: dict = Depends(verify_token)):
    """Get instances with RECEIVED status, ready for physical placement"""
    docs = await db.product_instances.find(
        {"status": ProductStatus.RECEIVED}, {"_id": 0}
    ).to_list(5000)

    product_ids = list(set(d.get("product_id") for d in docs if d.get("product_id")))
    products_map = {}
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
        products_map = {p["id"]: p for p in products}

    for doc in docs:
        doc["product"] = products_map.get(doc.get("product_id"), {})

    return docs


@router.get("/consumption")
async def get_consumption_list(payload: dict = Depends(verify_token)):
    """Get all instances with PICKED or CONSUMED status for consumption validation"""
    docs = await db.product_instances.find(
        {"status": {"$in": [ProductStatus.PICKED, ProductStatus.CONSUMED]}},
        {"_id": 0}
    ).sort("status", 1).to_list(5000)  # PICKED (4) first, then CONSUMED (5)

    # Batch-enrich with product, supplier, category info
    product_ids = list(set(d.get("product_id") for d in docs if d.get("product_id")))
    products_map = {}
    supplier_ids = set()
    category_ids = set()
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
        for p in products:
            products_map[p["id"]] = p
            if p.get("supplier_id"):
                supplier_ids.add(p["supplier_id"])
            if p.get("category_id"):
                category_ids.add(p["category_id"])

    suppliers_map = {}
    if supplier_ids:
        suppliers = await db.suppliers.find({"id": {"$in": list(supplier_ids)}}, {"_id": 0}).to_list(500)
        suppliers_map = {s["id"]: s for s in suppliers}

    categories_map = {}
    if category_ids:
        cats = await db.product_categories.find({"id": {"$in": list(category_ids)}}, {"_id": 0}).to_list(500)
        categories_map = {c["id"]: c for c in cats}

    for doc in docs:
        product = products_map.get(doc.get("product_id"), {})
        product["supplier"] = suppliers_map.get(product.get("supplier_id"), {})
        product["category"] = categories_map.get(product.get("category_id"), {})
        doc["product"] = product

    return docs


@router.put("/{instance_id}/consume")
async def consume_instance(instance_id: str, payload: dict = Depends(verify_token)):
    """Mark a PICKED instance as CONSUMED"""
    instance = await db.product_instances.find_one({"id": instance_id})
    if not instance:
        raise HTTPException(status_code=404, detail="Instance non trouvée")
    if instance.get("status") != ProductStatus.PICKED:
        raise HTTPException(status_code=400, detail="Seuls les produits prélevés peuvent être consommés")

    now = datetime.now(timezone.utc).isoformat()
    await db.product_instances.update_one(
        {"id": instance_id},
        {"$set": {"status": ProductStatus.CONSUMED, "usage_date": now}}
    )

    # Record movement
    movement = Movement(
        instance_id=instance_id,
        product_id=instance.get("product_id"),
        type="consommation",
        user_id=payload.get("id"),
        reason="Produit consommé",
    )
    mv_doc = movement.model_dump()
    mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
    await db.movements.insert_one(mv_doc)

    updated = await db.product_instances.find_one({"id": instance_id}, {"_id": 0})
    return updated


@router.post("/pick-libre")
async def pick_libre(data: dict, payload: dict = Depends(verify_token)):
    """
    Pick a PLACED instance directly (without intervention).
    data: {instance_id, patient_file}
    """
    instance_id = data.get("instance_id")
    patient_file = data.get("patient_file", "").strip()

    if not instance_id:
        raise HTTPException(status_code=400, detail="instance_id requis")

    instance = await db.product_instances.find_one({"id": instance_id})
    if not instance:
        raise HTTPException(status_code=404, detail="Instance non trouvée")
    if instance.get("status") != ProductStatus.PLACED:
        raise HTTPException(status_code=400, detail="Seuls les produits en stock peuvent être prélevés")

    now = datetime.now(timezone.utc).isoformat()

    # Free the cabinet location
    if instance.get("cabinet_location_id"):
        await db.cabinet_locations.update_one(
            {"id": instance["cabinet_location_id"]},
            {"$set": {"is_empty": True}}
        )

    # Update instance status
    await db.product_instances.update_one(
        {"id": instance_id},
        {"$set": {"status": ProductStatus.PICKED, "cabinet_location_id": None}}
    )

    # Record movement
    reason_parts = ["Prélèvement libre"]
    if patient_file:
        reason_parts.append(f"MRN: {patient_file}")

    movement = Movement(
        instance_id=instance_id,
        product_id=instance.get("product_id"),
        type="prelevement",
        user_id=payload.get("id"),
        reason=" — ".join(reason_parts),
    )
    mv_doc = movement.model_dump()
    mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
    if patient_file:
        mv_doc["patient_file"] = patient_file
    await db.movements.insert_one(mv_doc)

    return {"picked": True, "instance_id": instance_id}



@router.post("/export-grm")
async def export_grm(payload: dict = Depends(verify_token)):
    """
    Export consumed instances to GRM text format, create replacement orders per supplier,
    and transition instances from CONSUMED to INVOICED.
    """
    # 1. Fetch all CONSUMED instances
    consumed = await db.product_instances.find(
        {"status": ProductStatus.CONSUMED}, {"_id": 0}
    ).to_list(5000)

    if not consumed:
        raise HTTPException(status_code=400, detail="Aucun produit consommé à exporter")

    # 2. Enrich with product info
    product_ids = list(set(d.get("product_id") for d in consumed if d.get("product_id")))
    products_map = {}
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
        products_map = {p["id"]: p for p in products}

    # 3. Generate GRM lines
    now = datetime.now(timezone.utc)
    now_local = now.astimezone(ZoneInfo("America/Toronto"))
    timestamp_str = now_local.strftime("%m%d%y%H%M")  # MMDDYYHHMM in local time
    grm_lines = []

    for inst in consumed:
        product = products_map.get(inst.get("product_id"), {})
        grm_number = product.get("grm_number") or ""

        # usage_date → YYYYMMDD
        usage_raw = inst.get("usage_date")
        if usage_raw:
            if isinstance(usage_raw, str):
                try:
                    usage_dt = datetime.fromisoformat(usage_raw.replace("Z", "+00:00"))
                except Exception:
                    usage_dt = now
            else:
                usage_dt = usage_raw
            consumed_date = usage_dt.strftime("%Y%m%d")
        else:
            consumed_date = now.strftime("%Y%m%d")

        # serial_number (priority) or lot_number
        serial_or_lot = inst.get("serial_number") or inst.get("lot_number") or ""

        line = f"1|1.0|T008|RC|{consumed_date}|100171|675102||||DMI01K2153|{timestamp_str}|0|{grm_number}|1|||{serial_or_lot}||"
        grm_lines.append(line)

    grm_content = "\n".join(grm_lines)

    # 4. Group by supplier and create replacement orders
    supplier_products = defaultdict(lambda: defaultdict(int))
    for inst in consumed:
        product = products_map.get(inst.get("product_id"), {})
        supplier_id = product.get("supplier_id")
        if supplier_id and inst.get("product_id"):
            supplier_products[supplier_id][inst["product_id"]] += 1

    orders_created = []
    for supplier_id, product_counts in supplier_products.items():
        # Create order
        order_id = str(uuid.uuid4())
        order_now = datetime.now(timezone.utc).isoformat()
        order_doc = {
            "id": order_id,
            "supplier_id": supplier_id,
            "creation_date": order_now,
            "order_date": order_now,
            "grm_number": None,
            "status": "sent",
            "created_at": order_now,
        }
        await db.orders.insert_one(order_doc)

        # Create ORDERED instances for each product
        total_items = 0
        for product_id, qty in product_counts.items():
            for _ in range(qty):
                inst_id = str(uuid.uuid4())
                inst_doc = {
                    "id": inst_id,
                    "product_id": product_id,
                    "status": ProductStatus.ORDERED,
                    "order_id": order_id,
                    "created_at": order_now,
                }
                await db.product_instances.insert_one(inst_doc)
                total_items += 1

                # Record movement
                mv = Movement(
                    instance_id=inst_id,
                    product_id=product_id,
                    type="commande",
                    user_id=payload.get("id"),
                    reason="Commande de remplacement (GRM)",
                )
                mv_doc2 = mv.model_dump()
                mv_doc2["timestamp"] = mv_doc2["timestamp"].isoformat()
                await db.movements.insert_one(mv_doc2)
        supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
        order_doc.pop("_id", None)
        orders_created.append({
            "order_id": order_id,
            "supplier_name": supplier.get("name", "?") if supplier else "?",
            "total_items": total_items,
        })

    # 5. Transition CONSUMED → INVOICED + record movements
    invoiced_count = 0
    for inst in consumed:
        await db.product_instances.update_one(
            {"id": inst["id"]},
            {"$set": {"status": ProductStatus.INVOICED}}
        )
        movement = Movement(
            instance_id=inst["id"],
            product_id=inst.get("product_id"),
            type="facturation",
            user_id=payload.get("id"),
            reason="Export GRM — Facturé",
        )
        mv_doc = movement.model_dump()
        mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
        await db.movements.insert_one(mv_doc)
        invoiced_count += 1

    return {
        "grm_content": grm_content,
        "grm_lines_count": len(grm_lines),
        "invoiced_count": invoiced_count,
        "orders_created": orders_created,
    }



@router.get("/available-stock")
async def get_available_stock(
    category_id: str = None,
    type_id: str = None,
    specification_id: str = None,
    payload: dict = Depends(verify_token),
):
    """
    Returns products with PLACED instances, grouped by product.
    Supports cascading filters by category, type, specification.
    Also returns available filter options based on current selection.
    """
    # Build product query based on filters
    product_query = {}
    if category_id:
        product_query["category_id"] = category_id
    if type_id:
        product_query["type_id"] = type_id
    if specification_id:
        product_query["specification_id"] = specification_id

    # Get all products (for filter options) and filtered products
    all_products = await db.products.find({}, {"_id": 0}).to_list(5000)
    filtered_products = [p for p in all_products if all(
        p.get(k) == v for k, v in product_query.items()
    )] if product_query else all_products

    filtered_product_ids = [p["id"] for p in filtered_products]

    # Get PLACED instances for filtered products
    placed_instances = await db.product_instances.find(
        {"product_id": {"$in": filtered_product_ids}, "status": ProductStatus.PLACED},
        {"_id": 0}
    ).to_list(10000)

    # Get locations for these instances
    location_ids = list(set(i.get("cabinet_location_id") for i in placed_instances if i.get("cabinet_location_id")))
    locations_map = {}
    if location_ids:
        locs = await db.cabinet_locations.find({"id": {"$in": location_ids}}, {"_id": 0}).to_list(10000)
        locations_map = {l["id"]: l for l in locs}

    # Get cabinets
    cabinet_ids = list(set(l.get("cabinet_id") for l in locations_map.values() if l.get("cabinet_id")))
    cabinets_map = {}
    if cabinet_ids:
        cabs = await db.cabinets.find({"id": {"$in": cabinet_ids}}, {"_id": 0}).to_list(100)
        cabinets_map = {c["id"]: c for c in cabs}

    # Group instances by product
    product_stock = {}
    for inst in placed_instances:
        pid = inst["product_id"]
        if pid not in product_stock:
            product_stock[pid] = {"instances": []}
        loc = locations_map.get(inst.get("cabinet_location_id"), {})
        cab = cabinets_map.get(loc.get("cabinet_id"), {})
        loc_code = f"{cab.get('description', '?')}-R{loc.get('row', '?')}-C{loc.get('column', '?')}" if cab else None
        product_stock[pid]["instances"].append({
            "id": inst["id"],
            "serial_number": inst.get("serial_number"),
            "lot_number": inst.get("lot_number"),
            "expiration_date": inst.get("expiration_date"),
            "location_code": loc_code,
        })

    # Build results sorted by qty desc then nearest expiration
    products_map = {p["id"]: p for p in all_products}
    results = []
    for pid, stock in product_stock.items():
        p = products_map.get(pid, {})
        instances = stock["instances"]
        instances.sort(key=lambda x: x.get("expiration_date") or "9999-12-31")
        nearest_exp = instances[0].get("expiration_date") if instances else None
        nearest_loc = instances[0].get("location_code") if instances else None
        results.append({
            "product_id": pid,
            "description": p.get("description"),
            "category_id": p.get("category_id"),
            "type_id": p.get("type_id"),
            "specification_id": p.get("specification_id"),
            "quantity": len(instances),
            "nearest_expiration": nearest_exp,
            "nearest_location": nearest_loc,
            "instances": instances,
        })

    results.sort(key=lambda x: (-x["quantity"], x.get("nearest_expiration") or "9999-12-31"))

    # Build cascading filter options
    # Products that have PLACED instances (for filtering)
    products_with_stock_ids = set(product_stock.keys())

    # Based on current filters, compute available options
    available_cats = set()
    available_types = set()
    available_specs = set()
    for p in all_products:
        if p["id"] not in products_with_stock_ids:
            continue
        matches = True
        if category_id and p.get("category_id") != category_id:
            matches = False
        if type_id and p.get("type_id") != type_id:
            matches = False
        if specification_id and p.get("specification_id") != specification_id:
            matches = False

        if matches or not category_id:
            if p.get("category_id"):
                available_cats.add(p["category_id"])
        if matches or not type_id:
            if p.get("type_id"):
                available_types.add(p["type_id"])
        if matches or not specification_id:
            if p.get("specification_id"):
                available_specs.add(p["specification_id"])

    # Fetch display names
    cats = await db.product_categories.find({}, {"_id": 0}).to_list(500)
    types = await db.product_types.find({}, {"_id": 0}).to_list(500)
    specs = await db.product_specifications.find({}, {"_id": 0}).to_list(500)

    filter_options = {
        "categories": [c for c in cats if c["id"] in available_cats],
        "types": [t for t in types if t["id"] in available_types],
        "specifications": [s for s in specs if s["id"] in available_specs],
    }

    return {"results": results, "filter_options": filter_options}


@router.post("/scan")
async def scan_instance(data: dict, payload: dict = Depends(verify_token)):
    """
    Scan a serial number to determine action:
    - RECEIVED → suggest placement location
    - PICKED → suggest return to stock location
    - PLACED → already in stock
    - Unknown → new product
    """
    serial = data.get("serial_number", "").strip()
    if not serial:
        raise HTTPException(status_code=400, detail="Numéro de série requis")

    instance = await db.product_instances.find_one({"serial_number": serial}, {"_id": 0})

    if not instance:
        return {
            "action": "unknown",
            "message": "Numéro de série inconnu",
            "serial_number": serial,
        }

    # Enrich
    product = await db.products.find_one({"id": instance.get("product_id")}, {"_id": 0})
    instance["product"] = product or {}

    status = instance.get("status")

    if status == ProductStatus.RECEIVED:
        # Suggest placement location
        location = await _find_available_location(instance.get("product_id"))
        return {
            "action": "place",
            "message": "Produit réceptionné — prêt pour placement",
            "instance": instance,
            "suggested_location": location,
        }
    elif status == ProductStatus.PICKED:
        location = await _find_available_location(instance.get("product_id"))
        return {
            "action": "return_to_stock",
            "message": "Produit prélevé — remise en stock",
            "instance": instance,
            "suggested_location": location,
        }
    elif status == ProductStatus.PLACED:
        # Find current location
        loc = None
        if instance.get("cabinet_location_id"):
            loc = await db.cabinet_locations.find_one(
                {"id": instance["cabinet_location_id"]}, {"_id": 0}
            )
            if loc:
                cabinet = await db.cabinets.find_one({"id": loc.get("cabinet_id")}, {"_id": 0})
                if cabinet:
                    loc["cabinet"] = cabinet
        return {
            "action": "already_placed",
            "message": "Produit déjà en stock",
            "instance": instance,
            "location": loc,
        }
    else:
        status_labels = {
            ProductStatus.CONSUMED: "consommé",
            ProductStatus.INVOICED: "facturé",
            ProductStatus.ORDERED: "commandé (pas encore reçu)",
        }
        label = status_labels.get(status, f"statut {status}")
        return {
            "action": "unavailable",
            "message": f"Ce produit a été {label}",
            "instance": instance,
            "status_label": label,
        }


@router.post("/place")
async def place_instance(data: dict, payload: dict = Depends(verify_token)):
    """
    Place a RECEIVED instance into a cabinet location.
    data: {instance_id, location_id}
    """
    instance_id = data.get("instance_id")
    location_id = data.get("location_id")

    if not instance_id or not location_id:
        raise HTTPException(status_code=400, detail="instance_id et location_id requis")

    instance = await db.product_instances.find_one({"id": instance_id})
    if not instance:
        raise HTTPException(status_code=404, detail="Instance non trouvée")
    if instance.get("status") not in [ProductStatus.RECEIVED, ProductStatus.PICKED]:
        raise HTTPException(status_code=400, detail="Instance non éligible au placement")

    location = await db.cabinet_locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Emplacement non trouvé")
    if not location.get("is_empty"):
        raise HTTPException(status_code=400, detail="Emplacement déjà occupé")

    # Check product compatibility
    if location.get("product_id") and location["product_id"] != instance.get("product_id"):
        raise HTTPException(
            status_code=400,
            detail="Cet emplacement est désigné pour un autre produit"
        )

    # Update instance
    await db.product_instances.update_one(
        {"id": instance_id},
        {"$set": {
            "status": ProductStatus.PLACED,
            "cabinet_location_id": location_id,
        }}
    )

    # Update location
    await db.cabinet_locations.update_one(
        {"id": location_id},
        {"$set": {"is_empty": False, "instance_id": instance_id}}
    )

    # Record movement
    cabinet = await db.cabinets.find_one({"id": location.get("cabinet_id")}, {"_id": 0})
    location_code = f"{cabinet.get('description', '?')}-R{location.get('row', '?')}-C{location.get('column', '?')}" if cabinet else "?"

    movement = Movement(
        instance_id=instance_id,
        product_id=instance.get("product_id"),
        type="placement",
        user_id=payload.get("id"),
        reason="Placement en cabinet",
        location_code=location_code,
    )
    mv_doc = movement.model_dump()
    mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
    await db.movements.insert_one(mv_doc)

    await emit_event("inventory_changed", {"action": "placed", "instance_id": instance_id})
    return {"placed": True, "location_code": location_code}


@router.post("/return-to-stock")
async def return_to_stock(data: dict, payload: dict = Depends(verify_token)):
    """
    Return a PICKED instance to stock.
    data: {instance_id, location_id}
    """
    instance_id = data.get("instance_id")
    location_id = data.get("location_id")

    if not instance_id or not location_id:
        raise HTTPException(status_code=400, detail="instance_id et location_id requis")

    instance = await db.product_instances.find_one({"id": instance_id})
    if not instance:
        raise HTTPException(status_code=404, detail="Instance non trouvée")
    if instance.get("status") != ProductStatus.PICKED:
        raise HTTPException(status_code=400, detail="Seuls les produits prélevés peuvent être remis en stock")

    location = await db.cabinet_locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Emplacement non trouvé")
    if not location.get("is_empty"):
        raise HTTPException(status_code=400, detail="Emplacement déjà occupé")

    # Update instance
    await db.product_instances.update_one(
        {"id": instance_id},
        {"$set": {
            "status": ProductStatus.PLACED,
            "cabinet_location_id": location_id,
        }}
    )

    # Update location
    await db.cabinet_locations.update_one(
        {"id": location_id},
        {"$set": {"is_empty": False, "instance_id": instance_id}}
    )

    # Record movement
    cabinet = await db.cabinets.find_one({"id": location.get("cabinet_id")}, {"_id": 0})
    location_code = f"{cabinet.get('description', '?')}-R{location.get('row', '?')}-C{location.get('column', '?')}" if cabinet else "?"

    # Decrement picked_quantity on the intervention this was picked for
    last_pick = await db.movements.find_one(
        {"instance_id": instance_id, "type": "prelevement"},
        sort=[("timestamp", -1)]
    )
    if last_pick and last_pick.get("intervention_id"):
        await db.intervention_products.update_one(
            {
                "intervention_id": last_pick["intervention_id"],
                "product_id": instance.get("product_id"),
                "picked_quantity": {"$gt": 0},
            },
            {"$inc": {"picked_quantity": -1}}
        )

    movement = Movement(
        instance_id=instance_id,
        product_id=instance.get("product_id"),
        type="retour",
        user_id=payload.get("id"),
        reason="Produit non utilisé, remis en stock",
        location_code=location_code,
    )
    mv_doc = movement.model_dump()
    mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
    await db.movements.insert_one(mv_doc)

    await emit_event("inventory_changed", {"action": "returned", "instance_id": instance_id})
    return {"returned": True, "location_code": location_code}


@router.post("/verify-admin-pin")
async def verify_admin_pin(data: dict, payload: dict = Depends(verify_token)):
    """Verify admin PIN for exceptional operations"""
    pin = data.get("pin", "").strip()
    if not pin:
        raise HTTPException(status_code=400, detail="NIP requis")

    admins = await db.employees.find(
        {"role": {"$in": ["administrateur", "gestionnaire"]}, "pin_hash": {"$exists": True, "$ne": None}},
        {"_id": 0}
    ).to_list(100)

    for admin in admins:
        try:
            if admin.get("card_id") == pin:
                return {"valid": True, "admin_name": f"{admin.get('first_name', '')} {admin.get('last_name', '')}".strip()}
            if admin.get("pin_hash") and bcrypt.checkpw(pin.encode(), admin["pin_hash"].encode()):
                return {"valid": True, "admin_name": f"{admin.get('first_name', '')} {admin.get('last_name', '')}".strip()}
        except Exception:
            continue

    raise HTTPException(status_code=401, detail="NIP administrateur invalide")


async def _find_available_location(product_id: str):
    """Find the best available cabinet location for a product"""
    # First: locations designated for this product
    loc = await db.cabinet_locations.find_one({
        "product_id": product_id,
        "is_empty": True,
    })
    if loc:
        loc.pop("_id", None)
        cabinet = await db.cabinets.find_one({"id": loc.get("cabinet_id")}, {"_id": 0})
        if cabinet:
            loc["cabinet"] = cabinet
        return loc

    # Second: any undesignated empty location
    loc = await db.cabinet_locations.find_one({
        "product_id": None,
        "is_empty": True,
    })
    if loc:
        loc.pop("_id", None)
        cabinet = await db.cabinets.find_one({"id": loc.get("cabinet_id")}, {"_id": 0})
        if cabinet:
            loc["cabinet"] = cabinet
        return loc

    return None
