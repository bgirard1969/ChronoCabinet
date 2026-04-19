from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import Cabinet, CabinetCreate, CabinetUpdate, CabinetLocation, CabinetLocationUpdate
from routes.auth import verify_token
import uuid

router = APIRouter(prefix="/api/cabinets", tags=["cabinets"])


@router.get("")
async def get_cabinets(payload: dict = Depends(verify_token)):
    docs = await db.cabinets.find({}, {"_id": 0}).to_list(100)
    # Enrich with location counts
    for cab in docs:
        total = await db.cabinet_locations.count_documents({"cabinet_id": cab["id"]})
        occupied = await db.cabinet_locations.count_documents({"cabinet_id": cab["id"], "is_empty": False})
        cab["total_locations"] = total
        cab["occupied_locations"] = occupied
    return docs


@router.get("/{cabinet_id}")
async def get_cabinet(cabinet_id: str, payload: dict = Depends(verify_token)):
    doc = await db.cabinets.find_one({"id": cabinet_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Cabinet non trouvé")
    return doc


@router.post("")
async def create_cabinet(data: CabinetCreate, payload: dict = Depends(verify_token)):
    cabinet = Cabinet(**data.model_dump())
    doc = cabinet.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.cabinets.insert_one(doc)

    # Auto-generate all CabinetLocations for the N×M grid
    locations = []
    for r in range(1, data.rows + 1):
        for c in range(1, data.columns + 1):
            loc = CabinetLocation(
                cabinet_id=cabinet.id,
                row=r,
                column=c,
            )
            loc_doc = loc.model_dump()
            loc_doc["created_at"] = loc_doc["created_at"].isoformat()
            locations.append(loc_doc)

    if locations:
        await db.cabinet_locations.insert_many(locations)

    doc.pop("_id", None)
    doc["total_locations"] = len(locations)
    doc["occupied_locations"] = 0
    return doc


@router.put("/{cabinet_id}")
async def update_cabinet(cabinet_id: str, data: CabinetUpdate, payload: dict = Depends(verify_token)):
    existing = await db.cabinets.find_one({"id": cabinet_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Cabinet non trouvé")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.cabinets.update_one({"id": cabinet_id}, {"$set": update_data})

    updated = await db.cabinets.find_one({"id": cabinet_id}, {"_id": 0})
    return updated


@router.delete("/{cabinet_id}")
async def delete_cabinet(cabinet_id: str, payload: dict = Depends(verify_token)):
    # Check if any location has an instance
    occupied = await db.cabinet_locations.find_one({"cabinet_id": cabinet_id, "is_empty": False})
    if occupied:
        raise HTTPException(status_code=400, detail="Ce cabinet contient des produits. Videz-le d'abord.")

    await db.cabinet_locations.delete_many({"cabinet_id": cabinet_id})
    result = await db.cabinets.delete_one({"id": cabinet_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cabinet non trouvé")
    return {"deleted": True}


# ============= CABINET LOCATIONS =============

@router.get("/{cabinet_id}/locations")
async def get_cabinet_locations(cabinet_id: str, payload: dict = Depends(verify_token)):
    """Get all locations for a cabinet as a matrix with enriched data"""
    cabinet = await db.cabinets.find_one({"id": cabinet_id}, {"_id": 0})
    if not cabinet:
        raise HTTPException(status_code=404, detail="Cabinet non trouvé")

    locations = await db.cabinet_locations.find({"cabinet_id": cabinet_id}, {"_id": 0}).to_list(5000)

    # 1. Load instances first
    instance_ids = list(set(loc.get("instance_id") for loc in locations if loc.get("instance_id")))
    instances_map = {}
    if instance_ids:
        instances = await db.product_instances.find({"id": {"$in": instance_ids}}, {"_id": 0}).to_list(1000)
        instances_map = {i["id"]: i for i in instances}

    # 2. Collect ALL product_ids (from locations + instances)
    product_ids = set(loc.get("product_id") for loc in locations if loc.get("product_id"))
    for inst in instances_map.values():
        if inst.get("product_id"):
            product_ids.add(inst["product_id"])
    product_ids = list(product_ids)

    # 3. Load and enrich products with type + specification
    products_map = {}
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
        type_ids = list(set(p.get("type_id") for p in products if p.get("type_id")))
        spec_ids = list(set(p.get("specification_id") for p in products if p.get("specification_id")))
        types_map = {}
        if type_ids:
            types = await db.product_types.find({"id": {"$in": type_ids}}, {"_id": 0}).to_list(500)
            types_map = {t["id"]: t for t in types}
        specs_map = {}
        if spec_ids:
            specs = await db.product_specifications.find({"id": {"$in": spec_ids}}, {"_id": 0}).to_list(500)
            specs_map = {s["id"]: s for s in specs}
        for p in products:
            p["type"] = types_map.get(p.get("type_id"), {})
            p["specification_obj"] = specs_map.get(p.get("specification_id"), {})
        products_map = {p["id"]: p for p in products}

    # 4. Assign to locations
    for loc in locations:
        if loc.get("instance_id") and loc["instance_id"] in instances_map:
            loc["instance"] = instances_map[loc["instance_id"]]
        pid = loc.get("product_id") or (loc.get("instance", {}).get("product_id"))
        if pid and pid in products_map:
            loc["product"] = products_map[pid]

    return {"cabinet": cabinet, "locations": locations}


@router.put("/{cabinet_id}/locations/{location_id}")
async def update_cabinet_location(
    cabinet_id: str,
    location_id: str,
    data: CabinetLocationUpdate,
    payload: dict = Depends(verify_token),
):
    loc = await db.cabinet_locations.find_one({"id": location_id, "cabinet_id": cabinet_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Emplacement non trouvé")

    update_data = {}
    # product_id can be: a valid ID, empty string, or None — all mean "update"
    if data.product_id:
        product = await db.products.find_one({"id": data.product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Produit non trouvé")
        update_data["product_id"] = data.product_id
    else:
        update_data["product_id"] = None

    await db.cabinet_locations.update_one({"id": location_id}, {"$set": update_data})

    updated = await db.cabinet_locations.find_one({"id": location_id}, {"_id": 0})
    return updated
