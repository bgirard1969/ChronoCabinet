from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import Supplier, SupplierCreate
from routes.auth import verify_token

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("")
async def get_suppliers(payload: dict = Depends(verify_token)):
    docs = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    return docs


@router.get("/{supplier_id}")
async def get_supplier(supplier_id: str, payload: dict = Depends(verify_token)):
    doc = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    return doc


@router.post("")
async def create_supplier(data: SupplierCreate, payload: dict = Depends(verify_token)):
    existing = await db.suppliers.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Ce fournisseur existe déjà")

    supplier = Supplier(**data.model_dump())
    doc = supplier.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{supplier_id}")
async def update_supplier(supplier_id: str, data: SupplierCreate, payload: dict = Depends(verify_token)):
    existing = await db.suppliers.find_one({"id": supplier_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.suppliers.update_one({"id": supplier_id}, {"$set": update_data})

    updated = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    return updated


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str, payload: dict = Depends(verify_token)):
    # Check if used by products
    product_using = await db.products.find_one({"supplier_id": supplier_id})
    if product_using:
        raise HTTPException(status_code=400, detail="Ce fournisseur est utilisé par des produits")

    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    return {"deleted": True}
