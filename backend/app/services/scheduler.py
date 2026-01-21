from __future__ import annotations

from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import SessionLocal
from app.models import Heartbeat, Event, Profile, User, CaregiverLink, DeviceToken, CaregiverContact
from app.services.notifications import notification_service

CALL_ATTEMPTS: set[int] = set()


def _inactivity_threshold(profile: Profile | None, now: datetime) -> timedelta:
    if profile and profile.risk_level == "high":
        return timedelta(hours=settings.inactivity_high_risk_hours)
    in_night = now.hour >= settings.night_start_hour or now.hour < settings.night_end_hour
    if in_night:
        return timedelta(hours=settings.inactivity_night_hours)
    return timedelta(hours=settings.inactivity_standard_hours)


def _cooldown_active(db: Session, user_id: int, now: datetime) -> bool:
    cutoff = now - timedelta(minutes=settings.alert_cooldown_minutes)
    recent = (
        db.query(Event)
        .filter(Event.user_id == user_id, Event.created_at >= cutoff)
        .first()
    )
    return recent is not None


def _create_event(db: Session, user_id: int, event_type: str) -> Event | None:
    now = datetime.utcnow()
    if _cooldown_active(db, user_id, now):
        return None
    event = Event(user_id=user_id, type=event_type, status="OPEN")
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def _notify_caregivers(db: Session, user_id: int, event: Event) -> None:
    caregiver_ids = [
        link.caregiver_id
        for link in db.query(CaregiverLink).filter(CaregiverLink.user_id == user_id).all()
    ]
    if not caregiver_ids:
        return
    tokens: list[str] = []
    phone_numbers: list[str] = []
    for caregiver_id in caregiver_ids:
        tokens.extend(
            [device.token for device in db.query(DeviceToken).filter(DeviceToken.user_id == caregiver_id).all()]
        )
        contact = (
            db.query(CaregiverContact).filter(CaregiverContact.caregiver_id == caregiver_id).first()
        )
        if contact and contact.phone_number:
            phone_numbers.append(contact.phone_number)
    title = "Allerta sicurezza"
    body = f"Evento {event.type} per utente {user_id}"
    notification_service.send_push(list(set(tokens)), title, body)
    notification_service.make_call(list(set(phone_numbers)), body)


def check_inactivity() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        users = db.query(User).all()
        for user in users:
            if user.role != "USER":
                continue
            last_hb = (
                db.query(Heartbeat)
                .filter(Heartbeat.user_id == user.id)
                .order_by(Heartbeat.timestamp.desc())
                .first()
            )
            profile = db.query(Profile).filter(Profile.user_id == user.id).first()
            threshold = _inactivity_threshold(profile, now)
            if not last_hb or now - last_hb.timestamp > threshold:
                event = _create_event(db, user.id, "INACTIVITY")
                if event:
                    _notify_caregivers(db, user.id, event)
    finally:
        db.close()


def check_call_fallbacks() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        cutoff = now - timedelta(minutes=settings.call_delay_minutes)
        open_events = db.query(Event).filter(Event.status == "OPEN", Event.created_at <= cutoff).all()
        for event in open_events:
            if event.id in CALL_ATTEMPTS:
                continue
            _notify_caregivers(db, event.user_id, event)
            CALL_ATTEMPTS.add(event.id)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_inactivity, "interval", minutes=15, id="check_inactivity")
    scheduler.add_job(check_call_fallbacks, "interval", minutes=5, id="check_call_fallbacks")
    scheduler.start()
    return scheduler
