from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import SafeZone
from app.schemas import SafeZoneIn, SafeZoneOut

router = APIRouter(prefix="/safe-zones", tags=["safe_zones"])


@router.get("", response_model=list[SafeZoneOut])
def list_safe_zones(db: Session = Depends(get_db), user=Depends(require_role("USER"))):
    return db.query(SafeZone).filter(SafeZone.user_id == user.id).all()


@router.post("", response_model=SafeZoneOut)
def upsert_safe_zone(payload: SafeZoneIn, db: Session = Depends(get_db), user=Depends(require_role("USER"))):
    zone = db.query(SafeZone).filter(SafeZone.user_id == user.id).first()
    if zone:
        zone.latitude = payload.latitude
        zone.longitude = payload.longitude
        zone.radius_meters = payload.radius_meters
    else:
        zone = SafeZone(
            user_id=user.id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            radius_meters=payload.radius_meters,
        )
        db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone
