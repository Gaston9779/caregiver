import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

import { authHeaders, request } from "./src/api";
import { clearAuth, loadAuth, saveAuth } from "./src/storage";
import useGeofence from "./src/hooks/useGeofence";
import useFallDetection from "./src/hooks/useFallDetection";

const HEARTBEAT_MINUTES = 45;
const FALL_COUNTDOWN_SECONDS = 30;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState("ok");
  const [error, setError] = useState("");
  const [safeZone, setSafeZone] = useState(null);
  const [fallPrompt, setFallPrompt] = useState(false);
  const [countdown, setCountdown] = useState(FALL_COUNTDOWN_SECONDS);
  const [events, setEvents] = useState([]);
  const [linkEmail, setLinkEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(Date.now());
  const [heartRate, setHeartRate] = useState(72);
  const [manualBpm, setManualBpm] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    role: "USER",
    name: "",
    age: "",
    risk_level: "standard"
  });

  const apiHeaders = useMemo(() => authHeaders(token), [token]);

  useEffect(() => {
    loadAuth().then(({ token: storedToken, role: storedRole }) => {
      if (storedToken) {
        setToken(storedToken);
        setRole(storedRole);
      }
    });
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    try {
      const list = await request("/events", { headers: apiHeaders });
      setEvents(list);
      const openEvent = list.find((event) => event.status === "OPEN");
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

  useGeofence(safeZone, () => sendAutoEvent("GEOFENCE_EXIT"), role === "USER");
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
      const bpm = clamp(baseline + Math.min(12, minutesSince), 55, 110);
      setHeartRate(bpm);
    }, 2000);
    return () => clearInterval(timer);
  }, [lastHeartbeatAt, role, status]);

  const handleAuth = async () => {
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
      const formBody = `username=${encodeURIComponent(authForm.email)}&password=${encodeURIComponent(
        authForm.password
      )}`;
      const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody
      });
      await saveAuth(data.access_token, authForm.role);
      setToken(data.access_token);
      setRole(authForm.role);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetSafeZone = async () => {
    const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
    if (permissionStatus !== "granted") {
      Alert.alert("Permesso negato", "La geolocalizzazione e necessaria.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (!pos || !pos.coords || !Number.isFinite(pos.coords.latitude) || !Number.isFinite(pos.coords.longitude)) {
      setError("Posizione non disponibile");
      return;
    }
    try {
      const payload = {
        latitude: Number(pos.coords.latitude),
        longitude: Number(pos.coords.longitude),
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
  };

  const linkCaregiver = async () => {
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
  };

  const saveCaregiverContact = async () => {
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
  };

  const updateEventStatus = async (eventId, action) => {
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
  };

  const registerPushToken = async () => {
    if (!token) return;
    const { status: permission } = await Notifications.requestPermissionsAsync();
    if (permission !== "granted") {
      Alert.alert("Permesso negato", "Serve il permesso per le notifiche push.");
      return;
    }
    const { data } = await Notifications.getExpoPushTokenAsync();
    await request("/devices/register", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ token: data, platform: "expo" })
    });
  };

  const logout = async () => {
    await clearAuth();
    setToken(null);
    setRole(null);
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Sei al sicuro?</Text>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{authMode === "login" ? "Accedi" : "Crea account"}</Text>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} autoCapitalize="none" value={authForm.email} onChangeText={(text) => setAuthForm({ ...authForm, email: text })} />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} secureTextEntry value={authForm.password} onChangeText={(text) => setAuthForm({ ...authForm, password: text })} />
            <Text style={styles.label}>Ruolo</Text>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setAuthForm({ ...authForm, role: "USER" })} style={[styles.pill, authForm.role === "USER" && styles.pillActive]}>
                <Text style={styles.pillText}>Utente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAuthForm({ ...authForm, role: "CAREGIVER" })} style={[styles.pill, authForm.role === "CAREGIVER" && styles.pillActive]}>
                <Text style={styles.pillText}>Caregiver</Text>
              </TouchableOpacity>
            </View>
            {authMode === "register" && authForm.role === "USER" ? (
              <>
                <Text style={styles.label}>Nome</Text>
                <TextInput style={styles.input} value={authForm.name} onChangeText={(text) => setAuthForm({ ...authForm, name: text })} />
                <Text style={styles.label}>Eta</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={authForm.age} onChangeText={(text) => setAuthForm({ ...authForm, age: text })} />
              </>
            ) : null}
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleAuth}>
              <Text style={styles.buttonText}>{authMode === "login" ? "Entra" : "Registrati"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonOutline} onPress={() => setAuthMode(authMode === "login" ? "register" : "login")}> 
              <Text style={styles.buttonOutlineText}>{authMode === "login" ? "Non hai un account?" : "Hai gia un account?"}</Text>
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <Text style={styles.footer}>Questa applicazione NON e un dispositivo medico.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sei al sicuro?</Text>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.link}>Esci</Text>
          </TouchableOpacity>
        </View>

        {role === "USER" ? (
          <View style={styles.cardCenter}>
            <View style={styles.heart}>
              <Text style={styles.heartValue}>{manualBpm ? manualBpm : heartRate}</Text>
              <Text style={styles.heartLabel}>bpm</Text>
            </View>
            <Text style={styles.muted}>{manualBpm ? "Battiti manuali" : "Battiti stimati"}</Text>
          </View>
        ) : null}

        <View style={styles.statusCard}>
          <Text style={styles.statusText}>
            {status === "alert" ? "Allerta inviata" : status === "warning" ? "Controllo in corso" : "Tutto ok"}
          </Text>
          <Text style={styles.muted}>Heartbeat automatico ogni {HEARTBEAT_MINUTES} minuti.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.nav}>
          {["home", "safety", role === "CAREGIVER" ? "caregiver" : null, "events"].filter(Boolean).map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.navButton, activeTab === tab && styles.navButtonActive]}>
              <Text style={styles.navText}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "home" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Azioni rapide</Text>
            {role === "USER" ? (
              <>
                <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={sendHeartbeat}>
                  <Text style={styles.buttonText}>Tutto OK</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={sendSOS}>
                  <Text style={styles.buttonText}>SOS emergenza</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={refreshStatus}>
                <Text style={styles.buttonText}>Aggiorna stato</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {activeTab === "safety" && role === "USER" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sicurezza</Text>
            {safeZone ? (
              <View style={styles.zoneBox}>
                <Text style={styles.zoneTitle}>Zona sicura attiva</Text>
                <Text style={styles.zoneValue}>
                  {safeZone.latitude.toFixed(5)}, {safeZone.longitude.toFixed(5)}
                </Text>
                <Text style={styles.zoneValue}>Raggio: {safeZone.radius_meters} m</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.buttonOutline} onPress={handleSetSafeZone}>
              <Text style={styles.buttonOutlineText}>
                {safeZone ? "Aggiorna zona sicura" : "Imposta zona sicura"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.label}>Email caregiver</Text>
            <TextInput style={styles.input} value={linkEmail} onChangeText={setLinkEmail} />
            <TouchableOpacity style={styles.buttonOutline} onPress={linkCaregiver}>
              <Text style={styles.buttonOutlineText}>Associa caregiver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonOutline} onPress={() => sendAutoEvent("FALL")}>
              <Text style={styles.buttonOutlineText}>Simula caduta</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Battiti manuali (opzionale)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="es. 72"
              value={manualBpm}
              onChangeText={(text) => setManualBpm(text.replace(/[^0-9]/g, ""))}
            />
          </View>
        ) : null}

        {activeTab === "caregiver" && role === "CAREGIVER" ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Preferenze caregiver</Text>
            <Text style={styles.label}>Telefono per chiamata</Text>
            <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} />
            <TouchableOpacity style={styles.buttonOutline} onPress={saveCaregiverContact}>
              <Text style={styles.buttonOutlineText}>Salva telefono</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonOutline} onPress={registerPushToken}>
              <Text style={styles.buttonOutlineText}>Registra push</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {activeTab === "events" && events.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Eventi recenti</Text>
            {events.slice(0, 5).map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <Text>{event.type} - {event.status}</Text>
                {event.status === "OPEN" ? (
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.smallButton} onPress={() => updateEventStatus(event.id, "CONFIRM")}> 
                      <Text>Conferma</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallButton} onPress={() => updateEventStatus(event.id, "CANCEL")}> 
                      <Text>Annulla</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {fallPrompt ? (
          <View style={styles.modal}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>Possibile caduta</Text>
              <Text style={styles.muted}>Se stai bene, conferma entro {countdown} secondi.</Text>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={() => setFallPrompt(false)}>
                <Text style={styles.buttonText}>Sto bene</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={() => sendAutoEvent("FALL")}> 
                <Text style={styles.buttonText}>Chiama aiuto ora</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6"
  },
  content: {
    padding: 18,
    paddingBottom: 80
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  link: {
    color: "#ff4d5a",
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2
  },
  cardCenter: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginTop: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2
  },
  zoneBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#e6e6e6",
    marginTop: 8
  },
  zoneTitle: {
    fontWeight: "700",
    marginBottom: 4
  },
  zoneValue: {
    color: "#444"
  },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginTop: 14
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ff4d5a"
  },
  muted: {
    color: "#666",
    marginTop: 6
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12
  },
  label: {
    fontSize: 14,
    marginTop: 10,
    color: "#666"
  },
  input: {
    borderWidth: 1,
    borderColor: "#e6e6e6",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    marginTop: 6
  },
  button: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12
  },
  buttonPrimary: {
    backgroundColor: "#17a168"
  },
  buttonDanger: {
    backgroundColor: "#ff4d5a"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12
  },
  buttonOutlineText: {
    fontWeight: "600"
  },
  nav: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14
  },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#fff"
  },
  navButtonActive: {
    backgroundColor: "#ffe5e8"
  },
  navText: {
    fontWeight: "600",
    textTransform: "capitalize"
  },
  heart: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#ff4d5a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff4d5a",
    shadowOpacity: 0.35,
    shadowRadius: 18
  },
  heartValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700"
  },
  heartLabel: {
    color: "#fff",
    fontSize: 14
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  pill: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 8
  },
  pillActive: {
    borderColor: "#ff4d5a",
    backgroundColor: "#ffe5e8"
  },
  pillText: {
    fontWeight: "600"
  },
  eventRow: {
    marginBottom: 12
  },
  smallButton: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  error: {
    color: "#d44b2c",
    marginTop: 10
  },
  footer: {
    marginTop: 16,
    color: "#666"
  },
  modal: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "100%"
  }
});
