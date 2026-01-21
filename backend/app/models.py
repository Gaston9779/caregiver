from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    profile = relationship("Profile", back_populates="user", uselist=False)


class Profile(Base):
    __tablename__ = "profiles"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    risk_level = Column(String, nullable=False, default="standard")

    user = relationship("User", back_populates="profile")


class CaregiverLink(Base):
    __tablename__ = "caregiver_links"
    __table_args__ = (UniqueConstraint("user_id", "caregiver_id", name="uq_user_caregiver"),)

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    caregiver_id = Column(Integer, ForeignKey("users.id"), primary_key=True)


class Heartbeat(Base):
    __tablename__ = "heartbeats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


class SafeZone(Base):
    __tablename__ = "safe_zones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Integer, nullable=False)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="OPEN")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    platform = Column(String, nullable=False, default="web")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CaregiverContact(Base):
    __tablename__ = "caregiver_contacts"

    caregiver_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    phone_number = Column(String, nullable=False)
