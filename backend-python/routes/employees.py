from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import Employee, EmployeeCreate, EmployeeUpdate
from routes.auth import verify_token, _safe_employee
import bcrypt

router = APIRouter(prefix="/api/employees", tags=["employees"])

AVAILABLE_ROLES = [
    {"id": "administrateur", "name": "Administrateur", "description": "Accès complet à toutes les fonctionnalités"},
    {"id": "gestionnaire", "name": "Gestionnaire", "description": "Gestion des stocks, commandes, réception"},
    {"id": "technicien", "name": "Technicien", "description": "Opérations de stock"},
    {"id": "clinicien", "name": "Clinicien", "description": "Prélèvement de produits uniquement"},
    {"id": "lecture", "name": "Lecture seule", "description": "Consultation uniquement"},
]


@router.get("/roles")
async def get_roles(payload: dict = Depends(verify_token)):
    return AVAILABLE_ROLES


@router.get("")
async def get_employees(payload: dict = Depends(verify_token)):
    docs = await db.employees.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    result = []
    for doc in docs:
        doc["has_pin"] = bool(doc.pop("pin_hash", None))
        result.append(doc)
    return result


@router.get("/{employee_id}")
async def get_employee(employee_id: str, payload: dict = Depends(verify_token)):
    doc = await db.employees.find_one({"id": employee_id}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    doc["has_pin"] = bool(doc.pop("pin_hash", None))
    return doc


@router.post("")
async def create_employee(data: EmployeeCreate, payload: dict = Depends(verify_token)):
    requester = await db.employees.find_one({"id": payload["id"]}, {"role": 1})
    if not requester or requester.get("role") not in ["administrateur"]:
        raise HTTPException(status_code=403, detail="Seuls les administrateurs peuvent créer des employés")

    existing = await db.employees.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    if data.card_id:
        card_exists = await db.employees.find_one({"card_id": data.card_id})
        if card_exists:
            raise HTTPException(status_code=400, detail="ID de carte déjà utilisé")

    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

    emp = Employee(
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        card_id=data.card_id,
    )
    doc = emp.model_dump()
    doc["password_hash"] = password_hash
    doc["created_at"] = doc["created_at"].isoformat()

    if data.pin:
        doc["pin_hash"] = bcrypt.hashpw(data.pin.encode(), bcrypt.gensalt()).decode()

    await db.employees.insert_one(doc)
    return _safe_employee(doc)


@router.put("/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeUpdate, payload: dict = Depends(verify_token)):
    requester = await db.employees.find_one({"id": payload["id"]}, {"role": 1})
    if not requester or requester.get("role") not in ["administrateur"]:
        raise HTTPException(status_code=403, detail="Seuls les administrateurs peuvent modifier des employés")

    existing = await db.employees.find_one({"id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    update_data = {}

    if data.email and data.email != existing.get("email"):
        email_exists = await db.employees.find_one({"email": data.email, "id": {"$ne": employee_id}})
        if email_exists:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        update_data["email"] = data.email

    if data.first_name:
        update_data["first_name"] = data.first_name
    if data.last_name:
        update_data["last_name"] = data.last_name
    if data.role:
        update_data["role"] = data.role
    if data.password:
        update_data["password_hash"] = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    if data.pin:
        update_data["pin_hash"] = bcrypt.hashpw(data.pin.encode(), bcrypt.gensalt()).decode()
    if data.card_id is not None:
        if data.card_id and data.card_id != existing.get("card_id"):
            card_exists = await db.employees.find_one({"card_id": data.card_id, "id": {"$ne": employee_id}})
            if card_exists:
                raise HTTPException(status_code=400, detail="ID de carte déjà utilisé")
        update_data["card_id"] = data.card_id if data.card_id else None

    if update_data:
        await db.employees.update_one({"id": employee_id}, {"$set": update_data})

    updated = await db.employees.find_one({"id": employee_id}, {"_id": 0, "password_hash": 0})
    updated["has_pin"] = bool(updated.pop("pin_hash", None))
    return updated


@router.delete("/{employee_id}")
async def delete_employee(employee_id: str, payload: dict = Depends(verify_token)):
    requester = await db.employees.find_one({"id": payload["id"]}, {"role": 1})
    if not requester or requester.get("role") not in ["administrateur"]:
        raise HTTPException(status_code=403, detail="Seuls les administrateurs peuvent supprimer des employés")

    if employee_id == payload["id"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")

    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    return {"deleted": True}
