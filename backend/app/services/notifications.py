from __future__ import annotations

import logging
import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    def send_push(self, tokens: list[str], title: str, body: str) -> None:
        if not tokens:
            return
        if not settings.fcm_server_key:
            logger.warning("FCM server key missing, skipping push")
            return
        payload = {
            "registration_ids": tokens,
            "notification": {"title": title, "body": body},
        }
        headers = {
            "Authorization": f"key={settings.fcm_server_key}",
            "Content-Type": "application/json",
        }
        try:
            requests.post("https://fcm.googleapis.com/fcm/send", json=payload, headers=headers, timeout=10)
        except requests.RequestException as exc:
            logger.error("Push notification failed: %s", exc)

    def make_call(self, phone_numbers: list[str], message: str) -> None:
        if not phone_numbers:
            return
        if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
            logger.warning("Twilio not configured, skipping call")
            return
        try:
            from twilio.rest import Client
        except Exception:
            logger.warning("Twilio SDK not installed")
            return
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        for number in phone_numbers:
            try:
                client.calls.create(
                    to=number,
                    from_=settings.twilio_from_number,
                    twiml=f"<Response><Say>{message}</Say></Response>",
                )
            except Exception as exc:
                logger.error("Call failed for %s: %s", number, exc)


notification_service = NotificationService()
