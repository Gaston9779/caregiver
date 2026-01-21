from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db import Base, engine
from app.routers import auth, heartbeat, events, safe_zones, caregivers, devices
from app.services.scheduler import start_scheduler

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    start_scheduler()


@app.get("/")
def root():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(heartbeat.router)
app.include_router(events.router)
app.include_router(safe_zones.router)
app.include_router(caregivers.router)
app.include_router(devices.router)
