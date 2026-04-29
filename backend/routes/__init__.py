from fastapi import APIRouter

from .auth import router as auth_router
from .competitions import router as competitions_router
from .teams import router as teams_router
from .dashboard import router as dashboard_router
from .data import router as data_router
from .settings import router as settings_router
# Single router consumed by main.py
from .validation import router as validation_router
router = APIRouter()
router.include_router(auth_router)
router.include_router(competitions_router)
router.include_router(teams_router)
router.include_router(settings_router)
router.include_router(dashboard_router)
router.include_router(data_router)
router.include_router(validation_router)