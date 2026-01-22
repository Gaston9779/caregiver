const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    if (Array.isArray(detail.detail)) {
      const message = detail.detail.map((item) => item.msg).join(", ");
      throw new Error(`${response.status}: ${message}`);
    }
    throw new Error(detail.detail || `${response.status}: Errore richiesta`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
