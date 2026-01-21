from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import DeviceToken
from app.schemas import DeviceTokenIn, DeviceTokenOut

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/register", response_model=DeviceTokenOut)
def register_device(payload: DeviceTokenIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if existing:
        existing.user_id = user.id
        existing.platform = payload.platform
        db.commit()
        db.refresh(existing)
        return existing
    device = DeviceToken(user_id=user.id, token=payload.token, platform=payload.platform)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device
