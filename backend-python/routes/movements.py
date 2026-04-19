from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from database import db
from models import Movement
from routes.auth import verify_token
from datetime import datetime, timezone
import pytz
import io

router = APIRouter(prefix="/api/movements", tags=["movements"])

ET = pytz.timezone("America/Toronto")

TYPE_LABELS = {
    "commande": "Commandé", "reception": "Réception", "placement": "Placement",
    "prelevement": "Prélèvement", "retour": "Retour", "consommation": "Consommation",
    "facturation": "Facturation", "picking_libre": "Picking Libre",
}


async def _get_enriched_movements():
    docs = await db.movements.find({}, {"_id": 0}).sort("timestamp", -1).to_list(5000)

    product_ids = list(set(d.get("product_id") for d in docs if d.get("product_id")))
    user_ids = list(set(d.get("user_id") for d in docs if d.get("user_id")))
    instance_ids = list(set(d.get("instance_id") for d in docs if d.get("instance_id")))

    products_map = {}
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
        products_map = {p["id"]: p for p in products}

    users_map = {}
    if user_ids:
        users = await db.employees.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0, "pin_hash": 0}).to_list(1000)
        users_map = {u["id"]: u for u in users}

    instances_map = {}
    if instance_ids:
        instances = await db.product_instances.find({"id": {"$in": instance_ids}}, {"_id": 0}).to_list(5000)
        instances_map = {i["id"]: i for i in instances}

    for doc in docs:
        doc["product"] = products_map.get(doc.get("product_id"), {})
        user = users_map.get(doc.get("user_id"), {})
        doc["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else ""
        instance = instances_map.get(doc.get("instance_id"), {})
        doc["serial_number"] = instance.get("serial_number", "")
        doc["lot_number"] = instance.get("lot_number", "")

    return docs


@router.get("")
async def get_movements(payload: dict = Depends(verify_token)):
    return await _get_enriched_movements()


def _to_et_str(ts_str):
    """Convert ISO timestamp string to ET formatted string."""
    if not ts_str:
        return ""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return dt.astimezone(ET).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ts_str


@router.get("/export/excel")
async def export_excel(
    date_from: str = Query(None),
    date_to: str = Query(None),
    type: str = Query(None),
    serial_number: str = Query(None),
    lot_number: str = Query(None),
    payload: dict = Depends(verify_token),
):
    import xlsxwriter

    docs = await _get_enriched_movements()
    docs = _apply_filters(docs, date_from, date_to, type, serial_number, lot_number)

    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {"in_memory": True})
    ws = wb.add_worksheet("Mouvements")

    headers = ["Date/Heure", "Type", "Produit", "N° Série", "N° Lot", "Emplacement", "Utilisateur", "Détail"]
    header_fmt = wb.add_format({"bold": True, "bg_color": "#f1f5f9", "border": 1})
    cell_fmt = wb.add_format({"border": 1, "text_wrap": True})

    for col, h in enumerate(headers):
        ws.write(0, col, h, header_fmt)

    ws.set_column(0, 0, 20)
    ws.set_column(1, 1, 14)
    ws.set_column(2, 2, 45)
    ws.set_column(3, 4, 14)
    ws.set_column(5, 5, 20)
    ws.set_column(6, 6, 16)
    ws.set_column(7, 7, 40)

    for row_idx, m in enumerate(docs, 1):
        ws.write(row_idx, 0, _to_et_str(m.get("timestamp", "")), cell_fmt)
        ws.write(row_idx, 1, TYPE_LABELS.get(m.get("type"), m.get("type", "")), cell_fmt)
        ws.write(row_idx, 2, m.get("product", {}).get("description", ""), cell_fmt)
        ws.write(row_idx, 3, m.get("serial_number", ""), cell_fmt)
        ws.write(row_idx, 4, m.get("lot_number", ""), cell_fmt)
        ws.write(row_idx, 5, m.get("location_code", ""), cell_fmt)
        ws.write(row_idx, 6, m.get("user_name", ""), cell_fmt)
        ws.write(row_idx, 7, m.get("reason", ""), cell_fmt)

    wb.close()
    output.seek(0)

    filename = f"mouvements_{datetime.now(ET).strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/pdf")
async def export_pdf(
    date_from: str = Query(None),
    date_to: str = Query(None),
    type: str = Query(None),
    serial_number: str = Query(None),
    lot_number: str = Query(None),
    payload: dict = Depends(verify_token),
):
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch

    docs = await _get_enriched_movements()
    docs = _apply_filters(docs, date_from, date_to, type, serial_number, lot_number)

    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(letter), leftMargin=0.4*inch, rightMargin=0.4*inch, topMargin=0.5*inch, bottomMargin=0.4*inch)

    styles = getSampleStyleSheet()
    elements = []

    title = f"Mouvements — {datetime.now(ET).strftime('%Y-%m-%d %H:%M')}"
    if date_from or date_to:
        title += f" (Période: {date_from or '...'} à {date_to or '...'})"
    elements.append(Paragraph(title, styles["Title"]))
    elements.append(Spacer(1, 12))

    cell_style = styles["Normal"]
    cell_style.fontSize = 7
    cell_style.leading = 9

    headers = ["Date/Heure", "Type", "Produit", "N° Série", "N° Lot", "Emplacement", "Utilisateur", "Détail"]
    data = [headers]

    for m in docs:
        data.append([
            _to_et_str(m.get("timestamp", "")),
            TYPE_LABELS.get(m.get("type"), m.get("type", "")),
            Paragraph(m.get("product", {}).get("description", "")[:60], cell_style),
            m.get("serial_number", ""),
            m.get("lot_number", ""),
            m.get("location_code", ""),
            m.get("user_name", ""),
            Paragraph(m.get("reason", "")[:80], cell_style),
        ])

    col_widths = [1.2*inch, 0.9*inch, 2.5*inch, 0.9*inch, 0.9*inch, 1.2*inch, 1.0*inch, 2.0*inch]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))

    elements.append(table)
    doc.build(elements)
    output.seek(0)

    filename = f"mouvements_{datetime.now(ET).strftime('%Y%m%d_%H%M%S')}.pdf"
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _apply_filters(docs, date_from, date_to, type_filter, serial_number, lot_number):
    result = docs
    if type_filter:
        result = [d for d in result if d.get("type") == type_filter]
    if date_from:
        result = [d for d in result if _to_et_date(d.get("timestamp")) >= date_from]
    if date_to:
        result = [d for d in result if _to_et_date(d.get("timestamp")) <= date_to]
    if serial_number:
        sn_lower = serial_number.lower()
        result = [d for d in result if sn_lower in (d.get("serial_number") or "").lower()]
    if lot_number:
        lot_lower = lot_number.lower()
        result = [d for d in result if lot_lower in (d.get("lot_number") or "").lower()]
    return result


def _to_et_date(ts_str):
    if not ts_str:
        return ""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return dt.astimezone(ET).strftime("%Y-%m-%d")
    except Exception:
        return ""
