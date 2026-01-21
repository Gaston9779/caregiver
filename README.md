# Caregiver Safety MVP

Prototipo full-stack per monitorare persone fragili o che vivono sole. L'app **non** e un dispositivo medico: fornisce supporto di sicurezza basato su attivita e interazione.

## Stack
- Backend: FastAPI + JWT + scheduler interno
- Frontend: React SPA mobile-first
- DB: PostgreSQL
- Hosting: Render (free tier)

## Schema DB
Schema SQL: `backend/schema.sql`

## Avvio locale

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Apri `http://localhost:5173`.

## API REST (principali)
- `POST /auth/register` Registrazione USER/CAREGIVER
- `POST /auth/login` Login (OAuth2 password)
- `POST /heartbeat` Heartbeat manuale o automatico (USER)
- `POST /events/sos` SOS manuale (USER)
- `POST /events/auto` Eventi automatici (GEOFENCE_EXIT, FALL)
- `POST /events/{id}/action` Conferma o annulla evento
- `GET /events` Lista eventi per USER o CAREGIVER
- `POST /safe-zones` Imposta zona sicura (USER)
- `GET /safe-zones` Lista zone sicure
- `POST /caregivers/link` Associa caregiver con email
- `GET /caregivers/linked` Lista associazioni
- `POST /caregivers/contact` Salva telefono caregiver
- `GET /caregivers/contact` Legge telefono caregiver
- `POST /devices/register` Registra token push per notifiche

Documentazione interattiva: `http://localhost:8000/docs`

## Logica core implementata
- Heartbeat automatico ogni 45 minuti dal frontend
- Scheduler backend per inattivita (soglie standard/notte/alto rischio)
- Cooldown 1 alert/ora
- Eventi cancellabili con check-in manuale
- Geofence e rilevamento caduta (best effort) lato frontend
- SOS manuale sempre disponibile

## Notifiche (prototipo)
- Push: supporto Firebase FCM (richiede `FCM_SERVER_KEY`)
- Chiamata: supporto Twilio se configurato (richiede credenziali)

Nel prototipo, se le credenziali non sono presenti, le notifiche vengono loggate.

## Deploy su Render
1. Crea un database Postgres free su Render.
2. Usa `render.yaml` per creare backend e frontend.
3. Imposta `DATABASE_URL` e `JWT_SECRET` nel servizio backend.
4. Imposta `VITE_API_URL` nel frontend con l'URL del backend.

## Note importanti
- Nessun uso di ML/AI, scraping o hardware dedicato.
- Meglio un falso allarme che nessun allarme.
- Copia legale obbligatoria sempre visibile in UI.

## Mobile (Expo)
Frontend mobile in `mobile/` con Expo, riusa lo stesso backend.

### Avvio
```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=https://<backend-url> npm run start
```

### Note
- HealthKit/Health Connect richiedono app native: questa versione usa sensori base e GPS.
- Push: usa token Expo e registra su `/devices/register` (serve configurare FCM/APNs per invio reale).
