from fastapi import APIRouter, Depends
from routes.auth import verify_token

router = APIRouter(prefix="/api/hardware", tags=["hardware"])


@router.post("/cabinets/{cabinet_id}/unlock")
async def unlock_cabinet(cabinet_id: str, payload: dict = Depends(verify_token)):
    """Stub: Unlock a physical cabinet"""
    return {"cabinet_id": cabinet_id, "locked": False, "message": "Cabinet déverrouillé (stub)"}


@router.post("/cabinets/{cabinet_id}/lock")
async def lock_cabinet(cabinet_id: str, payload: dict = Depends(verify_token)):
    """Stub: Lock a physical cabinet"""
    return {"cabinet_id": cabinet_id, "locked": True, "message": "Cabinet verrouillé (stub)"}


@router.post("/locations/{location_id}/led")
async def control_led(location_id: str, data: dict = None, payload: dict = Depends(verify_token)):
    """Stub: Control LED indicator for a cabinet location"""
    color = data.get("color", "green") if data else "green"
    on = data.get("on", True) if data else True
    return {"location_id": location_id, "color": color, "on": on, "message": "LED contrôlée (stub)"}


@router.get("/locations/{location_id}/presence")
async def check_presence(location_id: str, payload: dict = Depends(verify_token)):
    """Stub: Check presence detector for a cabinet location"""
    return {"location_id": location_id, "has_product": True, "message": "Détecteur de présence (stub)"}


@router.post("/emergency")
async def emergency_unlock(data: dict = None, payload: dict = Depends(verify_token)):
    """Stub: Emergency unlock all cabinets"""
    return {"emergency": True, "all_unlocked": True, "message": "Urgence activée - tous les cabinets déverrouillés (stub)"}
