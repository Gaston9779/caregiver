from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import Heartbeat, Event
from app.schemas import HeartbeatIn, HeartbeatOut

router = APIRouter(prefix="/heartbeat", tags=["heartbeat"])


@router.post("", response_model=HeartbeatOut)
def create_heartbeat(
    payload: HeartbeatIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("USER")),
):
    timestamp = payload.timestamp or datetime.utcnow()
    heartbeat = Heartbeat(user_id=user.id, timestamp=timestamp)
    db.add(heartbeat)
    db.query(Event).filter(Event.user_id == user.id, Event.status == "OPEN").update(
        {"status": "CANCELLED"}
    )
    db.commit()
    db.refresh(heartbeat)
    return heartbeat
