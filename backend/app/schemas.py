from datetime import datetime
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str


class RegisterIn(UserCreate):
    name: str | None = None
    age: int | None = None
    risk_level: str | None = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileCreate(BaseModel):
    name: str
    age: int
    risk_level: str = "standard"


class ProfileOut(BaseModel):
    user_id: int
    name: str
    age: int
    risk_level: str

    class Config:
        from_attributes = True


class HeartbeatIn(BaseModel):
    timestamp: datetime | None = None


class HeartbeatOut(BaseModel):
    user_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class SafeZoneIn(BaseModel):
    latitude: float
    longitude: float
    radius_meters: int


class SafeZoneOut(SafeZoneIn):
    id: int
    user_id: int

    class Config:
        from_attributes = True


class EventOut(BaseModel):
    id: int
    user_id: int
    type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EventAction(BaseModel):
    action: str


class EventCreate(BaseModel):
    type: str


class CaregiverLinkIn(BaseModel):
    email: EmailStr


class DeviceTokenIn(BaseModel):
    token: str
    platform: str = "web"


class DeviceTokenOut(DeviceTokenIn):
    id: int
    user_id: int

    class Config:
        from_attributes = True


class CaregiverContactIn(BaseModel):
    phone_number: str
