from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import db
from models import ProductStatus, Movement
from routes.auth import verify_token
from sio import emit_event
from datetime import datetime, timezone
import uuid
import io
import openpyxl

router = APIRouter(prefix="/api/consumption", tags=["consumption"])


def normalize(val):
    """Strip and lowercase a value for comparison."""
    if val is None:
        return ""
    return str(val).strip().lower()


@router.post("/import/preview")
async def import_preview(file: UploadFile = File(...), payload: dict = Depends(verify_token)):
    """
    Parse an Excel/CSV file and attempt to match each row to a product instance.
    Returns a preview of matches without applying any changes.
    """
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xlsx ou .csv")

    content = await file.read()

    # Parse Excel
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows_raw = list(ws.iter_rows(values_only=True))
        wb.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier: {str(e)}")

    if len(rows_raw) < 2:
        raise HTTPException(status_code=400, detail="Le fichier ne contient aucune donnée")

    # Map headers
    headers = [normalize(h).replace("\n", " ") for h in rows_raw[0]]
    data_rows = rows_raw[1:]

    # Column index mapping (flexible)
    col_map = {}
    for i, h in enumerate(headers):
        if "mrn" in h:
            col_map["mrn"] = i
        elif "naissance" in h:
            col_map["birth_date"] = i
        elif "serie" in h or "série" in h:
            col_map["serial"] = i
        elif "lot" in h and "no" in h:
            col_map["lot"] = i
        elif "description" in h and "produit" in h:
            col_map["description"] = i
        elif "date operation" in h or "date opération" in h:
            col_map["operation_date"] = i
        elif "intervention" in h:
            col_map["intervention"] = i
        elif "date expiration" in h:
            col_map["expiration_date"] = i
        elif "code" in h and "article" in h:
            col_map["article_code"] = i
        elif "upn" in h:
            col_map["upn"] = i
        elif "salle" in h:
            col_map["room"] = i
        elif "date extraction" in h:
            col_map["extraction_date"] = i

    results = []
    for row_idx, row in enumerate(data_rows):
        row_data = {
            "row_number": row_idx + 2,
            "mrn": str(row[col_map["mrn"]] or "").strip() if "mrn" in col_map else "",
            "birth_date": str(row[col_map["birth_date"]] or "").strip() if "birth_date" in col_map else "",
            "serial_number": str(row[col_map["serial"]] or "").strip() if "serial" in col_map else "",
            "lot_number": str(row[col_map["lot"]] or "").strip() if "lot" in col_map else "",
            "description": str(row[col_map["description"]] or "").strip() if "description" in col_map else "",
            "operation_date": str(row[col_map["operation_date"]] or "").strip() if "operation_date" in col_map else "",
            "article_code": str(row[col_map["article_code"]] or "").strip() if "article_code" in col_map else "",
        }

        # Skip completely empty rows
        if not row_data["mrn"] and not row_data["serial_number"] and not row_data["lot_number"]:
            continue

        match_result = await _find_match(row_data)
        results.append({**row_data, **match_result})

    # Summary
    matched = sum(1 for r in results if r["status"] == "matched")
    unmatched = sum(1 for r in results if r["status"] == "unmatched")
    manual = sum(1 for r in results if r["status"] == "manual")

    return {
        "total_rows": len(results),
        "matched": matched,
        "unmatched": unmatched,
        "manual_review": manual,
        "rows": results,
    }


async def _find_match(row_data):
    """
    Try to match a file row to a product instance.
    Priority: serial_number > lot_number > description
    Search in PLACED (3) and PICKED (4) statuses.
    """
    serial = row_data["serial_number"]
    lot = row_data["lot_number"]
    description = row_data["description"]
    mrn = row_data["mrn"]
    birth_date = row_data["birth_date"]

    instance = None
    match_method = None

    # 1. Try serial number match
    if serial:
        instance = await db.product_instances.find_one(
            {"serial_number": serial, "status": {"$in": [ProductStatus.PLACED, ProductStatus.PICKED]}},
            {"_id": 0}
        )
        if instance:
            match_method = "serial_number"

    # 2. Try lot number match
    if not instance and lot:
        instance = await db.product_instances.find_one(
            {"lot_number": lot, "status": {"$in": [ProductStatus.PLACED, ProductStatus.PICKED]}},
            {"_id": 0}
        )
        if instance:
            match_method = "lot_number"

    # 3. Try description match (fuzzy) — only if no serial/lot
    if not instance and not serial and not lot and description:
        # Find products matching by description
        products = await db.products.find(
            {"description": {"$regex": description.replace("(", "\\(").replace(")", "\\)"), "$options": "i"}},
            {"_id": 0, "id": 1}
        ).to_list(50)
        if products:
            product_ids = [p["id"] for p in products]
            instance = await db.product_instances.find_one(
                {"product_id": {"$in": product_ids}, "status": {"$in": [ProductStatus.PLACED, ProductStatus.PICKED]}},
                {"_id": 0}
            )
            if instance:
                match_method = "description"

    if not instance:
        return {
            "status": "unmatched" if (serial or lot) else "manual",
            "match_method": None,
            "instance_id": None,
            "instance_status": None,
            "instance_description": None,
            "instance_location": None,
            "mrn_match": False,
            "birth_date_match": False,
        }

    # Enrich instance with product info
    product = await db.products.find_one({"id": instance.get("product_id")}, {"_id": 0, "description": 1})
    instance_desc = product.get("description", "—") if product else "—"

    # Get location
    loc_code = None
    if instance.get("cabinet_location_id"):
        loc = await db.cabinet_locations.find_one({"id": instance["cabinet_location_id"]}, {"_id": 0, "code": 1})
        loc_code = loc.get("code") if loc else None

    # Check MRN + birth_date match against interventions
    mrn_match = False
    bd_match = False

    if mrn:
        # Check if this instance was picked for an intervention with matching MRN
        ip = await db.intervention_products.find_one(
            {"instance_id": instance["id"]},
            {"_id": 0, "intervention_id": 1}
        )
        if ip:
            intv = await db.interventions.find_one(
                {"id": ip["intervention_id"]},
                {"_id": 0, "patient_file_number": 1, "birth_date": 1}
            )
            if intv:
                mrn_match = normalize(intv.get("patient_file_number")) == normalize(mrn)
                if birth_date:
                    bd_match = normalize(intv.get("birth_date")) == normalize(birth_date)
        else:
            # For PLACED instances (not yet picked), check movements
            movement = await db.movements.find_one(
                {"instance_id": instance["id"], "type": {"$in": ["prélèvement", "picking", "picking_libre"]}},
                {"_id": 0, "reason": 1}
            )
            if movement and mrn in str(movement.get("reason", "")):
                mrn_match = True

    status_label = "en stock" if instance["status"] == ProductStatus.PLACED else "prélevé"

    return {
        "status": "matched",
        "match_method": match_method,
        "instance_id": instance["id"],
        "instance_status": instance["status"],
        "instance_status_label": status_label,
        "instance_description": instance_desc,
        "instance_location": loc_code,
        "mrn_match": mrn_match,
        "birth_date_match": bd_match,
    }


@router.post("/import/confirm")
async def import_confirm(data: dict, payload: dict = Depends(verify_token)):
    """
    Confirm consumption for matched instances.
    data: { rows: [{instance_id, mrn, birth_date, serial_number, lot_number, description, ...}] }
    """
    rows = data.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="Aucune ligne à confirmer")

    now = datetime.now(timezone.utc).isoformat()
    confirmed = 0
    skipped = 0
    errors = []

    for row in rows:
        instance_id = row.get("instance_id")
        if not instance_id:
            skipped += 1
            continue

        instance = await db.product_instances.find_one({"id": instance_id})
        if not instance:
            errors.append(f"Instance {instance_id} non trouvée")
            continue

        current_status = instance.get("status")

        if current_status == ProductStatus.PLACED:
            # Need to pick first, then consume
            # Free cabinet location
            if instance.get("cabinet_location_id"):
                await db.cabinet_locations.update_one(
                    {"id": instance["cabinet_location_id"]},
                    {"$set": {"is_empty": True}}
                )

            # Transition PLACED → CONSUMED directly
            await db.product_instances.update_one(
                {"id": instance_id},
                {"$set": {
                    "status": ProductStatus.CONSUMED,
                    "usage_date": now,
                    "picked_at": now,
                }}
            )

            # Record pick movement
            pick_mv = Movement(
                instance_id=instance_id,
                product_id=instance.get("product_id"),
                type="prélèvement",
                user_id=payload.get("id"),
                reason=f"Import fichier — MRN: {row.get('mrn', '—')}",
            )
            pick_doc = pick_mv.model_dump()
            pick_doc["timestamp"] = pick_doc["timestamp"].isoformat()
            await db.movements.insert_one(pick_doc)

            # Record consume movement
            consume_mv = Movement(
                instance_id=instance_id,
                product_id=instance.get("product_id"),
                type="consommation",
                user_id=payload.get("id"),
                reason=f"Import fichier — MRN: {row.get('mrn', '—')}",
            )
            consume_doc = consume_mv.model_dump()
            consume_doc["timestamp"] = consume_doc["timestamp"].isoformat()
            await db.movements.insert_one(consume_doc)

            confirmed += 1

        elif current_status == ProductStatus.PICKED:
            # Already picked, just consume
            await db.product_instances.update_one(
                {"id": instance_id},
                {"$set": {"status": ProductStatus.CONSUMED, "usage_date": now}}
            )

            consume_mv = Movement(
                instance_id=instance_id,
                product_id=instance.get("product_id"),
                type="consommation",
                user_id=payload.get("id"),
                reason=f"Import fichier — MRN: {row.get('mrn', '—')}",
            )
            consume_doc = consume_mv.model_dump()
            consume_doc["timestamp"] = consume_doc["timestamp"].isoformat()
            await db.movements.insert_one(consume_doc)

            confirmed += 1

        else:
            skipped += 1

    # Save import history
    history_record = {
        "id": str(uuid.uuid4()),
        "imported_at": now,
        "imported_by": payload.get("id"),
        "imported_by_name": payload.get("first_name", "") + " " + payload.get("last_name", ""),
        "total_rows": len(rows),
        "confirmed": confirmed,
        "skipped": skipped,
        "errors": errors,
    }
    await db.import_history.insert_one(history_record)

    await emit_event("inventory_changed", {})

    return {
        "confirmed": confirmed,
        "skipped": skipped,
        "errors": errors,
        "import_id": history_record["id"],
    }


@router.get("/imports")
async def get_import_history(payload: dict = Depends(verify_token)):
    """Get import history."""
    docs = await db.import_history.find({}, {"_id": 0}).sort("imported_at", -1).to_list(100)
    return docs
