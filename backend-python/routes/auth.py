from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from database import db
from models import (
    Employee, EmployeeCreate, EmployeeUpdate, EmployeeLogin,
    EmployeeLoginCard, EmployeeLoginPin, Token
)
import jwt
import bcrypt
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours for hospital shifts

security = HTTPBearer()


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")


def _safe_employee(doc: dict) -> dict:
    """Return employee dict without sensitive fields"""
    return {
        "id": doc.get("id"),
        "email": doc.get("email"),
        "first_name": doc.get("first_name"),
        "last_name": doc.get("last_name"),
        "role": doc.get("role"),
        "card_id": doc.get("card_id"),
        "has_pin": bool(doc.get("pin_hash")),
        "created_at": doc.get("created_at"),
    }


@router.post("/register", response_model=Token)
async def register(data: EmployeeCreate):
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

    token = create_access_token({"sub": emp.email, "id": emp.id, "role": emp.role})
    return Token(access_token=token, token_type="bearer", user=_safe_employee(doc))


@router.post("/login", response_model=Token)
async def login(credentials: EmployeeLogin):
    doc = await db.employees.find_one({"email": credentials.email}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not bcrypt.checkpw(credentials.password.encode(), doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    token = create_access_token({"sub": doc["email"], "id": doc["id"], "role": doc.get("role", "clinicien")})
    return Token(access_token=token, token_type="bearer", user=_safe_employee(doc))


@router.post("/login-card", response_model=Token)
async def login_card(credentials: EmployeeLoginCard):
    card_id = credentials.card_id.strip()
    if not card_id:
        raise HTTPException(status_code=400, detail="ID de carte requis")

    doc = await db.employees.find_one({"card_id": card_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="Carte non reconnue")

    token = create_access_token({"sub": doc["email"], "id": doc["id"], "role": doc.get("role", "clinicien")})
    return Token(access_token=token, token_type="bearer", user=_safe_employee(doc))


@router.post("/login-pin", response_model=Token)
async def login_pin(credentials: EmployeeLoginPin):
    """Login via numeric PIN (for light client numpad)"""
    pin = credentials.pin.strip()
    if not pin:
        raise HTTPException(status_code=400, detail="NIP requis")

    employees = await db.employees.find({"pin_hash": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(500)

    for emp in employees:
        try:
            if bcrypt.checkpw(pin.encode(), emp["pin_hash"].encode()):
                token = create_access_token({"sub": emp["email"], "id": emp["id"], "role": emp.get("role", "clinicien")})
                return Token(access_token=token, token_type="bearer", user=_safe_employee(emp))
        except Exception:
            continue

    raise HTTPException(status_code=401, detail="NIP invalide")


@router.get("/me")
async def get_current_user(payload: dict = Depends(verify_token)):
    doc = await db.employees.find_one({"id": payload["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return _safe_employee(doc)
