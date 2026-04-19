from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import (
    ProductCategory, ProductCategoryCreate,
    ProductType, ProductTypeCreate,
    ProductSpecification, ProductSpecificationCreate,
)
from routes.auth import verify_token

router = APIRouter(prefix="/api", tags=["categories-types"])


# ============= PRODUCT CATEGORIES =============

@router.get("/product-categories")
async def get_categories(payload: dict = Depends(verify_token)):
    docs = await db.product_categories.find({}, {"_id": 0}).to_list(1000)
    return docs


@router.post("/product-categories")
async def create_category(data: ProductCategoryCreate, payload: dict = Depends(verify_token)):
    existing = await db.product_categories.find_one({"description": data.description})
    if existing:
        raise HTTPException(status_code=400, detail="Cette catégorie existe déjà")

    cat = ProductCategory(**data.model_dump())
    doc = cat.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.product_categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/product-categories/{cat_id}")
async def update_category(cat_id: str, data: ProductCategoryCreate, payload: dict = Depends(verify_token)):
    existing = await db.product_categories.find_one({"id": cat_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    await db.product_categories.update_one({"id": cat_id}, {"$set": {"description": data.description}})
    updated = await db.product_categories.find_one({"id": cat_id}, {"_id": 0})
    return updated


@router.delete("/product-categories/{cat_id}")
async def delete_category(cat_id: str, payload: dict = Depends(verify_token)):
    used = await db.products.find_one({"category_id": cat_id})
    if used:
        raise HTTPException(status_code=400, detail="Catégorie utilisée par des produits")

    result = await db.product_categories.delete_one({"id": cat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")
    return {"deleted": True}


# ============= PRODUCT TYPES =============

@router.get("/product-types")
async def get_types(payload: dict = Depends(verify_token)):
    docs = await db.product_types.find({}, {"_id": 0}).to_list(1000)
    return docs


@router.post("/product-types")
async def create_type(data: ProductTypeCreate, payload: dict = Depends(verify_token)):
    existing = await db.product_types.find_one({"description": data.description})
    if existing:
        raise HTTPException(status_code=400, detail="Ce type existe déjà")

    pt = ProductType(**data.model_dump())
    doc = pt.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.product_types.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/product-types/{type_id}")
async def update_type(type_id: str, data: ProductTypeCreate, payload: dict = Depends(verify_token)):
    existing = await db.product_types.find_one({"id": type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Type non trouvé")

    await db.product_types.update_one({"id": type_id}, {"$set": {"description": data.description}})
    updated = await db.product_types.find_one({"id": type_id}, {"_id": 0})
    return updated


@router.delete("/product-types/{type_id}")
async def delete_type(type_id: str, payload: dict = Depends(verify_token)):
    used = await db.products.find_one({"type_id": type_id})
    if used:
        raise HTTPException(status_code=400, detail="Type utilisé par des produits")

    result = await db.product_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Type non trouvé")
    return {"deleted": True}


# ============= PRODUCT SPECIFICATIONS =============

@router.get("/product-specifications")
async def get_specifications(payload: dict = Depends(verify_token)):
    docs = await db.product_specifications.find({}, {"_id": 0}).to_list(1000)
    return docs


@router.post("/product-specifications")
async def create_specification(data: ProductSpecificationCreate, payload: dict = Depends(verify_token)):
    existing = await db.product_specifications.find_one({"description": data.description})
    if existing:
        raise HTTPException(status_code=400, detail="Cette spécification existe déjà")

    spec = ProductSpecification(**data.model_dump())
    doc = spec.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.product_specifications.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/product-specifications/{spec_id}")
async def update_specification(spec_id: str, data: ProductSpecificationCreate, payload: dict = Depends(verify_token)):
    existing = await db.product_specifications.find_one({"id": spec_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Spécification non trouvée")

    await db.product_specifications.update_one({"id": spec_id}, {"$set": {"description": data.description}})
    updated = await db.product_specifications.find_one({"id": spec_id}, {"_id": 0})
    return updated


@router.delete("/product-specifications/{spec_id}")
async def delete_specification(spec_id: str, payload: dict = Depends(verify_token)):
    used = await db.products.find_one({"specification_id": spec_id})
    if used:
        raise HTTPException(status_code=400, detail="Spécification utilisée par des produits")

    result = await db.product_specifications.delete_one({"id": spec_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Spécification non trouvée")
    return {"deleted": True}
