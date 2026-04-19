from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
import os
import logging
import sys
from pathlib import Path

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database import client, db
from sio import sio
from routes import auth, suppliers, categories_types, cabinets, products, employees, orders, interventions, instances, movements, hardware, consumption

fastapi_app = FastAPI(title="Chrono DMI v2", version="2.0.0")

# CORS
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "*"],
)


@fastapi_app.on_event("startup")
async def startup_indexes():
    try:
        await db.product_instances.create_index("serial_number", unique=True, sparse=True)
    except Exception:
        pass  # Index already exists


@fastapi_app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


# Register all routers
fastapi_app.include_router(auth.router)
fastapi_app.include_router(suppliers.router)
fastapi_app.include_router(categories_types.router)
fastapi_app.include_router(cabinets.router)
fastapi_app.include_router(products.router)
fastapi_app.include_router(employees.router)
fastapi_app.include_router(orders.router)
fastapi_app.include_router(interventions.router)
fastapi_app.include_router(instances.router)
fastapi_app.include_router(movements.router)
fastapi_app.include_router(hardware.router)
fastapi_app.include_router(consumption.router)


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# Wrap FastAPI with Socket.IO — uvicorn serves this as "server:app"
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
