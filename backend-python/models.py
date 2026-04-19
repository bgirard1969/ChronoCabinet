from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
from enum import IntEnum
import uuid


# ============= ENUMS =============

class ProductStatus(IntEnum):
    ORDERED = 1
    RECEIVED = 2
    PLACED = 3
    PICKED = 4
    CONSUMED = 5
    INVOICED = 6

PRODUCT_STATUS_LABELS = {
    ProductStatus.ORDERED: "Commandé",
    ProductStatus.RECEIVED: "Réceptionné",
    ProductStatus.PLACED: "Placé",
    ProductStatus.PICKED: "Prélevé",
    ProductStatus.CONSUMED: "Consommé",
    ProductStatus.INVOICED: "Facturé",
}


# ============= EMPLOYEES / AUTH =============

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "clinicien"  # administrateur | gestionnaire | technicien | clinicien | lecture
    pin_hash: Optional[str] = None
    card_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "clinicien"
    pin: Optional[str] = None
    card_id: Optional[str] = None

class EmployeeUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    pin: Optional[str] = None
    password: Optional[str] = None
    card_id: Optional[str] = None

class EmployeeLogin(BaseModel):
    email: EmailStr
    password: str

class EmployeeLoginCard(BaseModel):
    card_id: str

class EmployeeLoginPin(BaseModel):
    pin: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


# ============= SUPPLIERS =============

class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # max 50
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupplierCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


# ============= PRODUCT CATEGORIES =============

class ProductCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str  # max 50, e.g. "Catheter", "Pacemaker"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCategoryCreate(BaseModel):
    description: str


# ============= PRODUCT TYPES =============

class ProductType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str  # max 50, e.g. "NC EMERGE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductTypeCreate(BaseModel):
    description: str


# ============= PRODUCT SPECIFICATIONS =============

class ProductSpecification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str  # max 80, e.g. "3.00 mm x 08 mm"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductSpecificationCreate(BaseModel):
    description: str


# ============= CABINETS =============

class Cabinet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str  # max 50
    columns: int
    rows: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CabinetCreate(BaseModel):
    description: str
    columns: int
    rows: int

class CabinetUpdate(BaseModel):
    description: Optional[str] = None


# ============= CABINET LOCATIONS =============

class CabinetLocation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cabinet_id: str
    product_id: Optional[str] = None  # Designated product for this location
    row: int
    column: int
    is_empty: bool = True
    instance_id: Optional[str] = None  # Currently placed ProductInstance
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CabinetLocationUpdate(BaseModel):
    product_id: Optional[str] = None  # Assign/unassign designated product


# ============= PRODUCTS =============

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    type_id: str
    category_id: str
    description: str  # max 80
    specification: Optional[str] = None  # Legacy free-text, replaced by specification_id
    specification_id: Optional[str] = None
    grm_number: Optional[str] = None
    quantity_in_stock: int = 0  # Computed from instances with status PLACED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    supplier_id: str
    type_id: str
    category_id: str
    description: str
    specification: Optional[str] = None
    specification_id: Optional[str] = None
    grm_number: Optional[str] = None

class ProductUpdate(BaseModel):
    supplier_id: Optional[str] = None
    type_id: Optional[str] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    specification: Optional[str] = None
    specification_id: Optional[str] = None
    grm_number: Optional[str] = None


# ============= PRODUCT INSTANCES =============

class ProductInstance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    cabinet_location_id: Optional[str] = None
    serial_number: Optional[str] = None  # max 255, unique if present
    lot_number: Optional[str] = None
    expiration_date: Optional[datetime] = None
    usage_date: Optional[datetime] = None
    reception_date: Optional[datetime] = None
    status: int = ProductStatus.ORDERED
    order_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductInstanceCreate(BaseModel):
    product_id: str
    serial_number: Optional[str] = None
    lot_number: Optional[str] = None
    expiration_date: Optional[datetime] = None
    status: int = ProductStatus.ORDERED
    order_id: Optional[str] = None

class ProductInstanceReceive(BaseModel):
    """Used when receiving ordered items - adds instance details"""
    serial_number: str
    lot_number: Optional[str] = None
    expiration_date: Optional[datetime] = None


# ============= ORDERS =============

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    creation_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    order_date: Optional[datetime] = None  # null = draft/not sent
    grm_number: Optional[str] = None
    status: str = "draft"  # draft | sent | partially_received | received | closed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    supplier_id: str
    grm_number: Optional[str] = None
    items: List[dict]  # [{product_id, quantity}]

class OrderItemAdd(BaseModel):
    product_id: str
    quantity: int


# ============= INTERVENTIONS =============

class Intervention(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    planned_datetime: datetime
    operating_room: Optional[str] = None
    surgeon: Optional[str] = None
    patient_file_number: Optional[str] = None
    birth_date: Optional[str] = None
    status: str = "planned"  # planned | in_progress | completed | cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InterventionCreate(BaseModel):
    planned_datetime: datetime
    operating_room: Optional[str] = None
    surgeon: Optional[str] = None
    patient_file_number: Optional[str] = None
    birth_date: Optional[str] = None
    products: List[dict] = []  # [{product_id, required_quantity}]

class InterventionUpdate(BaseModel):
    planned_datetime: Optional[datetime] = None
    operating_room: Optional[str] = None
    surgeon: Optional[str] = None
    patient_file_number: Optional[str] = None
    birth_date: Optional[str] = None
    status: Optional[str] = None

class InterventionProduct(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    intervention_id: str
    product_id: Optional[str] = None
    category_id: Optional[str] = None
    type_id: Optional[str] = None
    specification_id: Optional[str] = None
    instance_id: Optional[str] = None
    serial_number: Optional[str] = None
    required_quantity: int = 1
    picked_quantity: int = 0


# ============= MOVEMENTS (Audit Log) =============

class Movement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    instance_id: Optional[str] = None
    product_id: Optional[str] = None
    type: str  # entree | sortie | placement | prelevement | retour | reception
    quantity: int = 1
    user_id: Optional[str] = None
    reason: Optional[str] = None
    location_code: Optional[str] = None
    intervention_id: Optional[str] = None
    order_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
