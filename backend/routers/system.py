from fastapi import APIRouter, Depends

import services.system_service as system_service
from models.system import SystemInfo

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/info", response_model=SystemInfo)
def get_system_info(
    identity: system_service.AppIdentity = Depends(system_service.get_app_identity),
) -> SystemInfo:
    return SystemInfo(**system_service.get_system_info(identity))
