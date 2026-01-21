import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders, request } from "./api.js";
import useGeofence from "./hooks/useGeofence.js";
import useFallDetection from "./hooks/useFallDetection.js";

const HEARTBEAT_MINUTES = 45;
const FALL_COUNTDOWN_SECONDS = 30;

function getStoredAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  return { token, role };
}

export default function App() {
  const stored = getStoredAuth();
  const [token, setToken] = useState(stored.token);
  const [role, setRole] = useState(stored.role);
  const [status, setStatus] = useState("ok");
  const [error, setError] = useState("");
  const [safeZone, setSafeZone] = useState(null);
  const [fallPrompt, setFallPrompt] = useState(false);
  const [countdown, setCountdown] = useState(FALL_COUNTDOWN_SECONDS);
  const [events, setEvents] = useState([]);
  const [linkEmail, setLinkEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(Date.now());
  const [heartRate, setHeartRate] = useState(72);
  const [measurePercent, setMeasurePercent] = useState(65);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    role: "USER",
    name: "",
    age: "",
    risk_level: "standard"
  });

  const isAuthed = Boolean(token);

  const apiHeaders = useMemo(() => authHeaders(token), [token]);

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    try {
      const events = await request("/events", { headers: apiHeaders });
      setEvents(events);
      const openEvent = events.find((event) => event.status === "OPEN");
      setStatus(openEvent ? "alert" : "ok");
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, token]);

  const sendHeartbeat = useCallback(async () => {
    if (!token || role !== "USER") return;
    try {
      await request("/heartbeat", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({})
      });
      setStatus("ok");
      setLastHeartbeatAt(Date.now());
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, role, token]);

  const sendAutoEvent = useCallback(
    async (type) => {
      if (!token || role !== "USER") return;
      try {
        await request("/events/auto", {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({ type })
        });
        setStatus("alert");
      } catch (err) {
        setError(err.message);
      }
    },
    [apiHeaders, role, token]
  );

  const sendSOS = useCallback(async () => {
    if (!token || role !== "USER") return;
    try {
      await request("/events/sos", {
        method: "POST",
        headers: apiHeaders
      });
      setStatus("alert");
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, role, token]);

  const linkCaregiver = useCallback(async () => {
    if (!token || role !== "USER" || !linkEmail) return;
    try {
      await request("/caregivers/link", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ email: linkEmail })
      });
      setLinkEmail("");
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, linkEmail, role, token]);

  const saveCaregiverContact = useCallback(async () => {
    if (!token || role !== "CAREGIVER") return;
    try {
      await request("/caregivers/contact", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ phone_number: phoneNumber })
      });
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, phoneNumber, role, token]);

  const registerDevice = useCallback(async () => {
    if (!token || !deviceToken) return;
    try {
      await request("/devices/register", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ token: deviceToken, platform: "web" })
      });
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, deviceToken, token]);

  const updateEventStatus = useCallback(
    async (eventId, action) => {
      if (!token) return;
      try {
        await request(`/events/${eventId}/action`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({ action })
        });
        refreshStatus();
      } catch (err) {
        setError(err.message);
      }
    },
    [apiHeaders, refreshStatus, token]
  );

  const loadSafeZone = useCallback(async () => {
    if (!token || role !== "USER") return;
    try {
      const zones = await request("/safe-zones", { headers: apiHeaders });
      setSafeZone(zones[0] || null);
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, role, token]);

  const loadCaregiverContact = useCallback(async () => {
    if (!token || role !== "CAREGIVER") return;
    try {
      const data = await request("/caregivers/contact", { headers: apiHeaders });
      setPhoneNumber(data.phone_number || "");
    } catch (err) {
      setError(err.message);
    }
  }, [apiHeaders, role, token]);

  useEffect(() => {
    if (!token) return;
    refreshStatus();
    loadSafeZone();
    loadCaregiverContact();
    const statusTimer = setInterval(refreshStatus, 60000);
    return () => clearInterval(statusTimer);
  }, [token, refreshStatus, loadSafeZone, loadCaregiverContact]);

  useEffect(() => {
    if (!token || role !== "USER") return undefined;
    const timer = setInterval(sendHeartbeat, HEARTBEAT_MINUTES * 60 * 1000);
    return () => clearInterval(timer);
  }, [sendHeartbeat, token, role]);

  useGeofence(safeZone, () => sendAutoEvent("GEOFENCE_EXIT"));
  useFallDetection(() => setFallPrompt(true), role === "USER");

  useEffect(() => {
    if (!fallPrompt) return undefined;
    setCountdown(FALL_COUNTDOWN_SECONDS);
    setStatus("warning");
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          sendAutoEvent("FALL");
          setFallPrompt(false);
          setStatus("alert");
          return FALL_COUNTDOWN_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fallPrompt, sendAutoEvent]);

  useEffect(() => {
    if (role !== "USER") return undefined;
    const timer = setInterval(() => {
      const minutesSince = Math.floor((Date.now() - lastHeartbeatAt) / 60000);
      const baseline = status === "alert" ? 110 : status === "warning" ? 90 : 72;
      const bpm = Math.min(110, Math.max(55, baseline + Math.min(12, minutesSince)));
      setHeartRate(bpm);
      setMeasurePercent(Math.min(95, 60 + Math.min(35, minutesSince)));
    }, 2000);
    return () => clearInterval(timer);
  }, [lastHeartbeatAt, role, status]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (authMode === "register") {
        const payload = {
          email: authForm.email,
          password: authForm.password,
          role: authForm.role
        };
        if (authForm.role === "USER") {
          payload.name = authForm.name;
          payload.age = Number(authForm.age || 0);
          payload.risk_level = authForm.risk_level;
        }
        await request("/auth/register", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: authForm.email,
          password: authForm.password
        })
      });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", authForm.role);
      setToken(data.access_token);
      setRole(authForm.role);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetSafeZone = async () => {
    if (!navigator.geolocation) {
      setError("Geolocalizzazione non supportata");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const payload = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            radius_meters: 200
          };
          const zone = await request("/safe-zones", {
            method: "POST",
            headers: apiHeaders,
            body: JSON.stringify(payload)
          });
          setSafeZone(zone);
        } catch (err) {
          setError(err.message);
        }
      },
      () => setError("Permesso geolocalizzazione negato")
    );
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setToken(null);
    setRole(null);
  };

  if (!isAuthed) {
    return (
      <div className="app">
        <div className="header">
          <div className="logo">Sei al sicuro?</div>
        </div>
        <form className="card" onSubmit={handleAuth}>
          <div className="section-title">{authMode === "login" ? "Accedi" : "Crea account"}</div>
          <div className="field">
            <div className="label">Email</div>
            <input
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              required
            />
          </div>
          <div className="field">
            <div className="label">Password</div>
            <input
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              required
            />
          </div>
          <div className="field">
            <div className="label">Ruolo</div>
            <select
              value={authForm.role}
              onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })}
            >
              <option value="USER">Utente monitorato</option>
              <option value="CAREGIVER">Caregiver</option>
            </select>
          </div>
          {authMode === "register" && authForm.role === "USER" ? (
            <div className="two-col">
              <div className="field">
                <div className="label">Nome</div>
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  required
                />
              </div>
              <div className="field">
                <div className="label">Eta</div>
                <input
                  type="number"
                  min="0"
                  value={authForm.age}
                  onChange={(event) => setAuthForm({ ...authForm, age: event.target.value })}
                  required
                />
              </div>
              <div className="field">
                <div className="label">Profilo rischio</div>
                <select
                  value={authForm.risk_level}
                  onChange={(event) => setAuthForm({ ...authForm, risk_level: event.target.value })}
                >
                  <option value="standard">Rischio standard</option>
                  <option value="high">Rischio alto</option>
                </select>
              </div>
            </div>
          ) : null}
          <div className="primary-actions">
            <button className="big-button ok" type="submit">
              {authMode === "login" ? "Entra" : "Registrati"}
            </button>
            <button
              className="small-button"
              type="button"
              onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
            >
              {authMode === "login" ? "Non hai un account?" : "Hai gia un account?"}
            </button>
          </div>
          {error ? <div>{error}</div> : null}
        </form>
        <div className="footer">
          Questa applicazione NON e un dispositivo medico. Fornisce un supporto di sicurezza basato su
          attivita e interazione dell'utente.
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div className="logo-wrap">
          <div className="logo">Sei al sicuro?</div>
        </div>
        <button className="logout" onClick={logout}>
          Esci
        </button>
      </div>

      {role === "USER" ? (
        <div className="card measure-card">
          <div className="measure-title">Measure</div>
          <div className="measure-subtitle">Measuring your heart rate. Please hold on...</div>
          <div className="ring" style={{ "--progress": `${measurePercent / 100}turn` }}>
            <div
              className="ring-inner"
              style={{ "--pulse-speed": `${Math.max(0.4, 60 / heartRate)}s` }}
            >
              <div className="bpm">{heartRate}</div>
              <div className="bpm-label">bpm</div>
            </div>
          </div>
          <div className="pulse-line">
            <svg viewBox="0 0 360 80" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M0 40 L40 40 L55 20 L70 60 L90 40 L120 40 L140 30 L160 50 L180 40 L220 40 L240 15 L260 65 L290 40 L360 40"
                fill="none"
                stroke="rgba(255, 77, 90, 0.5)"
                strokeWidth="3"
              />
            </svg>
          </div>
        </div>
      ) : null}

      <div className="status-card">
        <div
          className={`status-pill ${status === "alert" ? "alert" : status === "warning" ? "warning" : ""}`}
        >
          {status === "alert" ? "Allerta inviata" : status === "warning" ? "Controllo in corso" : "Tutto ok"}
        </div>
        <div>Heartbeat automatico ogni {HEARTBEAT_MINUTES} minuti.</div>
        {error ? <div>{error}</div> : null}
      </div>

      <div className="nav">
        <button
          className={`nav-button ${activeTab === "home" ? "active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          Home
        </button>
        <button
          className={`nav-button ${activeTab === "safety" ? "active" : ""}`}
          onClick={() => setActiveTab("safety")}
        >
          Sicurezza
        </button>
        {role === "CAREGIVER" ? (
          <button
            className={`nav-button ${activeTab === "caregiver" ? "active" : ""}`}
            onClick={() => setActiveTab("caregiver")}
          >
            Caregiver
          </button>
        ) : null}
        <button
          className={`nav-button ${activeTab === "events" ? "active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          Eventi
        </button>
      </div>

      {activeTab === "home" ? (
        <div className="card">
          <div className="section-title">Azioni rapide</div>
          <div className="primary-actions">
            {role === "USER" ? (
              <>
                <button className="big-button ok" onClick={sendHeartbeat}>
                  Tutto OK
                </button>
                <button className="big-button sos" onClick={sendSOS}>
                  SOS emergenza
                </button>
              </>
            ) : (
              <button className="big-button ok" onClick={refreshStatus}>
                Aggiorna stato
              </button>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "safety" && role === "USER" ? (
        <div className="card">
          <div className="section-title">Impostazioni sicurezza</div>
          <div className="secondary-actions">
            <button className="small-button" onClick={handleSetSafeZone}>
              Imposta zona sicura
            </button>
            <div className="field">
              <div className="label">Email caregiver</div>
              <input value={linkEmail} onChange={(event) => setLinkEmail(event.target.value)} />
            </div>
            <button className="small-button" onClick={linkCaregiver}>
              Associa caregiver
            </button>
            <button className="small-button" onClick={() => sendAutoEvent("FALL")}>
              Simula caduta
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "caregiver" && role === "CAREGIVER" ? (
        <div className="card">
          <div className="section-title">Preferenze caregiver</div>
          <div className="secondary-actions">
            <div className="field">
              <div className="label">Telefono per chiamata</div>
              <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
            </div>
            <button className="small-button" onClick={saveCaregiverContact}>
              Salva telefono
            </button>
            <div className="field">
              <div className="label">Token push (FCM)</div>
              <input value={deviceToken} onChange={(event) => setDeviceToken(event.target.value)} />
            </div>
            <button className="small-button" onClick={registerDevice}>
              Registra dispositivo
            </button>
            <div className="muted">Riceverai notifiche push e chiamate per gli alert.</div>
          </div>
        </div>
      ) : null}

      {activeTab === "events" && events.length ? (
        <div className="card">
          <div className="section-title">Eventi recenti</div>
          <div className="stack">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="stack">
                <div>
                  {event.type} - {event.status}
                </div>
                {event.status === "OPEN" ? (
                  <div className="two-col">
                    <button className="small-button" onClick={() => updateEventStatus(event.id, "CONFIRM")}>
                      Conferma
                    </button>
                    <button className="small-button" onClick={() => updateEventStatus(event.id, "CANCEL")}>
                      Annulla
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="footer">
        Questa applicazione NON e un dispositivo medico. Fornisce un supporto di
        sicurezza basato su attivita e interazione dell'utente.
      </div>

      {fallPrompt ? (
        <div className="modal">
          <div className="modal-card">
            <div className="logo">Possibile caduta</div>
            <div>Se stai bene, conferma entro {countdown} secondi.</div>
            <button className="big-button ok" onClick={() => setFallPrompt(false)}>
              Sto bene
            </button>
            <button className="big-button sos" onClick={() => sendAutoEvent("FALL")}>
              Chiama aiuto ora
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
