// API client for Habit & Money Tracker Flask Backend
const API_BASE = "https://habittrackerbackend-uocv.onrender.com/api";

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    // If backend isn't reachable, let the caller know without crashing the UI
    console.warn(`[API] Request to ${endpoint} failed:`, err.message);
    throw err;
  }
}

export const api = {
  // Check backend health
  checkHealth: () => request("/health"),

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
};

export default api;
