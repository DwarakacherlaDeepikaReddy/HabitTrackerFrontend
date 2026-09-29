// API client for Habit & Money Tracker Flask Backend
const PRIMARY_API = "https://habittrackerbackend-uocv.onrender.com/api";
const LOCAL_API = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const firstBase = isLocal ? LOCAL_API : PRIMARY_API;
  const secondBase = isLocal ? PRIMARY_API : LOCAL_API;

  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

  const doFetch = async (baseUrl) => {
    const res = await fetch(`${baseUrl}${cleanEndpoint}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    return await res.json();
  };

  try {
    return await doFetch(firstBase);
  } catch (err) {
    try {
      return await doFetch(secondBase);
    } catch (fallbackErr) {
      console.warn(`[API] Both primary and fallback endpoints failed for ${cleanEndpoint}:`, err.message, fallbackErr.message);
      const is404 = err.message.includes("404") || fallbackErr.message.includes("404");
      if (is404) {
        throw new Error("Auth endpoint not found on remote server yet. Please run backend locally on port 5000 or push latest changes.");
      }
      throw new Error(err.message.includes("Failed to fetch") ? "Could not connect to server. Please ensure backend is running." : (err.message || fallbackErr.message));
    }
  }
}

export const api = {
  // Check backend health
  checkHealth: () => request("/health"),

  // Authentication
  register: (name, email, password) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  googleAuth: (payload) =>
    request("/auth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sendOtp: (email, name) =>
    request("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    }),
  verifyOtp: (email, code, name) =>
    request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code, name }),
    }),
  getMe: () => request("/auth/me"),

  // Full data sync
  getAllData: () => request("/data"),
  syncData: (data) =>
    request("/sync", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Habits
  getHabits: () => request("/habits"),
  createHabit: (habitData) =>
    request("/habits", {
      method: "POST",
      body: JSON.stringify(habitData),
    }),
  updateHabit: (id, habitData) =>
    request(`/habits/${id}`, {
      method: "PUT",
      body: JSON.stringify(habitData),
    }),
  deleteHabit: (id) =>
    request(`/habits/${id}`, {
      method: "DELETE",
    }),

  // Completions
  toggleCompletion: (habitId, date) =>
    request("/completions/toggle", {
      method: "POST",
      body: JSON.stringify({ habitId, date }),
    }),

  toggleSubCompletion: (habitId, subId, date) =>
    request("/sub-completions/toggle", {
      method: "POST",
      body: JSON.stringify({ habitId, subId, date }),
    }),

  // Transactions
  getTransactions: () => request("/transactions"),
  createTransaction: (tx) =>
    request("/transactions", {
      method: "POST",
      body: JSON.stringify(tx),
    }),
  updateTransaction: (id, tx) =>
    request(`/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(tx),
    }),
  deleteTransaction: (id) =>
    request(`/transactions/${id}`, {
      method: "DELETE",
    }),

  // Settings
  getSettings: () => request("/settings"),
  saveSettings: (settings) =>
    request("/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),

  // 24/7 Web Push Notifications
  getVapidPublicKey: () => request("/push/vapid-public-key"),
  subscribePush: (subscription) =>
    request("/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
};

export default api;


