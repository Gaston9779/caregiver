const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.detail || "Errore richiesta");
  }
  return response.json();
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
