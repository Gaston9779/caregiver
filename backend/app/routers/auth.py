from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.db import get_db
from app.models import User, Profile
from app.schemas import Token, UserOut, RegisterIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if payload.role not in {"USER", "CAREGIVER"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    if payload.role == "USER" and (payload.name is None or payload.age is None):
        raise HTTPException(status_code=400, detail="Profile required for USER")
    user = User(email=payload.email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    if payload.role == "USER":
        risk = payload.risk_level or "standard"
        db.add(Profile(user_id=user.id, name=payload.name, age=payload.age, risk_level=risk))
        db.commit()
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token(str(user.id))
    return Token(access_token=token)
