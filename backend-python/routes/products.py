from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import Product, ProductCreate, ProductUpdate, ProductStatus
from routes.auth import verify_token

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("")
async def get_products(payload: dict = Depends(verify_token)):
    docs = await db.products.find({}, {"_id": 0}).to_list(5000)

    # Batch-load suppliers, categories, types for enrichment
    supplier_ids = list(set(d.get("supplier_id") for d in docs if d.get("supplier_id")))
    category_ids = list(set(d.get("category_id") for d in docs if d.get("category_id")))
    type_ids = list(set(d.get("type_id") for d in docs if d.get("type_id")))
    spec_ids = list(set(d.get("specification_id") for d in docs if d.get("specification_id")))

    suppliers_map = {}
    if supplier_ids:
        suppliers = await db.suppliers.find({"id": {"$in": supplier_ids}}, {"_id": 0}).to_list(1000)
        suppliers_map = {s["id"]: s for s in suppliers}

    categories_map = {}
    if category_ids:
        cats = await db.product_categories.find({"id": {"$in": category_ids}}, {"_id": 0}).to_list(1000)
        categories_map = {c["id"]: c for c in cats}

    types_map = {}
    if type_ids:
        types = await db.product_types.find({"id": {"$in": type_ids}}, {"_id": 0}).to_list(1000)
        types_map = {t["id"]: t for t in types}

    specs_map = {}
    if spec_ids:
        specs = await db.product_specifications.find({"id": {"$in": spec_ids}}, {"_id": 0}).to_list(1000)
        specs_map = {s["id"]: s for s in specs}

    for doc in docs:
        doc["supplier"] = suppliers_map.get(doc.get("supplier_id"), {})
        doc["category"] = categories_map.get(doc.get("category_id"), {})
        doc["type"] = types_map.get(doc.get("type_id"), {})
        doc["specification_obj"] = specs_map.get(doc.get("specification_id"), {})

        # Compute quantity_in_stock from placed instances
        count = await db.product_instances.count_documents({
            "product_id": doc["id"],
            "status": ProductStatus.PLACED
        })
        doc["quantity_in_stock"] = count

    return docs


@router.get("/filter-options")
async def get_product_filter_options(
    category_id: str = None,
    type_id: str = None,
    specification_id: str = None,
    payload: dict = Depends(verify_token),
):
    """
    Return ALL categories, types, specs with cascading filtering.
    Also returns matching products (regardless of stock).
    Used by intervention creation form.
    """
    pq = {}
    if category_id:
        pq["category_id"] = category_id
    if type_id:
        pq["type_id"] = type_id
    if specification_id:
        pq["specification_id"] = specification_id

    products = await db.products.find(pq, {"_id": 0}).to_list(5000)

    if not pq:
        all_cats = await db.product_categories.find({}, {"_id": 0}).to_list(100)
        all_types = await db.product_types.find({}, {"_id": 0}).to_list(200)
        all_specs = await db.product_specifications.find({}, {"_id": 0}).to_list(500)
    else:
        type_ids = list(set(p.get("type_id") for p in products if p.get("type_id")))
        spec_ids = list(set(p.get("specification_id") for p in products if p.get("specification_id")))
        all_cats = await db.product_categories.find({}, {"_id": 0}).to_list(100)
        if type_ids:
            all_types = await db.product_types.find({"id": {"$in": type_ids}}, {"_id": 0}).to_list(200)
        else:
            all_types = []
        if spec_ids:
            all_specs = await db.product_specifications.find({"id": {"$in": spec_ids}}, {"_id": 0}).to_list(500)
        else:
            all_specs = []

    cat_map = {c["id"]: c for c in all_cats}
    type_map = {t["id"]: t for t in all_types}
    spec_map = {s["id"]: s for s in all_specs}

    enriched_products = []
    product_ids = [p["id"] for p in products]

    # Batch fetch all placed instances for matching products
    instances_by_product = {}
    if product_ids:
        placed_instances = await db.product_instances.find(
            {"product_id": {"$in": product_ids}, "status": 3},
            {"_id": 0, "id": 1, "product_id": 1, "serial_number": 1, "lot_number": 1, "expiration_date": 1}
        ).to_list(10000)
        for inst in placed_instances:
            pid = inst["product_id"]
            if pid not in instances_by_product:
                instances_by_product[pid] = []
            instances_by_product[pid].append(inst)

    for p in products:
        pid = p["id"]
        insts = instances_by_product.get(pid, [])
        enriched_products.append({
            "product_id": pid,
            "description": p.get("description", ""),
            "category": cat_map.get(p.get("category_id")),
            "type": type_map.get(p.get("type_id")),
            "specification": spec_map.get(p.get("specification_id")),
            "quantity": len(insts),
            "instances": [{"id": i["id"], "serial_number": i.get("serial_number"), "lot_number": i.get("lot_number"), "expiration_date": i.get("expiration_date")} for i in insts],
        })

    return {
        "filter_options": {
            "categories": all_cats,
            "types": all_types,
            "specifications": all_specs,
        },
        "products": enriched_products,
    }


@router.get("/{product_id}")
async def get_product(product_id: str, payload: dict = Depends(verify_token)):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Produit non trouvé")

    # Enrich
    if doc.get("supplier_id"):
        doc["supplier"] = await db.suppliers.find_one({"id": doc["supplier_id"]}, {"_id": 0}) or {}
    if doc.get("category_id"):
        doc["category"] = await db.product_categories.find_one({"id": doc["category_id"]}, {"_id": 0}) or {}
    if doc.get("type_id"):
        doc["type"] = await db.product_types.find_one({"id": doc["type_id"]}, {"_id": 0}) or {}
    if doc.get("specification_id"):
        doc["specification_obj"] = await db.product_specifications.find_one({"id": doc["specification_id"]}, {"_id": 0}) or {}

    count = await db.product_instances.count_documents({
        "product_id": product_id,
        "status": ProductStatus.PLACED
    })
    doc["quantity_in_stock"] = count

    return doc


STATUS_LABELS = {1: "Commandé", 2: "Reçu", 3: "En stock", 4: "Prélevé", 5: "Consommé", 6: "Facturé"}

@router.get("/{product_id}/instances")
async def get_product_instances(product_id: str, payload: dict = Depends(verify_token)):
    """Get all instances for a specific product, enriched with location info."""
    instances = await db.product_instances.find(
        {"product_id": product_id}, {"_id": 0}
    ).to_list(5000)

    # Get locations for PLACED instances
    loc_ids = [i.get("cabinet_location_id") for i in instances if i.get("cabinet_location_id")]
    locs_map = {}
    if loc_ids:
        locs = await db.cabinet_locations.find({"id": {"$in": loc_ids}}, {"_id": 0}).to_list(5000)
        locs_map = {l["id"]: l for l in locs}

    cab_ids = list(set(l.get("cabinet_id") for l in locs_map.values() if l.get("cabinet_id")))
    cabs_map = {}
    if cab_ids:
        cabs = await db.cabinets.find({"id": {"$in": cab_ids}}, {"_id": 0}).to_list(100)
        cabs_map = {c["id"]: c for c in cabs}

    for inst in instances:
        inst["status_label"] = STATUS_LABELS.get(inst.get("status"), "?")
        loc = locs_map.get(inst.get("cabinet_location_id"))
        if loc:
            cab = cabs_map.get(loc.get("cabinet_id"), {})
            inst["location_code"] = f"{cab.get('description', '?')}-R{loc.get('row', '?')}-C{loc.get('column', '?')}"
        else:
            inst["location_code"] = None

    # Sort: PLACED first, then by expiration
    instances.sort(key=lambda x: (x.get("status", 99), x.get("expiration_date") or "9999"))
    return instances




@router.post("")
async def create_product(data: ProductCreate, payload: dict = Depends(verify_token)):
    # Validate references
    supplier = await db.suppliers.find_one({"id": data.supplier_id})
    if not supplier:
        raise HTTPException(status_code=400, detail="Fournisseur non trouvé")
    category = await db.product_categories.find_one({"id": data.category_id})
    if not category:
        raise HTTPException(status_code=400, detail="Catégorie non trouvée")
    ptype = await db.product_types.find_one({"id": data.type_id})
    if not ptype:
        raise HTTPException(status_code=400, detail="Type non trouvé")
    if data.specification_id:
        spec = await db.product_specifications.find_one({"id": data.specification_id})
        if not spec:
            raise HTTPException(status_code=400, detail="Spécification non trouvée")

    product = Product(**data.model_dump())
    doc = product.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, payload: dict = Depends(verify_token)):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Produit non trouvé")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.products.update_one({"id": product_id}, {"$set": update_data})

    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated


@router.delete("/{product_id}")
async def delete_product(product_id: str, payload: dict = Depends(verify_token)):
    # Check if product has instances
    instance_count = await db.product_instances.count_documents({"product_id": product_id})
    if instance_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Ce produit a {instance_count} instance(s). Supprimez-les d'abord."
        )

    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    return {"deleted": True}
