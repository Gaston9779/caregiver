from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_role
from app.models import CaregiverLink, User, CaregiverContact
from app.schemas import CaregiverLinkIn, CaregiverContactIn

router = APIRouter(prefix="/caregivers", tags=["caregivers"])


@router.post("/link")
def link_caregiver(payload: CaregiverLinkIn, db: Session = Depends(get_db), user=Depends(require_role("USER"))):
    caregiver = db.query(User).filter(User.email == payload.email, User.role == "CAREGIVER").first()
    if not caregiver:
        raise HTTPException(status_code=404, detail="Caregiver not found")
    existing = (
        db.query(CaregiverLink)
        .filter(CaregiverLink.user_id == user.id, CaregiverLink.caregiver_id == caregiver.id)
        .first()
    )
    if existing:
        return {"status": "already_linked"}
    db.add(CaregiverLink(user_id=user.id, caregiver_id=caregiver.id))
    db.commit()
    return {"status": "linked"}


@router.get("/linked")
def list_linked(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role == "USER":
        caregivers = (
            db.query(User)
            .join(CaregiverLink, CaregiverLink.caregiver_id == User.id)
            .filter(CaregiverLink.user_id == user.id)
            .all()
        )
        return [{"id": cg.id, "email": cg.email} for cg in caregivers]
    users = (
        db.query(User)
        .join(CaregiverLink, CaregiverLink.user_id == User.id)
        .filter(CaregiverLink.caregiver_id == user.id)
        .all()
    )
    return [{"id": u.id, "email": u.email} for u in users]


@router.post("/contact")
def set_contact(payload: CaregiverContactIn, db: Session = Depends(get_db), user=Depends(require_role("CAREGIVER"))):
    contact = db.query(CaregiverContact).filter(CaregiverContact.caregiver_id == user.id).first()
    if contact:
        contact.phone_number = payload.phone_number
    else:
        contact = CaregiverContact(caregiver_id=user.id, phone_number=payload.phone_number)
        db.add(contact)
    db.commit()
    return {"status": "saved"}


@router.get("/contact")
def get_contact(db: Session = Depends(get_db), user=Depends(require_role("CAREGIVER"))):
    contact = db.query(CaregiverContact).filter(CaregiverContact.caregiver_id == user.id).first()
    if not contact:
        return {"phone_number": None}
    return {"phone_number": contact.phone_number}
