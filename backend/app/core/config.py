from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Caregiver Safety MVP"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/caregiver"
    heartbeat_interval_minutes: int = 45
    inactivity_standard_hours: int = 8
    inactivity_night_hours: int = 12
    inactivity_high_risk_hours: int = 4
    night_start_hour: int = 22
    night_end_hour: int = 7
    alert_cooldown_minutes: int = 60
    call_delay_minutes: int = 10
    fcm_server_key: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
