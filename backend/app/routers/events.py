from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Event, CaregiverLink
from app.services.scheduler import _create_event, _notify_caregivers
from app.schemas import EventOut, EventAction, EventCreate

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role == "USER":
        return db.query(Event).filter(Event.user_id == user.id).order_by(Event.created_at.desc()).all()
    caregiver_links = db.query(CaregiverLink).filter(CaregiverLink.caregiver_id == user.id).all()
    user_ids = [link.user_id for link in caregiver_links]
    if not user_ids:
        return []
    return db.query(Event).filter(Event.user_id.in_(user_ids)).order_by(Event.created_at.desc()).all()


@router.post("/{event_id}/action", response_model=EventOut)
def action_event(
    event_id: int,
    payload: EventAction,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    allowed = False
    if user.role == "USER" and event.user_id == user.id:
        allowed = True
    if user.role == "CAREGIVER":
        link = (
            db.query(CaregiverLink)
            .filter(CaregiverLink.user_id == event.user_id, CaregiverLink.caregiver_id == user.id)
            .first()
        )
        allowed = link is not None
    if not allowed:
        raise HTTPException(status_code=403, detail="Not allowed")
    if payload.action not in {"CONFIRM", "CANCEL"}:
        raise HTTPException(status_code=400, detail="Invalid action")
    event.status = "CONFIRMED" if payload.action == "CONFIRM" else "CANCELLED"
    db.commit()
    db.refresh(event)
    return event


@router.post("/sos", response_model=EventOut)
def manual_sos(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role != "USER":
        raise HTTPException(status_code=403, detail="Only USER can send SOS")
    event = _create_event(db, user.id, "MANUAL_SOS")
    if not event:
        raise HTTPException(status_code=429, detail="Cooldown active")
    _notify_caregivers(db, user.id, event)
    return event


@router.post("/auto", response_model=EventOut)
def auto_event(payload: EventCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role != "USER":
        raise HTTPException(status_code=403, detail="Only USER can create auto events")
    if payload.type not in {"GEOFENCE_EXIT", "FALL"}:
        raise HTTPException(status_code=400, detail="Invalid event type")
    event = _create_event(db, user.id, payload.type)
    if not event:
        raise HTTPException(status_code=429, detail="Cooldown active")
    _notify_caregivers(db, user.id, event)
    return event
