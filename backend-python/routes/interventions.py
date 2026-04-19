from fastapi import APIRouter, HTTPException, Depends
from fastapi import UploadFile, File
import csv
import io
from database import db
from models import (
    Intervention, InterventionCreate, InterventionUpdate,
    InterventionProduct, ProductStatus, Movement
)
from routes.auth import verify_token
from sio import emit_event
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/Toronto")
import uuid

router = APIRouter(prefix="/api/interventions", tags=["interventions"])


async def _enrich_intervention_product(ip):
    """Enrich an intervention product with category/type/spec/product names and resolution level."""
    if ip.get("product_id"):
        product = await db.products.find_one({"id": ip["product_id"]}, {"_id": 0})
        if product:
            if product.get("category_id"):
                cat = await db.product_categories.find_one({"id": product["category_id"]}, {"_id": 0})
                if cat:
                    product["category"] = cat
            if product.get("type_id"):
                ptype = await db.product_types.find_one({"id": product["type_id"]}, {"_id": 0})
                if ptype:
                    product["type"] = ptype
            if product.get("specification_id"):
                spec = await db.product_specifications.find_one({"id": product["specification_id"]}, {"_id": 0})
                if spec:
                    product["specification_obj"] = spec
            ip["product"] = product

    # Enrich partial fields with names
    if ip.get("category_id"):
        cat = await db.product_categories.find_one({"id": ip["category_id"]}, {"_id": 0})
        if cat:
            ip["category"] = cat
    if ip.get("type_id"):
        t = await db.product_types.find_one({"id": ip["type_id"]}, {"_id": 0})
        if t:
            ip["type_obj"] = t
    if ip.get("specification_id"):
        s = await db.product_specifications.find_one({"id": ip["specification_id"]}, {"_id": 0})
        if s:
            ip["specification_obj"] = s

    # Compute resolution level
    if ip.get("instance_id"):
        ip["resolution"] = "instance"
    elif ip.get("product_id"):
        ip["resolution"] = "product"
    elif ip.get("specification_id"):
        ip["resolution"] = "specification"
    elif ip.get("type_id"):
        ip["resolution"] = "type"
    elif ip.get("category_id"):
        ip["resolution"] = "category"
    else:
        ip["resolution"] = "none"

    return ip


@router.get("")
async def get_interventions(
    filter: str = "today",
    date: str = None,
    date_from: str = None,
    date_to: str = None,
    payload: dict = Depends(verify_token),
):
    now = datetime.now(ET)
    query = {}

    if date_from and date_to:
        query["planned_datetime"] = {"$gte": f"{date_from}T00:00:00", "$lte": f"{date_to}T23:59:59"}
    elif date_from:
        query["planned_datetime"] = {"$gte": f"{date_from}T00:00:00"}
    elif date_to:
        query["planned_datetime"] = {"$lte": f"{date_to}T23:59:59"}
    elif date:
        # Specific date: format YYYY-MM-DD
        start = f"{date}T00:00:00"
        end = f"{date}T23:59:59"
        query["planned_datetime"] = {"$gte": start, "$lte": end}
    elif filter == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S")
        end = now.replace(hour=23, minute=59, second=59, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S")
        query["planned_datetime"] = {"$gte": start, "$lte": end}
    elif filter == "week":
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = (now + timedelta(days=6 - now.weekday())).replace(hour=23, minute=59, second=59, microsecond=0)
        start = week_start.strftime("%Y-%m-%dT%H:%M:%S")
        end = week_end.strftime("%Y-%m-%dT%H:%M:%S")
        query["planned_datetime"] = {"$gte": start, "$lte": end}

    docs = await db.interventions.find(query, {"_id": 0}).to_list(1000)

    for doc in docs:
        products = await db.intervention_products.find(
            {"intervention_id": doc["id"]}, {"_id": 0}
        ).to_list(100)
        for ip in products:
            await _enrich_intervention_product(ip)
        doc["products"] = products

    docs.sort(key=lambda x: x.get("planned_datetime", ""))
    return docs


@router.post("/import-csv")
async def import_interventions_csv(file: UploadFile = File(...), payload: dict = Depends(verify_token)):
    """Import interventions from a CSV file. Deduplicates by (date + salle + mrn)."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text), delimiter=",")

    if reader.fieldnames:
        reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    created = 0
    duplicates = 0
    errors = []
    seen = set()

    for i, row in enumerate(reader, start=2):
        date_str = (row.get("date_intervention_prevue") or "").strip()
        salle = (row.get("salle") or "").strip()
        mrn = (row.get("mrn_patient") or "").strip()
        birth = (row.get("date_naissance") or "").strip()

        if not date_str:
            errors.append(f"Ligne {i}: date_intervention_prevue manquante")
            continue

        key = f"{date_str[:10]}|{salle}|{mrn}"
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)

        existing = await db.interventions.find_one({
            "planned_datetime": {"$gte": f"{date_str[:10]}T00:00:00", "$lte": f"{date_str[:10]}T23:59:59"},
            "operating_room": salle or None,
            "patient_file_number": mrn or None,
        }, {"_id": 1})
        if existing:
            duplicates += 1
            continue

        planned_dt = f"{date_str[:10]}T00:00:00"
        intervention = Intervention(
            planned_datetime=planned_dt,
            operating_room=salle or None,
            patient_file_number=mrn or None,
            birth_date=birth or None,
        )
        doc = intervention.model_dump()
        doc["planned_datetime"] = doc["planned_datetime"].isoformat() if hasattr(doc["planned_datetime"], "isoformat") else str(doc["planned_datetime"])
        doc["created_at"] = doc["created_at"].isoformat() if hasattr(doc["created_at"], "isoformat") else str(doc["created_at"])
        await db.interventions.insert_one(doc)
        created += 1

    if created > 0:
        await emit_event("intervention_changed", {"action": "imported", "count": created})

    return {
        "created": created,
        "duplicates": duplicates,
        "errors": errors,
        "total_lines": created + duplicates + len(errors),
    }



@router.get("/{intervention_id}")
async def get_intervention(intervention_id: str, payload: dict = Depends(verify_token)):
    doc = await db.interventions.find_one({"id": intervention_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    products = await db.intervention_products.find(
        {"intervention_id": intervention_id}, {"_id": 0}
    ).to_list(100)

    for ip in products:
        await _enrich_intervention_product(ip)

    doc["products"] = products
    return doc


@router.post("")
async def create_intervention(data: InterventionCreate, payload: dict = Depends(verify_token)):
    intervention = Intervention(
        planned_datetime=data.planned_datetime,
        operating_room=data.operating_room,
        surgeon=data.surgeon,
        patient_file_number=data.patient_file_number,
        birth_date=data.birth_date,
    )
    doc = intervention.model_dump()
    doc["planned_datetime"] = doc["planned_datetime"].isoformat()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.interventions.insert_one(doc)

    # Create intervention_products — supports partial specs
    for item in data.products:
        product_id = item.get("product_id")
        category_id = item.get("category_id")
        type_id = item.get("type_id")
        specification_id = item.get("specification_id")
        instance_id = item.get("instance_id")
        serial_number = item.get("serial_number")

        # If product_id given, fill cat/type/spec from product
        if product_id:
            product = await db.products.find_one({"id": product_id})
            if product:
                category_id = category_id or product.get("category_id")
                type_id = type_id or product.get("type_id")
                specification_id = specification_id or product.get("specification_id")

        # Must have at least category or product
        if not category_id and not product_id:
            continue

        ip = InterventionProduct(
            intervention_id=intervention.id,
            product_id=product_id,
            category_id=category_id,
            type_id=type_id,
            specification_id=specification_id,
            instance_id=instance_id,
            serial_number=serial_number,
            required_quantity=item.get("required_quantity", 1),
        )
        ip_doc = ip.model_dump()
        await db.intervention_products.insert_one(ip_doc)

    doc.pop("_id", None)
    await emit_event("intervention_changed", {"action": "created", "id": intervention.id})
    return doc


@router.put("/{intervention_id}")
async def update_intervention(
    intervention_id: str,
    data: InterventionUpdate,
    payload: dict = Depends(verify_token),
):
    existing = await db.interventions.find_one({"id": intervention_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "planned_datetime" in update_data and update_data["planned_datetime"]:
        update_data["planned_datetime"] = update_data["planned_datetime"].isoformat()

    if update_data:
        await db.interventions.update_one({"id": intervention_id}, {"$set": update_data})

    updated = await db.interventions.find_one({"id": intervention_id}, {"_id": 0})
    await emit_event("intervention_changed", {"action": "updated", "id": intervention_id})
    return updated


@router.post("/{intervention_id}/products")
async def add_intervention_product(
    intervention_id: str,
    data: dict,
    payload: dict = Depends(verify_token),
):
    """Add a product requirement to an intervention — supports partial specs"""
    intervention = await db.interventions.find_one({"id": intervention_id})
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    product_id = data.get("product_id")
    category_id = data.get("category_id")
    type_id = data.get("type_id")
    specification_id = data.get("specification_id")
    instance_id = data.get("instance_id")
    serial_number = data.get("serial_number")
    required_quantity = data.get("required_quantity", 1)

    # If product_id given, fill cat/type/spec from product
    if product_id:
        product = await db.products.find_one({"id": product_id})
        if product:
            category_id = category_id or product.get("category_id")
            type_id = type_id or product.get("type_id")
            specification_id = specification_id or product.get("specification_id")

    if not category_id and not product_id:
        raise HTTPException(status_code=400, detail="Au moins une catégorie ou un produit est requis")

    ip = InterventionProduct(
        intervention_id=intervention_id,
        product_id=product_id,
        category_id=category_id,
        type_id=type_id,
        specification_id=specification_id,
        instance_id=instance_id,
        serial_number=serial_number,
        required_quantity=required_quantity,
    )
    ip_doc = ip.model_dump()
    await db.intervention_products.insert_one(ip_doc)
    ip_doc.pop("_id", None)
    return ip_doc


@router.put("/{intervention_id}/products/{ip_id}")
async def update_intervention_product(
    intervention_id: str,
    ip_id: str,
    data: dict,
    payload: dict = Depends(verify_token),
):
    """Update/refine an intervention product — can add type_id, specification_id, product_id, etc."""
    ip = await db.intervention_products.find_one({"id": ip_id, "intervention_id": intervention_id})
    if not ip:
        raise HTTPException(status_code=404, detail="Produit d'intervention non trouvé")

    update_fields = {}
    for field in ["category_id", "type_id", "specification_id", "product_id",
                  "instance_id", "serial_number", "required_quantity"]:
        if field in data and data[field] is not None:
            update_fields[field] = data[field]

    # Validate required_quantity
    if "required_quantity" in update_fields and update_fields["required_quantity"] < 1:
        raise HTTPException(status_code=400, detail="Quantité minimale: 1")

    # If product_id being set, auto-fill category/type/spec
    if "product_id" in update_fields:
        product = await db.products.find_one({"id": update_fields["product_id"]})
        if product:
            update_fields.setdefault("category_id", product.get("category_id"))
            update_fields.setdefault("type_id", product.get("type_id"))
            update_fields.setdefault("specification_id", product.get("specification_id"))

    if update_fields:
        await db.intervention_products.update_one({"id": ip_id}, {"$set": update_fields})

    updated = await db.intervention_products.find_one({"id": ip_id}, {"_id": 0})
    await _enrich_intervention_product(updated)
    return updated


@router.delete("/{intervention_id}/products/{ip_id}")
async def remove_intervention_product(
    intervention_id: str,
    ip_id: str,
    payload: dict = Depends(verify_token),
):
    """Remove a product from an intervention"""
    result = await db.intervention_products.delete_one({"id": ip_id, "intervention_id": intervention_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produit d'intervention non trouvé")
    return {"deleted": True}


@router.post("/{intervention_id}/pick")
async def pick_for_intervention(
    intervention_id: str,
    data: dict,
    payload: dict = Depends(verify_token),
):
    """
    Pick a product instance for an intervention.
    Validates that the scanned product matches an intervention requirement.
    Returns mismatch warning if not, unless force=True.
    """
    intervention = await db.interventions.find_one({"id": intervention_id})
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    product_id = data.get("product_id")
    instance_id = data.get("instance_id")
    force = data.get("force", False)

    if instance_id:
        instance = await db.product_instances.find_one({
            "id": instance_id,
            "status": ProductStatus.PLACED
        })
        if not instance:
            raise HTTPException(status_code=400, detail="Instance non disponible")
    else:
        instances_with_exp = await db.product_instances.find({
            "product_id": product_id,
            "status": ProductStatus.PLACED,
            "expiration_date": {"$ne": None}
        }, {"_id": 0}).sort("expiration_date", 1).to_list(1)

        if instances_with_exp:
            instance = instances_with_exp[0]
        else:
            instances_no_exp = await db.product_instances.find({
                "product_id": product_id,
                "status": ProductStatus.PLACED,
            }, {"_id": 0}).sort("created_at", 1).to_list(1)
            if not instances_no_exp:
                raise HTTPException(status_code=400, detail="Aucune instance disponible pour ce produit")
            instance = instances_no_exp[0]

        instance_id = instance["id"]

    # --- Match validation ---
    int_products = await db.intervention_products.find(
        {"intervention_id": intervention_id}, {"_id": 0}
    ).to_list(100)

    scanned_product = await db.products.find_one({"id": instance.get("product_id", product_id)}, {"_id": 0})
    matched_ip = None

    for ip in int_products:
        remaining = ip.get("required_quantity", 0) - ip.get("picked_quantity", 0)
        if remaining <= 0:
            continue

        # Exact product match
        if ip.get("product_id") and ip["product_id"] == instance.get("product_id", product_id):
            matched_ip = ip
            break

        # Partial match: check category/type/spec
        if not ip.get("product_id") and scanned_product:
            cat_ok = not ip.get("category_id") or ip["category_id"] == scanned_product.get("category_id")
            type_ok = not ip.get("type_id") or ip["type_id"] == scanned_product.get("type_id")
            spec_ok = not ip.get("specification_id") or ip["specification_id"] == scanned_product.get("specification_id")
            if cat_ok and type_ok and spec_ok:
                matched_ip = ip
                break

    # Mismatch: build warning
    if not matched_ip and not force:
        # Build expected label from first non-done intervention product
        expected_parts = []
        for ip in int_products:
            if ip.get("required_quantity", 0) - ip.get("picked_quantity", 0) <= 0:
                continue
            if ip.get("product_id"):
                p = await db.products.find_one({"id": ip["product_id"]}, {"_id": 0})
                if p:
                    expected_parts.append(p.get("description", ""))
            else:
                if ip.get("category_id"):
                    c = await db.product_categories.find_one({"id": ip["category_id"]}, {"_id": 0})
                    if c:
                        expected_parts.append(c.get("description", ""))
                if ip.get("type_id"):
                    t = await db.product_types.find_one({"id": ip["type_id"]}, {"_id": 0})
                    if t:
                        expected_parts.append(t.get("description", ""))
                if ip.get("specification_id"):
                    s = await db.product_specifications.find_one({"id": ip["specification_id"]}, {"_id": 0})
                    if s:
                        expected_parts.append(s.get("description", ""))
            break  # Only show the first unfinished requirement

        expected_label = " / ".join(expected_parts) if expected_parts else "produit requis"
        scanned_desc = scanned_product.get("description", "inconnu") if scanned_product else "inconnu"

        return {
            "mismatch": True,
            "message": f"Ce produit ({scanned_desc}) ne correspond pas à « {expected_label} ».",
            "scanned_description": scanned_desc,
            "expected_label": expected_label,
        }

    # --- Proceed with pick ---
    await db.product_instances.update_one(
        {"id": instance_id},
        {"$set": {"status": ProductStatus.PICKED}}
    )

    if instance.get("cabinet_location_id"):
        await db.cabinet_locations.update_one(
            {"id": instance["cabinet_location_id"]},
            {"$set": {"is_empty": True, "instance_id": None}}
        )

    # Update matched intervention_product's picked_quantity
    if matched_ip:
        await db.intervention_products.update_one(
            {"id": matched_ip["id"]},
            {"$inc": {"picked_quantity": 1}}
        )
    else:
        # Force pick with no match — try best-effort match by product_id
        await db.intervention_products.update_one(
            {"intervention_id": intervention_id, "product_id": instance.get("product_id", product_id)},
            {"$inc": {"picked_quantity": 1}}
        )

    movement = Movement(
        instance_id=instance_id,
        product_id=instance.get("product_id", product_id),
        type="prelevement",
        user_id=payload.get("id"),
        reason=f"Prélèvement pour intervention - MRN: {intervention.get('patient_file_number', '') or '—'}",
        intervention_id=intervention_id,
    )
    mv_doc = movement.model_dump()
    mv_doc["timestamp"] = mv_doc["timestamp"].isoformat()
    await db.movements.insert_one(mv_doc)

    location_code = None
    if instance.get("cabinet_location_id"):
        loc = await db.cabinet_locations.find_one({"id": instance["cabinet_location_id"]}, {"_id": 0})
        if loc:
            cab = await db.cabinets.find_one({"id": loc.get("cabinet_id")}, {"_id": 0})
            location_code = f"{cab.get('description', '?')}-R{loc.get('row', '?')}-C{loc.get('column', '?')}" if cab else None

    result = {
        "picked": True,
        "instance_id": instance_id,
        "serial_number": instance.get("serial_number"),
        "lot_number": instance.get("lot_number"),
        "expiration_date": instance.get("expiration_date"),
        "location_code": location_code,
    }
    await emit_event("intervention_changed", {"action": "picked", "id": intervention_id})
    await emit_event("inventory_changed", {"action": "picked", "instance_id": instance_id})
    return result


@router.get("/{intervention_id}/fifo-suggestions")
async def get_fifo_suggestions(intervention_id: str, payload: dict = Depends(verify_token)):
    """
    For each product required by the intervention, return FIFO-sorted available instances.
    Supports partial specs: finds matching products by category/type/spec.
    """
    intervention = await db.interventions.find_one({"id": intervention_id})
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    int_products = await db.intervention_products.find(
        {"intervention_id": intervention_id}, {"_id": 0}
    ).to_list(100)

    suggestions = []
    for ip in int_products:
        remaining = ip.get("required_quantity", 0) - ip.get("picked_quantity", 0)

        # Determine which product_ids to search for instances
        target_product_ids = []
        if ip.get("product_id"):
            target_product_ids = [ip["product_id"]]
        else:
            # Partial spec: find matching products
            pq = {}
            if ip.get("category_id"):
                pq["category_id"] = ip["category_id"]
            if ip.get("type_id"):
                pq["type_id"] = ip["type_id"]
            if ip.get("specification_id"):
                pq["specification_id"] = ip["specification_id"]
            if pq:
                matching = await db.products.find(pq, {"_id": 0, "id": 1}).to_list(500)
                target_product_ids = [m["id"] for m in matching]

        await _enrich_intervention_product(ip)

        if remaining <= 0 or not target_product_ids:
            suggestions.append({
                "ip_id": ip["id"],
                "product_id": ip.get("product_id"),
                "resolution": ip.get("resolution", "none"),
                "category": ip.get("category"),
                "type_obj": ip.get("type_obj"),
                "specification_obj": ip.get("specification_obj"),
                "product": ip.get("product"),
                "remaining": max(remaining, 0),
                "total_available": 0,
                "instances": [],
            })
            continue

        # FIFO: with expiry first (soonest), then without
        with_exp = await db.product_instances.find({
            "product_id": {"$in": target_product_ids},
            "status": ProductStatus.PLACED,
            "expiration_date": {"$ne": None}
        }, {"_id": 0}).sort("expiration_date", 1).to_list(remaining + 5)

        no_exp = await db.product_instances.find({
            "product_id": {"$in": target_product_ids},
            "status": ProductStatus.PLACED,
            "expiration_date": None
        }, {"_id": 0}).sort("created_at", 1).to_list(remaining + 5)

        all_available = with_exp + no_exp

        enriched = []
        for inst in all_available[:remaining + 5]:
            loc_code = None
            if inst.get("cabinet_location_id"):
                loc = await db.cabinet_locations.find_one({"id": inst["cabinet_location_id"]}, {"_id": 0})
                if loc:
                    cab = await db.cabinets.find_one({"id": loc.get("cabinet_id")}, {"_id": 0})
                    loc_code = f"{cab.get('description', '?')}-R{loc.get('row', '?')}-C{loc.get('column', '?')}" if cab else None
            # Get product info for this instance
            inst_product = await db.products.find_one({"id": inst.get("product_id")}, {"_id": 0})
            enriched.append({
                "id": inst["id"],
                "product_id": inst.get("product_id"),
                "serial_number": inst.get("serial_number"),
                "lot_number": inst.get("lot_number"),
                "expiration_date": inst.get("expiration_date"),
                "location_code": loc_code,
                "product_description": inst_product.get("description") if inst_product else None,
                "is_priority": len(enriched) == 0,
            })

        product = None
        if ip.get("product_id"):
            product = await db.products.find_one({"id": ip["product_id"]}, {"_id": 0})

        suggestions.append({
            "ip_id": ip["id"],
            "product_id": ip.get("product_id"),
            "resolution": ip.get("resolution", "none"),
            "category": ip.get("category"),
            "type_obj": ip.get("type_obj"),
            "specification_obj": ip.get("specification_obj"),
            "product": product or ip.get("product"),
            "remaining": remaining,
            "total_available": len(all_available),
            "instances": enriched,
        })

    return suggestions


@router.delete("/{intervention_id}")
async def delete_intervention(intervention_id: str, payload: dict = Depends(verify_token)):
    existing = await db.interventions.find_one({"id": intervention_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Intervention non trouvée")

    await db.intervention_products.delete_many({"intervention_id": intervention_id})
    await db.interventions.delete_one({"id": intervention_id})
    await emit_event("intervention_changed", {"action": "deleted", "id": intervention_id})
    return {"deleted": True}
