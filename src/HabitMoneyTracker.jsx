import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "./api.js";
import {
  Home, CheckCircle2, Wallet, Settings as SettingsIcon, Plus, Mic,
  Edit2, Trash2, X, Check, Flame, ChevronLeft, ChevronRight,
  Bell, BellOff, Sun, Moon, Monitor, AlertTriangle, Clock, Loader2,
  GripVertical, ListTodo, ShoppingBag, ArrowUp, ArrowDown, ChevronDown, ChevronUp
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";

/* ============================== CONSTANTS ============================== */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PALETTE = {
  paper: "#F5F3EC",
  paperDark: "#1B1E1A",
  ink: "#22281F",
  inkSoft: "#4A5245",
  inkFaint: "#8A8F80",
  forest: "#3A5A40",
  forestSoft: "#DCE6DC",
  brass: "#A6763B",
  brassSoft: "#F0E3CC",
  rule: "#D8D3C7",
  danger: "#A13D2D",
  dangerSoft: "#F3DED8",
  cardDark: "#262B22",
};

const DEFAULT_CATEGORIES = [
  { id: "cat-rent", name: "Rent", createdAt: Date.now() },
  { id: "cat-savings", name: "Savings", createdAt: Date.now() },
  { id: "cat-food", name: "Food", createdAt: Date.now() },
  { id: "cat-transport", name: "Transport", createdAt: Date.now() },
];

const DEFAULT_HABITS = [
  { 
    id: "h-morning-routine", 
    name: "Morning Routine", 
    routineType: "morning", 
    description: "Start the day right", 
    days: "daily", 
    reminderEnabled: true, 
    reminderTime: "07:00", 
    createdAt: Date.now(),
    subItems: [
      { id: "sub-1", name: "Brush Teeth" },
      { id: "sub-2", name: "Drink Warm Water" },
      { id: "sub-3", name: "10-min Stretch" }
    ]
  },
  { id: "h-water", name: "Drink Water", routineType: "normal", description: "8 glasses a day", days: "daily", reminderEnabled: true, reminderTime: "09:00", createdAt: Date.now(), subItems: [] },
  { id: "h-exercise", name: "Exercise", routineType: "normal", description: "", days: ["Mon","Wed","Fri"], reminderEnabled: true, reminderTime: "18:30", createdAt: Date.now(), subItems: [] },
  { 
    id: "h-night-routine", 
    name: "Night Routine", 
    routineType: "night", 
    description: "Wind down", 
    days: "daily", 
    reminderEnabled: true, 
    reminderTime: "21:30", 
    createdAt: Date.now(),
    subItems: [
      { id: "sub-n1", name: "Skincare" },
      { id: "sub-n2", name: "Read 10 pages" }
    ]
  },
];

const DEFAULT_SETTINGS = {
  theme: "light",
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
  reminderDefault: "20:00",
  notificationsEnabled: false,
  incomeTrackingEnabled: false,
  monthlyBudget: null,
  salaryDay: 28,
};

const STORAGE_KEY = "habit-money-tracker-data-v2";

/* ============================== UTILS ============================== */
const uid = (p = "id") => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function isoOf(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const todayISO = () => isoOf(new Date());

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

function dayOfWeekName(iso) {
  const d = new Date(iso + "T00:00:00");
  return DAY_NAMES[d.getDay()];
}

function habitScheduledOn(habit, iso) {
  if (habit.days === "daily" || habit.days === "weekdays_all") return true;
  if (habit.days === "weekdays") return !["Sat", "Sun"].includes(dayOfWeekName(iso));
  if (habit.days === "weekends") return ["Sat", "Sun"].includes(dayOfWeekName(iso));
  if (Array.isArray(habit.days)) return habit.days.includes(dayOfWeekName(iso));
  return true;
}

function formatDateDisplay(iso, format = "DD/MM/YYYY") {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (format === "MM/DD/YYYY") return `${m}/${d}/${y}`;
  return `${d}/${m}/${y}`;
}

function prettyDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function financeCycleStart(iso, salaryDay = 28) {
  const d = new Date(iso + "T00:00:00");
  let y = d.getFullYear(), m = d.getMonth();
  const clampedThisMonth = Math.min(salaryDay, daysInMonth(y, m));
  if (d.getDate() < clampedThisMonth) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  const clampedDay = Math.min(salaryDay, daysInMonth(y, m));
  return isoOf(new Date(y, m, clampedDay));
}

function financeCycleEnd(cycleStartIso, salaryDay = 28) {
  const d = new Date(cycleStartIso + "T00:00:00");
  let y = d.getFullYear(), m = d.getMonth() + 1;
  if (m > 11) { m = 0; y += 1; }
  const clampedDay = Math.min(salaryDay, daysInMonth(y, m));
  return isoOf(new Date(y, m, clampedDay));
}

function shiftCycleStart(cycleStartIso, offset, salaryDay = 28) {
  const d = new Date(cycleStartIso + "T00:00:00");
  let y = d.getFullYear(), m = d.getMonth() + offset;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  const clampedDay = Math.min(salaryDay, daysInMonth(y, m));
  return isoOf(new Date(y, m, clampedDay));
}

function inCycle(dateIso, cycleStartIso, salaryDay = 28) {
  const end = financeCycleEnd(cycleStartIso, salaryDay);
  return dateIso >= cycleStartIso && dateIso < end;
}

function financeCycleLabel(cycleStartIso, salaryDay = 28) {
  const start = new Date(cycleStartIso + "T00:00:00");
  const endExclusive = new Date(financeCycleEnd(cycleStartIso, salaryDay) + "T00:00:00");
  const endInclusive = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate() - 1);
  const startStr = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)}`;
  const endStr = `${endInclusive.getDate()} ${MONTH_NAMES[endInclusive.getMonth()].slice(0, 3)} ${endInclusive.getFullYear()}`;
  return `${startStr} – ${endStr}`;
}

/* ============================== VOICE PARSER ============================== */
function parseVoiceExpense(text, categories) {
  const lower = text.toLowerCase().trim();
  const result = { date: todayISO(), category: null, amount: null, information: "", dateConfident: false, categoryConfident: false };

  const amountMatch = lower.match(/(?:rs\.?|inr|₹)?\s*(\d[\d,]*(?:\.\d+)?)/);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  if (/\byesterday\b/.test(lower)) {
    result.date = addDays(todayISO(), -1);
    result.dateConfident = true;
  } else if (/\btoday\b/.test(lower)) {
    result.date = todayISO();
    result.dateConfident = true;
  } else {
    const monthPattern = MONTH_NAMES.map((m) => m.toLowerCase()).join("|");
    let m = lower.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})`));
    if (!m) m = lower.match(new RegExp(`(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?`));
    if (m) {
      let day, monthName;
      if (MONTH_NAMES.map((x) => x.toLowerCase()).includes(m[1])) {
        monthName = m[1]; day = m[2];
      } else {
        day = m[1]; monthName = m[2];
      }
      const monthIdx = MONTH_NAMES.findIndex((mn) => mn.toLowerCase() === monthName);
      const year = new Date().getFullYear();
      const dt = new Date(year, monthIdx, parseInt(day, 10));
      result.date = isoOf(dt);
      result.dateConfident = true;
    } else {
      const wIdx = DAY_FULL.findIndex((d) => lower.includes(d.toLowerCase()));
      if (wIdx >= 0) {
        let cursor = todayISO();
        for (let i = 0; i < 7; i++) {
          if (new Date(cursor + "T00:00:00").getDay() === wIdx) { result.date = cursor; result.dateConfident = true; break; }
          cursor = addDays(cursor, -1);
        }
      }
    }
  }

  const synonyms = {
    Food: ["food", "lunch", "dinner", "breakfast", "groceries", "grocery", "restaurant", "snack"],
    Transport: ["transport", "taxi", "uber", "ola", "ticket", "bus", "train", "auto", "fuel", "petrol"],
    Rent: ["rent", "pg"],
    Savings: ["savings", "saved", "invest", "investment"],
  };

  for (const cat of categories) {
    if (lower.includes(cat.name.toLowerCase())) { result.category = cat.name; result.categoryConfident = true; break; }
  }

  if (!result.category) {
    for (const [catName, words] of Object.entries(synonyms)) {
      if (words.some((w) => lower.includes(w))) {
        const existing = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        result.category = existing ? existing.name : catName;
        result.categoryConfident = true;
        break;
      }
    }
  }

  const forMatch = lower.match(/\bfor\s+(.+)$/);
  if (forMatch) result.information = forMatch[1].trim();
  return result;
}

/* ============================== STORAGE HOOK ============================== */
function useTrackerData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const saveTimeout = useRef(null);

  useEffect(() => {
    async function initData() {
      // 1. Try fetching from Flask backend
      try {
        const backendData = await api.getAllData();
        if (backendData && backendData.habits) {
          const merged = {
            habits: backendData.habits.length > 0 ? backendData.habits : DEFAULT_HABITS,
            completions: backendData.completions || [],
            subCompletions: backendData.subCompletions || [],
            transactions: backendData.transactions || [],
            categories: backendData.categories && backendData.categories.length > 0 ? backendData.categories : DEFAULT_CATEGORIES,
            salaries: backendData.salaries || [],
            todos: backendData.todos || [],
            buys: backendData.buys || [],
            settings: { ...DEFAULT_SETTINGS, ...(backendData.settings || {}) },
          };
          setData(merged);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch (e) {}
          setIsBackendOffline(false);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Flask backend not reachable on init, falling back to local cache:", err.message);
        setIsBackendOffline(true);
      }

      // 2. Fallback to localStorage
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setData({
            habits: DEFAULT_HABITS,
            completions: [],
            subCompletions: [],
            transactions: [],
            categories: DEFAULT_CATEGORIES,
            salaries: [],
            todos: [],
            buys: [],
            ...parsed,
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          });
        } else {
          setData({
            habits: DEFAULT_HABITS,
            completions: [],
            subCompletions: [],
            transactions: [],
            categories: DEFAULT_CATEGORIES,
            salaries: [],
            todos: [
              { id: uid("td"), text: "Pay electricity bill", completed: false },
              { id: uid("td"), text: "Call plumber", completed: false },
            ],
            buys: [
              { id: uid("b"), text: "Milk & Eggs", completed: false },
              { id: uid("b"), text: "New notebook", completed: true },
            ],
            settings: DEFAULT_SETTINGS,
          });
        }
      } catch (e) {
        setData({
          habits: DEFAULT_HABITS,
          completions: [],
          subCompletions: [],
          transactions: [],
          categories: DEFAULT_CATEGORIES,
          salaries: [],
          todos: [],
          buys: [],
          settings: DEFAULT_SETTINGS,
        });
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, []);

  useEffect(() => {
    if (loading || !data) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setError(null);
      } catch (e) {
        setError("Couldn't save your changes locally. They're still here, but try again in a moment.");
      }
      // Background sync to Flask backend
      api.syncData(data)
        .then(() => setIsBackendOffline(false))
        .catch(() => setIsBackendOffline(true));
    }, 400);
    return () => clearTimeout(saveTimeout.current);
  }, [data, loading]);

  return { data, setData, loading, error, isBackendOffline };
}

/* ============================== SMALL UI PRIMITIVES ============================== */
function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--rule)", boxShadow: "0 1px 2px rgba(34,40,31,0.04)", ...style }}
    >
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", className = "", type = "button", disabled }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary: { background: "var(--ink)", color: "var(--paper)" },
    outline: { background: "transparent", color: "var(--ink)", border: "1px solid var(--rule)" },
    danger: { background: "var(--danger)", color: "#fff" },
    ghost: { background: "transparent", color: "var(--ink-soft)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${className} hover:opacity-90 active:scale-[0.98]`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

function Modal({ open, onClose, title, children, width = "max-w-md" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(20,22,17,0.45)" }} onClick={onClose}>
      <div
        className={`w-full ${width} rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto`}
        style={{ background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl" style={{ color: "var(--ink)" }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5">
            <X size={18} style={{ color: "var(--ink-soft)" }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = "Delete" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,22,17,0.5)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-full" style={{ background: "var(--danger-soft)" }}>
            <AlertTriangle size={18} style={{ color: "var(--danger)" }} />
          </div>
          <h3 className="font-display text-lg" style={{ color: "var(--ink)" }}>{title}</h3>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-[fadein_0.2s]" style={{ background: "var(--ink)", color: "var(--paper)" }}>
      {toast}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium mb-1.5 tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { background: "var(--paper)", border: "1px solid var(--rule)", color: "var(--ink)" };

function TextInput(props) {
  return <input {...props} className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

function StampCheck({ checked, onClick, size = 44 }) {
  return (
    <button
      onClick={onClick}
      className="relative shrink-0 rounded-full transition-transform duration-200"
      style={{
        width: size, height: size,
        border: `2px solid ${checked ? "var(--forest)" : "var(--rule)"}`,
        background: checked ? "var(--forest)" : "transparent",
        transform: checked ? "rotate(-6deg)" : "rotate(0deg)",
      }}
      aria-label={checked ? "Mark incomplete" : "Mark complete"}
    >
      {checked && <Check size={size * 0.5} strokeWidth={3} color="var(--paper)" className="absolute inset-0 m-auto" />}
    </button>
  );
}

function ProgressRing({ pct, size = 88, stroke = 8, color = "var(--forest)", label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--rule)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-xl" style={{ color: "var(--ink)" }}>{Math.round(pct)}%</span>
        {label && <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>{label}</span>}
      </div>
    </div>
  );
}

/* ============================== VOICE INPUT ============================== */
function useSpeechRecognition() {
  const [supported] = useState(() => typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition));
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const listen = useCallback((onResult, onEnd) => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult(text);
    };
    rec.onend = () => { setListening(false); onEnd && onEnd(); };
    rec.onerror = () => { setListening(false); onEnd && onEnd(); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [supported]);

  const stop = useCallback(() => { recRef.current && recRef.current.stop(); }, []);
  return { supported: !!supported, listening, listen, stop };
}

function MicButton({ onTranscript, size = 18 }) {
  const { supported, listening, listen, stop } = useSpeechRecognition();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : listen(onTranscript))}
      className="p-2.5 rounded-full transition-colors"
      style={{ background: listening ? "var(--danger)" : "var(--forest)", color: "#fff" }}
      title={listening ? "Stop listening" : "Speak an entry"}
    >
      {listening ? <Loader2 size={size} className="animate-spin" /> : <Mic size={size} />}
    </button>
  );
}

/* ============================== HEATMAP ============================== */
function HabitHeatmap({ habits, completions, days = 35 }) {
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const iso = addDays(todayISO(), -i);
    const scheduled = habits.filter((h) => habitScheduledOn(h, iso));
    const done = scheduled.filter((h) => completions.some((c) => c.habitId === h.id && c.date === iso && c.completed));
    let level = 0;
    if (scheduled.length > 0) {
      const ratio = done.length / scheduled.length;
      level = ratio === 0 ? 0 : ratio < 0.5 ? 1 : ratio < 1 ? 2 : 3;
    }
    cells.push({ iso, level });
  }
  const colors = ["var(--rule)", "#C9DCC8", "#8FB68C", "var(--forest)"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {cells.map((c) => (
        <div key={c.iso} title={`${c.iso}`} className="w-4 h-4 rounded-[4px]" style={{ background: colors[c.level] }} />
      ))}
    </div>
  );
}

/* ============================== SIDEBAR / NAV ============================== */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "habits", label: "Habit Tracker", icon: CheckCircle2 },
  { id: "reminders_buys", label: "Reminders & Buys", icon: ListTodo },
  { id: "money", label: "Money Tracker", icon: Wallet },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ page, setPage }) {
  return (
    <div className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 px-4 py-6" style={{ background: "var(--card)", borderRight: "1px solid var(--rule)" }}>
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--ink)" }}>
          <Flame size={16} color="var(--paper)" />
        </div>
        <span className="font-display text-lg" style={{ color: "var(--ink)" }}>Daybook</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left"
              style={{ background: active ? "var(--ink)" : "transparent", color: active ? "var(--paper)" : "var(--ink-soft)" }}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function BottomNav({ page, setPage }) {
  return (
    <div className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 justify-around py-2 px-1" style={{ background: "var(--card)", borderTop: "1px solid var(--rule)" }}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = page === item.id;
        return (
          <button key={item.id} onClick={() => setPage(item.id)} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg">
            <Icon size={19} color={active ? "var(--forest)" : "var(--ink-faint)"} />
            <span className="text-[9px] truncate max-w-[55px]" style={{ color: active ? "var(--forest)" : "var(--ink-faint)" }}>{item.label.split(" ")[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================== DASHBOARD ============================== */
function computeHabitStats(habits, completions, iso = todayISO()) {
  const scheduled = habits.filter((h) => habitScheduledOn(h, iso));
  const completedToday = scheduled.filter((h) => completions.some((c) => c.habitId === h.id && c.date === iso && c.completed));
  const pct = scheduled.length ? Math.round((completedToday.length / scheduled.length) * 100) : 0;

  let streak = 0;
  let cursor = iso;
  for (let i = 0; i < 365; i++) {
    const dayScheduled = habits.filter((h) => habitScheduledOn(h, cursor));
    if (dayScheduled.length === 0) { cursor = addDays(cursor, -1); continue; }
    const allDone = dayScheduled.every((h) => completions.some((c) => c.habitId === h.id && c.date === cursor && c.completed));
    if (allDone) { streak++; cursor = addDays(cursor, -1); } else break;
  }
  return { scheduledCount: scheduled.length, completedCount: completedToday.length, pendingCount: scheduled.length - completedToday.length, pct, streak };
}

function weeklyHabitSeries(habits, completions) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const iso = addDays(todayISO(), -i);
    const stats = computeHabitStats(habits, completions, iso);
    out.push({ day: dayOfWeekName(iso), pct: stats.pct });
  }
  return out;
}

function Dashboard({ habits, completions, transactions, categories, salaries, settings }) {
  const habitStats = useMemo(() => computeHabitStats(habits, completions), [habits, completions]);
  const weekSeries = useMemo(() => weeklyHabitSeries(habits, completions), [habits, completions]);
  const salaryDay = settings.salaryDay ?? 28;
  const cycleStart = useMemo(() => financeCycleStart(todayISO(), salaryDay), [salaryDay]);
  const monthTx = transactions.filter((t) => inCycle(t.date, cycleStart, salaryDay));
  const totalSpent = monthTx.filter((t) => t.categoryName !== "Savings").reduce((s, t) => s + Number(t.amount), 0);
  const totalSavings = monthTx.filter((t) => t.categoryName === "Savings").reduce((s, t) => s + Number(t.amount), 0);
  const remaining = settings.monthlyBudget ? settings.monthlyBudget - totalSpent : null;
  const salaryEntry = salaries.find((s) => s.cycleStart === cycleStart);
  const salaryAmount = salaryEntry ? Number(salaryEntry.amount) : 0;
  const totalOutflow = monthTx.reduce((s, t) => s + Number(t.amount), 0);
  const salaryRemaining = salaryAmount - totalOutflow;

  const byCategory = useMemo(() => {
    const map = {};
    monthTx.forEach((t) => { map[t.categoryName] = (map[t.categoryName] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [monthTx]);

  const COLORS = [PALETTE.forest, PALETTE.brass, "#8FB68C", "#C79B5E", "#6E8B72", "#D9B67E"];
  const recent = [...transactions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ink-faint)" }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display text-3xl" style={{ color: "var(--ink)" }}>Good day. Here's where things stand.</h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Today's habits</p>
          <p className="font-display text-3xl" style={{ color: "var(--forest)" }}>{habitStats.pct}%</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{habitStats.completedCount} done · {habitStats.pendingCount} pending</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Current streak</p>
          <p className="font-display text-3xl flex items-center gap-1.5" style={{ color: "var(--ink)" }}><Flame size={22} color="var(--brass)" />{habitStats.streak}</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>days in a row</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Spent this cycle</p>
          <p className="font-display text-3xl font-mono-ledger" style={{ color: "var(--ink)" }}>{fmtINR(totalSpent)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{monthTx.length} transactions</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>{settings.monthlyBudget ? "Remaining budget" : "Saved this cycle"}</p>
          <p className="font-display text-3xl font-mono-ledger" style={{ color: "var(--brass)" }}>{fmtINR(settings.monthlyBudget ? remaining : totalSavings)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{settings.monthlyBudget ? `of ${fmtINR(settings.monthlyBudget)} budget` : "kept aside"}</p>
        </Card>
      </div>
      <Card>
        <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Salary → Expenses → Remaining <span className="text-xs font-normal" style={{ color: "var(--ink-faint)" }}>({financeCycleLabel(cycleStart, salaryDay)})</span></h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--ink-faint)" }}>Salary</p>
            <p className="font-display text-xl font-mono-ledger" style={{ color: "var(--ink)" }}>{fmtINR(salaryAmount)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--ink-faint)" }}>Spent</p>
            <p className="font-display text-xl font-mono-ledger" style={{ color: "var(--danger)" }}>{fmtINR(totalOutflow)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--ink-faint)" }}>Remaining</p>
            <p className="font-display text-xl font-mono-ledger" style={{ color: salaryRemaining < 0 ? "var(--danger)" : "var(--forest)" }}>{fmtINR(salaryRemaining)}</p>
          </div>
        </div>
        {!salaryEntry && <p className="text-xs mt-3 text-center" style={{ color: "var(--ink-faint)" }}>No salary logged for this cycle — add it on the Money Tracker page.</p>}
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Weekly habit completion</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekSeries}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: PALETTE.inkFaint }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 100]} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="pct" fill={PALETTE.forest} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Spending by category</h3>
          {byCategory.length === 0 ? (
            <p className="text-sm py-10 text-center" style={{ color: "var(--ink-faint)" }}>No expenses logged this month yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
      <Card>
        <h3 className="font-display text-base mb-3" style={{ color: "var(--ink)" }}>Recent transactions</h3>
        {recent.length === 0 ? (
          <p className="text-sm py-4" style={{ color: "var(--ink-faint)" }}>Nothing logged yet — add your first expense on the Money Tracker page.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--rule)" }}>
            {recent.map((t) => (
              <div key={t.id} className="flex justify-between items-center py-2.5">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{t.categoryName}</p>
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>{prettyDate(t.date)}{t.information ? ` · ${t.information}` : ""}</p>
                </div>
                <p className="font-mono-ledger text-sm" style={{ color: "var(--ink)" }}>{fmtINR(t.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================== HABITS PAGE ============================== */
function HabitForm({ initial, onSave, onCancel, defaultReminder }) {
  const [name, setName] = useState(initial?.name || "");
  const [routineType, setRoutineType] = useState(initial?.routineType || "normal");
  const [description, setDescription] = useState(initial?.description || "");
  const [dayMode, setDayMode] = useState(
    initial ? (Array.isArray(initial.days) ? "custom" : initial.days) : "daily"
  );
  const [customDays, setCustomDays] = useState(Array.isArray(initial?.days) ? initial.days : []);
  const [reminderEnabled, setReminderEnabled] = useState(initial?.reminderEnabled ?? true);
  const [reminderTime, setReminderTime] = useState(initial?.reminderTime || defaultReminder || "20:00");
  
  // Sub-items management
  const [subItems, setSubItems] = useState(initial?.subItems || []);
  const [newSubText, setNewSubText] = useState("");

  const toggleDay = (d) => setCustomDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const addSubItem = () => {
    if (!newSubText.trim()) return;
    setSubItems([...subItems, { id: uid("sub"), name: newSubText.trim() }]);
    setNewSubText("");
  };

  const removeSubItem = (id) => {
    setSubItems(subItems.filter((s) => s.id !== id));
  };

  const submit = () => {
    if (!name.trim()) return;
    const days = dayMode === "custom" ? customDays : dayMode;
    onSave({ name: name.trim(), routineType, description: description.trim(), days, reminderEnabled, reminderTime, subItems });
  };

  return (
    <div>
      <Field label="Habit Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning Routine" autoFocus />
      </Field>

      <Field label="Category / Routine Group">
        <div className="flex gap-2 mb-2">
          {[
            { id: "morning", label: "Morning" },
            { id: "night", label: "Night" },
            { id: "normal", label: "Normal / Regular" }
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setRoutineType(type.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium capitalize flex-1"
              style={{
                background: routineType === type.id ? "var(--ink)" : "var(--paper)",
                color: routineType === type.id ? "var(--paper)" : "var(--ink-soft)",
                border: "1px solid var(--rule)"
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Sub-Checkboxes (Optional)">
        <div className="space-y-2 mb-2">
          {subItems.map((sub, idx) => (
            <div key={sub.id} className="flex items-center gap-2 bg-[var(--paper)] px-3 py-1.5 rounded-lg border border-[var(--rule)]">
              <span className="text-xs text-[var(--ink-soft)] font-mono">{idx + 1}.</span>
              <span className="text-sm flex-1 text-[var(--ink)]">{sub.name}</span>
              <button type="button" onClick={() => removeSubItem(sub.id)} className="text-[var(--ink-faint)] hover:text-[var(--danger)]">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput
            value={newSubText}
            onChange={(e) => setNewSubText(e.target.value)}
            placeholder="Add sub-task (e.g. Brush Teeth)"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubItem(); } }}
          />
          <Button variant="outline" onClick={addSubItem}><Plus size={14} /></Button>
        </div>
      </Field>

      <Field label="Description (optional)">
        <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional detail" />
      </Field>

      <Field label="Days">
        <div className="flex flex-wrap gap-2 mb-2">
          {["daily", "weekdays", "weekends", "custom"].map((mode) => (
            <button key={mode} type="button" onClick={() => setDayMode(mode)} className="px-3 py-1.5 rounded-full text-xs font-medium capitalize"
              style={{ background: dayMode === mode ? "var(--ink)" : "var(--paper)", color: dayMode === mode ? "var(--paper)" : "var(--ink-soft)", border: "1px solid var(--rule)" }}>
              {mode === "daily" ? "Every day" : mode}
            </button>
          ))}
        </div>
        {dayMode === "custom" && (
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((d) => (
              <button key={d} type="button" onClick={() => toggleDay(d)} className="w-10 h-10 rounded-full text-xs font-medium"
                style={{ background: customDays.includes(d) ? "var(--forest)" : "var(--paper)", color: customDays.includes(d) ? "#fff" : "var(--ink-soft)", border: "1px solid var(--rule)" }}>
                {d}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Reminder">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setReminderEnabled((v) => !v)} className="w-11 h-6 rounded-full relative transition-colors" style={{ background: reminderEnabled ? "var(--forest)" : "var(--rule)" }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: reminderEnabled ? 22 : 2 }} />
          </button>
          <TextInput type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} disabled={!reminderEnabled} className="flex-1" />
        </div>
      </Field>

      <div className="flex gap-3 justify-end mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={submit}>Save habit</Button>
      </div>
    </div>
  );
}

function HabitCard({ habit, completedToday, stats, onToggle, onToggleSub, subCompletions = [], onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(true);
  const hasSubItems = habit.subItems && habit.subItems.length > 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Reorder Buttons */}
        <div className="flex flex-col gap-0.5 shrink-0 text-[var(--ink-faint)]">
          <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 hover:text-[var(--ink)] disabled:opacity-20">
            <ArrowUp size={12} />
          </button>
          <GripVertical size={14} className="self-center" />
          <button onClick={onMoveDown} disabled={isLast} className="p-0.5 hover:text-[var(--ink)] disabled:opacity-20">
            <ArrowDown size={12} />
          </button>
        </div>

        <StampCheck checked={completedToday} onClick={onToggle} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate" style={{ color: completedToday ? "var(--ink-faint)" : "var(--ink)", textDecoration: completedToday ? "line-through" : "none" }}>{habit.name}</p>
            {habit.reminderEnabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: "var(--brass-soft)", color: "var(--brass)" }}>
                <Clock size={10} />{habit.reminderTime}
              </span>
            )}
          </div>
          {habit.description && <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{habit.description}</p>}
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--ink-soft)" }}>
            <Flame size={11} color="var(--brass)" /> {stats.streak} day streak · {stats.pct}% overall
          </p>
        </div>

        {hasSubItems && (
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-black/5 text-[var(--ink-soft)]">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}

        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-black/5"><Edit2 size={15} style={{ color: "var(--ink-faint)" }} /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-black/5"><Trash2 size={15} style={{ color: "var(--ink-faint)" }} /></button>
        </div>
      </div>

      {/* Sub Items Checklist */}
      {hasSubItems && expanded && (
        <div className="ml-10 pt-2 border-t border-[var(--rule)] space-y-2">
          {habit.subItems.map((sub) => {
            const isSubDone = subCompletions.includes(sub.id);
            return (
              <div 
                key={sub.id} 
                onClick={() => onToggleSub(habit.id, sub.id)}
                className="flex items-center gap-2.5 cursor-pointer select-none text-xs"
              >
                <div 
                  className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                  style={{ 
                    borderColor: isSubDone ? "var(--forest)" : "var(--rule)", 
                    background: isSubDone ? "var(--forest)" : "transparent" 
                  }}
                >
                  {isSubDone && <Check size={11} color="var(--paper)" strokeWidth={3} />}
                </div>
                <span style={{ color: isSubDone ? "var(--ink-faint)" : "var(--ink)", textDecoration: isSubDone ? "line-through" : "none" }}>
                  {sub.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function habitOverallStats(habit, completions) {
  const doneDates = completions.filter((c) => c.habitId === habit.id && c.completed);
  let scheduledCount = 0, doneCount = 0;
  for (let i = 0; i < 90; i++) {
    const iso = addDays(todayISO(), -i);
    if (habitScheduledOn(habit, iso)) {
      scheduledCount++;
      if (doneDates.some((c) => c.date === iso)) doneCount++;
    }
  }
  const pct = scheduledCount ? Math.round((doneCount / scheduledCount) * 100) : 0;
  let streak = 0, cursor = todayISO();
  for (let i = 0; i < 365; i++) {
    if (!habitScheduledOn(habit, cursor)) { cursor = addDays(cursor, -1); continue; }
    if (doneDates.some((c) => c.date === cursor)) { streak++; cursor = addDays(cursor, -1); } else break;
  }
  let longest = 0, run = 0;
  cursor = addDays(todayISO(), -180);
  for (let i = 0; i < 180; i++) {
    if (habitScheduledOn(habit, cursor)) {
      if (doneDates.some((c) => c.date === cursor)) { run++; longest = Math.max(longest, run); } else run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  return { pct, streak, longest: Math.max(longest, streak) };
}

function HabitsPage({ habits, completions, subCompletions = [], settings, updateHabits, toggleCompletion, toggleSubCompletion, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewRange, setViewRange] = useState("today");
  const iso = todayISO();

  const dashStats = useMemo(() => computeHabitStats(habits, completions), [habits, completions]);
  const weekPct = useMemo(() => {
    const week = weeklyHabitSeries(habits, completions);
    return Math.round(week.reduce((s, d) => s + d.pct, 0) / 7);
  }, [habits, completions]);

  const monthPct = useMemo(() => {
    let scheduled = 0, done = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDays(todayISO(), -i);
      const stats = computeHabitStats(habits, completions, d);
      scheduled += stats.scheduledCount; done += stats.completedCount;
    }
    return scheduled ? Math.round((done / scheduled) * 100) : 0;
  }, [habits, completions]);

  const longestOverall = useMemo(() => {
    return Math.max(0, ...habits.map((h) => habitOverallStats(h, completions).longest));
  }, [habits, completions]);

  const moveHabit = (index, direction, groupList) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= groupList.length) return;
    
    // Swap inside original array
    const itemA = groupList[index];
    const itemB = groupList[targetIndex];
    
    const idxA = habits.findIndex(h => h.id === itemA.id);
    const idxB = habits.findIndex(h => h.id === itemB.id);

    const newHabits = [...habits];
    const temp = newHabits[idxA];
    newHabits[idxA] = newHabits[idxB];
    newHabits[idxB] = temp;

    updateHabits(newHabits);
  };

const saveHabit = async (fields) => {
  try {
    const habitData = {
      name: fields.name,
      description: fields.description || "",
      routine_type: fields.routineType || "normal",
      routineType: fields.routineType || "normal",
      days: fields.days,
      reminder_enabled: fields.reminderEnabled ?? true,
      reminderEnabled: fields.reminderEnabled ?? true,
      reminder_time: fields.reminderTime || null,
      reminderTime: fields.reminderTime || null,
      sub_items: fields.subItems || [],
      subItems: fields.subItems || [],
      active: true,
    };

    if (editingHabit) {
      // UPDATE existing habit
      let updatedHabit;
      try {
        updatedHabit = await api.updateHabit(editingHabit.id, habitData);
      } catch (apiErr) {
        console.warn("Backend update failed, applying locally:", apiErr);
        updatedHabit = { ...editingHabit, ...fields };
      }

      updateHabits(
        habits.map((h) =>
          h.id === editingHabit.id
            ? { ...h, ...fields, ...updatedHabit }
            : h
        )
      );

      showToast("Habit updated");
    } else {
      // INSERT new habit
      let newHabit;
      try {
        newHabit = await api.createHabit(habitData);
      } catch (apiErr) {
        console.warn("Backend create failed, creating locally:", apiErr);
        newHabit = {
          id: uid("h"),
          ...fields,
          createdAt: Date.now(),
        };
      }

      updateHabits([
        ...habits,
        {
          id: newHabit.id,
          ...fields,
          ...newHabit,
          createdAt: newHabit.createdAt || (newHabit.created_at ? new Date(newHabit.created_at).getTime() : Date.now()),
        },
      ]);

      showToast("Habit added");
    }

    setModalOpen(false);
    setEditingHabit(null);

  } catch (error) {
    console.error("Error saving habit:", error);
    showToast("Failed to save habit");
  }
};

  const deleteHabit = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteHabit(confirmDelete);
    } catch (apiErr) {
      console.warn("Backend delete failed, applying locally:", apiErr);
    }
    updateHabits(habits.filter((h) => h.id !== confirmDelete));
    setConfirmDelete(null);
    showToast("Habit deleted");
  };

  // Group Habits by Routine Type
  const morningHabits = habits.filter(h => (h.routineType || "normal") === "morning" && habitScheduledOn(h, iso));
  const nightHabits = habits.filter(h => (h.routineType || "normal") === "night" && habitScheduledOn(h, iso));
  const normalHabits = habits.filter(h => (h.routineType || "normal") === "normal" && habitScheduledOn(h, iso));

  const renderHabitList = (title, list) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-3 mb-6">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--ink-faint)] mb-2 flex items-center gap-1.5">
          {title === "Morning Routine" && <Sun size={14} className="text-[var(--brass)]" />}
          {title === "Night Routine" && <Moon size={14} className="text-[var(--forest)]" />}
          {title} ({list.length})
        </h2>
        {list.map((h, index) => {
          const completedToday = completions.some((c) => c.habitId === h.id && c.date === iso && c.completed);
          const stats = habitOverallStats(h, completions);
          const activeSubCompletions = subCompletions
            .filter(sc => sc.habitId === h.id && sc.date === iso)
            .map(sc => sc.subId);

          return (
            <HabitCard 
              key={h.id} 
              habit={h} 
              completedToday={completedToday} 
              stats={stats}
              subCompletions={activeSubCompletions}
              onToggle={() => toggleCompletion(h.id, iso)}
              onToggleSub={(hId, subId) => toggleSubCompletion(hId, subId, iso)}
              onEdit={() => { setEditingHabit(h); setModalOpen(true); }}
              onDelete={() => setConfirmDelete(h.id)}
              onMoveUp={() => moveHabit(index, -1, list)}
              onMoveDown={() => moveHabit(index, 1, list)}
              isFirst={index === 0}
              isLast={index === list.length - 1}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ink-faint)" }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>Habit Tracker</h1>
        </div>
        <Button variant="primary" onClick={() => { setEditingHabit(null); setModalOpen(true); }}><Plus size={16} />Add Habit</Button>
      </div>

      {morningHabits.length === 0 && nightHabits.length === 0 && normalHabits.length === 0 ? (
        <Card><p className="text-sm text-center py-6" style={{ color: "var(--ink-faint)" }}>Nothing scheduled for today. Add a habit to get started.</p></Card>
      ) : (
        <div>
          {renderHabitList("Morning Routine", morningHabits)}
          {renderHabitList("Normal Habits", normalHabits)}
          {renderHabitList("Night Routine", nightHabits)}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-display text-base" style={{ color: "var(--ink)" }}>Progress</h3>
          <div className="flex gap-1.5">
            {["today", "weekly", "monthly"].map((r) => (
              <button key={r} onClick={() => setViewRange(r)} className="px-3 py-1 rounded-full text-xs font-medium capitalize"
                style={{ background: viewRange === r ? "var(--ink)" : "var(--paper)", color: viewRange === r ? "var(--paper)" : "var(--ink-soft)", border: "1px solid var(--rule)" }}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-8 mb-6">
          <ProgressRing pct={viewRange === "today" ? dashStats.pct : viewRange === "weekly" ? weekPct : monthPct} label={viewRange} />
          <div className="flex gap-8">
            <div>
              <p className="font-display text-2xl flex items-center gap-1" style={{ color: "var(--ink)" }}><Flame size={18} color="var(--brass)" />{dashStats.streak}</p>
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Current streak</p>
            </div>
            <div>
              <p className="font-display text-2xl" style={{ color: "var(--ink)" }}>{longestOverall}</p>
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Longest streak</p>
            </div>
          </div>
        </div>
        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Last 35 days</p>
        <HabitHeatmap habits={habits} completions={completions} />
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingHabit(null); }} title={editingHabit ? "Edit habit" : "Add habit"}>
        <HabitForm initial={editingHabit} onSave={saveHabit} onCancel={() => { setModalOpen(false); setEditingHabit(null); }} defaultReminder={settings.reminderDefault} />
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title="Delete this habit?" message="This will remove the habit and its history. This can't be undone." onConfirm={deleteHabit} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}

/* ============================== REMINDERS & BUYS SCREEN ============================== */
function RemindersAndBuysPage({ todos = [], buys = [], updateTodos, updateBuys, showToast }) {
  const [newTodo, setNewTodo] = useState("");
  const [newBuy, setNewBuy] = useState("");

  const addTodo = () => {
    if (!newTodo.trim()) return;
    updateTodos([...todos, { id: uid("td"), text: newTodo.trim(), completed: false }]);
    setNewTodo("");
    showToast("Reminder added");
  };

  const toggleTodo = (id) => {
    updateTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id) => {
    updateTodos(todos.filter(t => t.id !== id));
  };

  const addBuy = () => {
    if (!newBuy.trim()) return;
    updateBuys([...buys, { id: uid("b"), text: newBuy.trim(), completed: false }]);
    setNewBuy("");
    showToast("Item added to buys");
  };

  const toggleBuy = (id) => {
    updateBuys(buys.map(b => b.id === id ? { ...b, completed: !b.completed } : b));
  };

  const deleteBuy = (id) => {
    updateBuys(buys.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-120px)]">
      <div>
        <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>Quick Reminders & Buys</h1>
        <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Manage quick tasks and item purchase list in one split view.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* TOP / LEFT HALF: QUICK REMINDERS (TO-DO) */}
        <Card className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ListTodo size={18} className="text-[var(--forest)]" />
              <h3 className="font-display text-lg" style={{ color: "var(--ink)" }}>Quick Reminders</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--paper)] text-[var(--ink-soft)] border border-[var(--rule)]">
              {todos.filter(t => !t.completed).length} open
            </span>
          </div>

          <div className="flex gap-2 mb-4">
            <TextInput 
              value={newTodo} 
              onChange={(e) => setNewTodo(e.target.value)} 
              placeholder="Add reminder..." 
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
            />
            <Button variant="primary" onClick={addTodo}><Plus size={16} /></Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
            {todos.length === 0 ? (
              <p className="text-xs text-center py-8 text-[var(--ink-faint)]">No reminders yet.</p>
            ) : (
              todos.map(todo => (
                <div key={todo.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--rule)] bg-[var(--paper)]">
                  <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => toggleTodo(todo.id)}>
                    <div 
                      className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
                      style={{ 
                        borderColor: todo.completed ? "var(--forest)" : "var(--rule)", 
                        background: todo.completed ? "var(--forest)" : "transparent" 
                      }}
                    >
                      {todo.completed && <Check size={12} color="var(--paper)" strokeWidth={3} />}
                    </div>
                    <span className="text-sm truncate" style={{ color: todo.completed ? "var(--ink-faint)" : "var(--ink)", textDecoration: todo.completed ? "line-through" : "none" }}>
                      {todo.text}
                    </span>
                  </div>
                  <button onClick={() => deleteTodo(todo.id)} className="p-1 text-[var(--ink-faint)] hover:text-[var(--danger)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* BOTTOM / RIGHT HALF: BUYS */}
        <Card className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-[var(--brass)]" />
              <h3 className="font-display text-lg" style={{ color: "var(--ink)" }}>Buys & Wishlist</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--paper)] text-[var(--ink-soft)] border border-[var(--rule)]">
              {buys.filter(b => !b.completed).length} items
            </span>
          </div>

          <div className="flex gap-2 mb-4">
            <TextInput 
              value={newBuy} 
              onChange={(e) => setNewBuy(e.target.value)} 
              placeholder="Add item to buy..." 
              onKeyDown={(e) => e.key === "Enter" && addBuy()}
            />
            <Button variant="primary" onClick={addBuy}><Plus size={16} /></Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
            {buys.length === 0 ? (
              <p className="text-xs text-center py-8 text-[var(--ink-faint)]">No buying list items.</p>
            ) : (
              buys.map(buy => (
                <div key={buy.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--rule)] bg-[var(--paper)]">
                  <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => toggleBuy(buy.id)}>
                    <div 
                      className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
                      style={{ 
                        borderColor: buy.completed ? "var(--brass)" : "var(--rule)", 
                        background: buy.completed ? "var(--brass)" : "transparent" 
                      }}
                    >
                      {buy.completed && <Check size={12} color="var(--paper)" strokeWidth={3} />}
                    </div>
                    <span className="text-sm truncate" style={{ color: buy.completed ? "var(--ink-faint)" : "var(--ink)", textDecoration: buy.completed ? "line-through" : "none" }}>
                      {buy.text}
                    </span>
                  </div>
                  <button onClick={() => deleteBuy(buy.id)} className="p-1 text-[var(--ink-faint)] hover:text-[var(--danger)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================== MONEY PAGE ============================== */
const ADD_NEW_CATEGORY_VALUE = "__add_new_category__";

function ExpenseForm({ initial, categories, onSave, onCancel, onAddCategory }) {
  const [date, setDate] = useState(initial?.date || todayISO());
  const [categoryName, setCategoryName] = useState(initial?.categoryName || categories[0]?.name || "");
  const [amount, setAmount] = useState(initial?.amount || "");
  const [information, setInformation] = useState(initial?.information || "");
  const [voicePreview, setVoicePreview] = useState(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleCategorySelect = (e) => {
    if (e.target.value === ADD_NEW_CATEGORY_VALUE) {
      setAddingCategory(true);
      setNewCategoryName("");
    } else {
      setCategoryName(e.target.value);
    }
  };

  const confirmNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    onAddCategory(name);
    setCategoryName(name);
    setAddingCategory(false);
    setNewCategoryName("");
  };

  const handleTranscript = (text) => {
    const parsed = parseVoiceExpense(text, categories);
    setVoicePreview({ text, ...parsed });
    setDate(parsed.date);
    if (parsed.amount != null) setAmount(parsed.amount);
    if (parsed.information) setInformation(parsed.information);
    if (parsed.categoryConfident && parsed.category) setCategoryName(parsed.category);
  };

  const submit = () => {
    if (!amount || !categoryName) return;
    onSave({ date, categoryName, amount: parseFloat(amount), information: information.trim() });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl" style={{ background: "var(--paper)" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>Speak your entry</p>
          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>e.g. "16th August rent 10000"</p>
        </div>
        <MicButton onTranscript={handleTranscript} />
      </div>
      {voicePreview && (
        <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: "var(--forest-soft)", color: "var(--forest)" }}>
          Heard: "{voicePreview.text}" — fields below updated, please verify.
          {!voicePreview.categoryConfident && <span className="block mt-1 font-medium">Couldn't detect a category — please pick one.</span>}
        </div>
      )}
      <Field label="Date">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Category">
        {addingCategory ? (
          <div className="flex gap-2">
            <TextInput
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && confirmNewCategory()}
            />
            <Button variant="outline" onClick={confirmNewCategory}><Check size={14} /></Button>
            <Button variant="ghost" onClick={() => setAddingCategory(false)}><X size={14} /></Button>
          </div>
        ) : (
          <select value={categoryName} onChange={handleCategorySelect} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            <option value={ADD_NEW_CATEGORY_VALUE}>+ Add new category…</option>
          </select>
        )}
      </Field>
      <Field label="Amount (₹)">
        <TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Information (optional)">
        <TextInput value={information} onChange={(e) => setInformation(e.target.value)} placeholder="e.g. Chennai to Hyderabad ticket" />
      </Field>
      <div className="flex gap-3 justify-end mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={submit}>Save Expense</Button>
      </div>
    </div>
  );
}

function SalaryForm({ initial, onSave, onCancel }) {
  const [date, setDate] = useState(initial?.date || todayISO());
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const submit = () => {
    if (!amount) return;
    onSave({ date, amount: parseFloat(amount) });
  };
  return (
    <div>
      <Field label="Date received">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Salary amount (₹)">
        <TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
      </Field>
      <div className="flex gap-3 justify-end mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={submit}>Save Salary</Button>
      </div>
    </div>
  );
}

function MoneyPage({ transactions, categories, updateCategories, salaries, updateSalaries, settings, updateTransactions, showToast }) {
  const [cycleOffset, setCycleOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);

  const salaryDay = settings.salaryDay ?? 28;
  const currentCycleStart = useMemo(() => financeCycleStart(todayISO(), salaryDay), [salaryDay]);
  const cycleStart = useMemo(() => shiftCycleStart(currentCycleStart, cycleOffset, salaryDay), [currentCycleStart, cycleOffset, salaryDay]);
  const cycleLabel = financeCycleLabel(cycleStart, salaryDay);

  const monthTx = transactions.filter((t) => inCycle(t.date, cycleStart, salaryDay));
  const expenses = monthTx.filter((t) => t.categoryName !== "Savings");
  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalSavings = monthTx.filter((t) => t.categoryName === "Savings").reduce((s, t) => s + Number(t.amount), 0);
  const remaining = settings.monthlyBudget != null ? settings.monthlyBudget - totalExpense : null;

  const salaryEntry = salaries.find((s) => s.cycleStart === cycleStart);
  const salaryAmount = salaryEntry ? Number(salaryEntry.amount) : 0;
  const totalOutflow = monthTx.reduce((s, t) => s + Number(t.amount), 0);
  const salaryRemaining = salaryAmount - totalOutflow;

  const byCategory = useMemo(() => {
    const map = {};
    monthTx.forEach((t) => { map[t.categoryName] = (map[t.categoryName] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTx]);

  const COLORS = [PALETTE.forest, PALETTE.brass, "#8FB68C", "#C79B5E", "#6E8B72", "#D9B67E"];

  const saveTx = (fields) => {
    if (editingTx) {
      updateTransactions(transactions.map((t) => t.id === editingTx.id ? { ...t, ...fields } : t));
      showToast("Transaction updated");
    } else {
      updateTransactions([...transactions, { id: uid("tx"), createdAt: Date.now(), ...fields }]);
      showToast("Expense saved");
    }
    setModalOpen(false); setEditingTx(null);
  };

  const addCategoryInline = (name) => {
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    updateCategories([...categories, { id: uid("cat"), name, createdAt: Date.now() }]);
    showToast(`Category "${name}" added`);
  };

  const saveSalary = (fields) => {
    const entryCycleStart = financeCycleStart(fields.date, salaryDay);
    const existing = salaries.find((s) => s.cycleStart === entryCycleStart);
    if (existing) {
      updateSalaries(salaries.map((s) => s.id === existing.id ? { ...s, ...fields, cycleStart: entryCycleStart } : s));
    } else {
      updateSalaries([...salaries, { id: uid("sal"), cycleStart: entryCycleStart, createdAt: Date.now(), ...fields }]);
    }
    setSalaryModalOpen(false);
    showToast("Salary saved");
  };

  const deleteTx = () => {
    updateTransactions(transactions.filter((t) => t.id !== confirmDelete));
    setConfirmDelete(null);
    showToast("Transaction deleted");
  };

  const sortedTx = [...monthTx].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setCycleOffset((m) => m - 1)} className="p-2 rounded-lg hover:bg-black/5"><ChevronLeft size={18} /></button>
          <div>
            <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>{cycleLabel}</h1>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Finance cycle starts on the {salaryDay}th (salary day)</p>
          </div>
          <button onClick={() => setCycleOffset((m) => m + 1)} className="p-2 rounded-lg hover:bg-black/5"><ChevronRight size={18} /></button>
        </div>
        <Button variant="primary" onClick={() => { setEditingTx(null); setModalOpen(true); }}><Plus size={16} />Add Expense</Button>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-display text-base" style={{ color: "var(--ink)" }}>Salary → Expenses → Remaining</h3>
          <Button variant="outline" onClick={() => setSalaryModalOpen(true)}>{salaryEntry ? "Edit salary" : "Add salary"}</Button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--ink-faint)" }}>Salary</p>
            <p className="font-display text-xl font-mono-ledger" style={{ color: "var(--ink)" }}>{fmtINR(salaryAmount)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--ink-faint)" }}>Spent</p>
            <p className="font-display text-xl font-mono-ledger" style={{ color: "var(--danger)" }}>{fmtINR(totalOutflow)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--ink-faint)" }}>Remaining</p>
            <p className="font-display text-xl font-mono-ledger" style={{ color: salaryRemaining < 0 ? "var(--danger)" : "var(--forest)" }}>{fmtINR(salaryRemaining)}</p>
          </div>
        </div>
        {!salaryEntry && <p className="text-xs mt-3 text-center" style={{ color: "var(--ink-faint)" }}>No salary logged for this cycle yet — add it when you receive it.</p>}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Total expenses</p>
          <p className="font-display text-2xl font-mono-ledger" style={{ color: "var(--ink)" }}>{fmtINR(totalExpense)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Total savings</p>
          <p className="font-display text-2xl font-mono-ledger" style={{ color: "var(--forest)" }}>{fmtINR(totalSavings)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>{settings.monthlyBudget != null ? "Remaining budget" : "Avg. daily spend"}</p>
          <p className="font-display text-2xl font-mono-ledger" style={{ color: "var(--brass)" }}>
            {settings.monthlyBudget != null
              ? fmtINR(remaining)
              : fmtINR(Math.round(totalExpense / Math.max(1, Math.round((new Date(financeCycleEnd(cycleStart, salaryDay) + "T00:00:00") - new Date(cycleStart + "T00:00:00")) / 86400000))))}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Monthly spending by category</h3>
          {byCategory.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--ink-faint)" }}>No transactions this month.</p>
          ) : (
            <div className="space-y-2.5">
              {byCategory.map((c) => (
                <div key={c.name} className="flex justify-between items-center pb-2" style={{ borderBottom: "1px dotted var(--rule)" }}>
                  <span className="text-sm" style={{ color: "var(--ink-soft)" }}>{c.name}</span>
                  <span className="font-mono-ledger text-sm" style={{ color: "var(--ink)" }}>{fmtINR(c.value)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Distribution</h3>
          {byCategory.length === 0 ? (
            <p className="text-sm py-10 text-center" style={{ color: "var(--ink-faint)" }}>—</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-display text-base mb-3" style={{ color: "var(--ink)" }}>Transactions</h3>
        {sortedTx.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--ink-faint)" }}>No transactions for this month yet.</p>
        ) : (
          <>
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: "var(--ink-faint)" }}>
                    <th className="font-normal pb-2 text-xs uppercase tracking-wide">Date</th>
                    <th className="font-normal pb-2 text-xs uppercase tracking-wide">Category</th>
                    <th className="font-normal pb-2 text-xs uppercase tracking-wide">Amount</th>
                    <th className="font-normal pb-2 text-xs uppercase tracking-wide">Information</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTx.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--rule)" }}>
                      <td className="py-2.5 font-mono-ledger" style={{ color: "var(--ink-soft)" }}>{formatDateDisplay(t.date, settings.dateFormat)}</td>
                      <td className="py-2.5" style={{ color: "var(--ink)" }}>{t.categoryName}</td>
                      <td className="py-2.5 font-mono-ledger" style={{ color: "var(--ink)" }}>{fmtINR(t.amount)}</td>
                      <td className="py-2.5" style={{ color: "var(--ink-faint)" }}>{t.information || "—"}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => { setEditingTx(t); setModalOpen(true); }} className="p-1.5 rounded hover:bg-black/5"><Edit2 size={14} style={{ color: "var(--ink-faint)" }} /></button>
                        <button onClick={() => setConfirmDelete(t.id)} className="p-1.5 rounded hover:bg-black/5"><Trash2 size={14} style={{ color: "var(--ink-faint)" }} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-2">
              {sortedTx.map((t) => (
                <div key={t.id} className="p-3 rounded-xl" style={{ background: "var(--paper)" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{t.categoryName}</p>
                      <p className="text-xs font-mono-ledger" style={{ color: "var(--ink-faint)" }}>{formatDateDisplay(t.date, settings.dateFormat)}</p>
                    </div>
                    <p className="font-mono-ledger text-sm" style={{ color: "var(--ink)" }}>{fmtINR(t.amount)}</p>
                  </div>
                  {t.information && <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>{t.information}</p>}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setEditingTx(t); setModalOpen(true); }} className="text-xs flex items-center gap-1" style={{ color: "var(--ink-soft)" }}><Edit2 size={12} />Edit</button>
                    <button onClick={() => setConfirmDelete(t.id)} className="text-xs flex items-center gap-1" style={{ color: "var(--danger)" }}><Trash2 size={12} />Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingTx(null); }} title={editingTx ? "Edit expense" : "Add expense"}>
        <ExpenseForm initial={editingTx} categories={categories} onAddCategory={addCategoryInline} onSave={saveTx} onCancel={() => { setModalOpen(false); setEditingTx(null); }} />
      </Modal>

      <Modal open={salaryModalOpen} onClose={() => setSalaryModalOpen(false)} title={salaryEntry ? "Edit salary for this cycle" : "Add salary for this cycle"}>
        <SalaryForm initial={salaryEntry ? { date: salaryEntry.date, amount: salaryEntry.amount } : { date: cycleStart }} onSave={saveSalary} onCancel={() => setSalaryModalOpen(false)} />
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title="Delete this transaction?" message="This can't be undone." onConfirm={deleteTx} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}

/* ============================== SETTINGS PAGE ============================== */
function SettingsPage({ habits, updateHabits, categories, updateCategories, transactions, updateTransactions, settings, updateSettings, showToast }) {
  const [newCategory, setNewCategory] = useState("");
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
  const [moveTo, setMoveTo] = useState("");
  const [habitModalOpen, setHabitModalOpen] = useState(null);

  const addCategory = () => {
    if (!newCategory.trim()) return;
    updateCategories([...categories, { id: uid("cat"), name: newCategory.trim(), createdAt: Date.now() }]);
    setNewCategory("");
    showToast("Category added");
  };

  const saveCategoryEdit = (id) => {
    updateCategories(categories.map((c) => c.id === id ? { ...c, name: editingCatName.trim() } : c));
    setEditingCatId(null);
    showToast("Category renamed");
  };

  const requestDeleteCategory = (cat) => {
    const inUse = transactions.some((t) => t.categoryName === cat.name);
    setConfirmDeleteCat({ cat, inUse });
    setMoveTo(categories.find((c) => c.id !== cat.id)?.name || "");
  };

  const confirmCategoryDelete = () => {
    const { cat, inUse } = confirmDeleteCat;
    if (inUse && moveTo) {
      updateTransactions(transactions.map((t) => t.categoryName === cat.name ? { ...t, categoryName: moveTo } : t));
    }
    updateCategories(categories.filter((c) => c.id !== cat.id));
    setConfirmDeleteCat(null);
    showToast("Category deleted");
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) { showToast("Browser notifications aren't supported here"); return; }
    const perm = await Notification.requestPermission();
    updateSettings({ ...settings, notificationsEnabled: perm === "granted" });
    showToast(perm === "granted" ? "Notifications enabled" : "Notifications not granted");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>Settings</h1>

      <Card>
        <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Habits</h3>
        <div className="space-y-2 mb-4">
          {habits.map((h) => (
            <div key={h.id} className="flex justify-between items-center py-2" style={{ borderBottom: "1px dotted var(--rule)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{h.name}</p>
                <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  {Array.isArray(h.days) ? h.days.join(", ") : h.days === "daily" ? "Every day" : h.days} · {h.reminderEnabled ? `Reminder ${h.reminderTime}` : "No reminder"}
                </p>
              </div>
              <button onClick={() => setHabitModalOpen(h)} className="p-2 rounded-lg hover:bg-black/5"><Edit2 size={14} style={{ color: "var(--ink-faint)" }} /></button>
            </div>
          ))}
        </div>
        <Field label="Default reminder time">
          <TextInput type="time" value={settings.reminderDefault} onChange={(e) => updateSettings({ ...settings, reminderDefault: e.target.value })} className="max-w-[160px]" />
        </Field>
      </Card>

      <Card>
        <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Money categories</h3>
        <div className="space-y-2 mb-4">
          {categories.map((c) => (
            <div key={c.id} className="flex justify-between items-center py-2" style={{ borderBottom: "1px dotted var(--rule)" }}>
              {editingCatId === c.id ? (
                <TextInput value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} className="max-w-[200px]" autoFocus />
              ) : (
                <p className="text-sm" style={{ color: "var(--ink)" }}>{c.name}</p>
              )}
              <div className="flex gap-1">
                {editingCatId === c.id ? (
                  <button onClick={() => saveCategoryEdit(c.id)} className="p-2 rounded-lg hover:bg-black/5"><Check size={14} style={{ color: "var(--forest)" }} /></button>
                ) : (
                  <button onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }} className="p-2 rounded-lg hover:bg-black/5"><Edit2 size={14} style={{ color: "var(--ink-faint)" }} /></button>
                )}
                <button onClick={() => requestDeleteCategory(c)} className="p-2 rounded-lg hover:bg-black/5"><Trash2 size={14} style={{ color: "var(--ink-faint)" }} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" onKeyDown={(e) => e.key === "Enter" && addCategory()} />
          <Button variant="outline" onClick={addCategory}><Plus size={15} />Add</Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>Notifications</h3>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {settings.notificationsEnabled ? <Bell size={16} color="var(--forest)" /> : <BellOff size={16} color="var(--ink-faint)" />}
            <span className="text-sm" style={{ color: "var(--ink)" }}>{settings.notificationsEnabled ? "Browser notifications enabled" : "Browser notifications disabled"}</span>
          </div>
          <Button variant="outline" onClick={requestNotificationPermission}>{settings.notificationsEnabled ? "Re-check" : "Enable"}</Button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>Habit reminders fire from this browser tab while it's open. For reliable delivery when the app is closed, connect a backend notification service later.</p>
      </Card>

      <Card>
        <h3 className="font-display text-base mb-4" style={{ color: "var(--ink)" }}>General</h3>
        <Field label="Theme">
          <div className="flex gap-2">
            {[{ id: "light", icon: Sun }, { id: "dark", icon: Moon }, { id: "system", icon: Monitor }].map(({ id, icon: Icon }) => (
              <button key={id} onClick={() => updateSettings({ ...settings, theme: id })} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl capitalize text-xs font-medium"
                style={{ background: settings.theme === id ? "var(--ink)" : "var(--paper)", color: settings.theme === id ? "var(--paper)" : "var(--ink-soft)", border: "1px solid var(--rule)" }}>
                <Icon size={16} />{id}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Date format">
          <select value={settings.dateFormat} onChange={(e) => updateSettings({ ...settings, dateFormat: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          </select>
        </Field>

        <Field label="Monthly budget (optional, ₹)">
          <TextInput type="number" value={settings.monthlyBudget ?? ""} onChange={(e) => updateSettings({ ...settings, monthlyBudget: e.target.value ? parseFloat(e.target.value) : null })} placeholder="No budget set" />
        </Field>

        <Field label="Salary day (finance cycle starts on this date each month)">
          <TextInput type="number" min="1" max="31" value={settings.salaryDay ?? 28}
            onChange={(e) => updateSettings({ ...settings, salaryDay: e.target.value ? Math.min(31, Math.max(1, parseInt(e.target.value, 10))) : 28 })} placeholder="28" />
          <p className="text-xs mt-1.5" style={{ color: "var(--ink-faint)" }}>Money Tracker "months" run from this day to the day before it next month, instead of the calendar month.</p>
        </Field>
      </Card>

      <Modal open={!!habitModalOpen} onClose={() => setHabitModalOpen(null)} title="Edit habit">
        {habitModalOpen && (
          <HabitForm initial={habitModalOpen}
            onSave={(fields) => { updateHabits(habits.map((h) => h.id === habitModalOpen.id ? { ...h, ...fields } : h)); setHabitModalOpen(null); showToast("Habit updated"); }}
            onCancel={() => setHabitModalOpen(null)} defaultReminder={settings.reminderDefault} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteCat}
        title="Delete this category?"
        message={confirmDeleteCat?.inUse ? "This category has existing transactions. Choose another category to move them to below, or they'll be relabeled automatically." : "This can't be undone."}
        onConfirm={confirmCategoryDelete}
        onCancel={() => setConfirmDeleteCat(null)}
      />
    </div>
  );
}

/* ============================== APP ROOT ============================== */
export default function HabitMoneyTracker() {
  const { data, setData, loading, error, isBackendOffline } = useTrackerData();
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    const finalMsg = isBackendOffline ? `${msg} (Saved in local cache)` : msg;
    setToast(finalMsg);
    setTimeout(() => setToast(null), 3000);
  }, [isBackendOffline]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PALETTE.paper }}>
        <Loader2 className="animate-spin" size={24} color={PALETTE.ink} />
      </div>
    );
  }

  const updateHabits = (habits) => setData((d) => ({ ...d, habits }));
  const updateCategories = (categories) => setData((d) => ({ ...d, categories }));
  const updateTransactions = (transactions) => setData((d) => ({ ...d, transactions }));
  const updateSettings = (settings) => setData((d) => ({ ...d, settings }));
  const updateSalaries = (salaries) => setData((d) => ({ ...d, salaries }));
  const updateTodos = (todos) => setData((d) => ({ ...d, todos }));
  const updateBuys = (buys) => setData((d) => ({ ...d, buys }));

  const toggleCompletion = (habitId, iso) => {
    setData((d) => {
      const existing = d.completions.find((c) => c.habitId === habitId && c.date === iso);
      let completions;
      if (existing) {
        completions = d.completions.map((c) => c.habitId === habitId && c.date === iso ? { ...c, completed: !c.completed, timestamp: Date.now() } : c);
      } else {
        completions = [...d.completions, { habitId, date: iso, completed: true, timestamp: Date.now() }];
      }
      return { ...d, completions };
    });
  };

  const toggleSubCompletion = (habitId, subId, iso) => {
    setData((d) => {
      const subCompletions = d.subCompletions || [];
      const existing = subCompletions.find((sc) => sc.habitId === habitId && sc.subId === subId && sc.date === iso);
      let updated;
      if (existing) {
        updated = subCompletions.filter((sc) => !(sc.habitId === habitId && sc.subId === subId && sc.date === iso));
      } else {
        updated = [...subCompletions, { habitId, subId, date: iso, timestamp: Date.now() }];
      }
      return { ...d, subCompletions: updated };
    });
  };

  const isDark = data.settings.theme === "dark" || (data.settings.theme === "system" && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const vars = isDark
    ? { "--paper": PALETTE.paperDark, "--card": PALETTE.cardDark, "--ink": "#EDEAE0", "--ink-soft": "#B8BBB0", "--ink-faint": "#7C8272", "--rule": "#3A3F35", "--forest": "#6FA36A", "--forest-soft": "#2A3A2A", "--brass": "#D3A968", "--brass-soft": "#3A2F1E", "--danger": "#D9705C", "--danger-soft": "#3A2622" }
    : { "--paper": PALETTE.paper, "--card": "#FFFFFF", "--ink": PALETTE.ink, "--ink-soft": PALETTE.inkSoft, "--ink-faint": PALETTE.inkFaint, "--rule": PALETTE.rule, "--forest": PALETTE.forest, "--forest-soft": PALETTE.forestSoft, "--brass": PALETTE.brass, "--brass-soft": PALETTE.brassSoft, "--danger": PALETTE.danger, "--danger-soft": PALETTE.dangerSoft };

  return (
    <div style={{ ...vars, background: "var(--paper)", minHeight: "100vh" }} className="flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-mono-ledger { font-family: 'IBM Plex Mono', monospace; }
        body, input, select, button { font-family: 'Inter', sans-serif; }
        @keyframes fadein { from { opacity: 0; transform: translate(-50%, 8px);} to { opacity: 1; transform: translate(-50%, 0);} }
      `}</style>
      <Sidebar page={page} setPage={setPage} />
      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 pb-24 md:pb-8 max-w-5xl mx-auto w-full">
        {isBackendOffline && (
          <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all shadow-sm" style={{ background: "var(--brass-soft)", color: "var(--ink)", border: "1px solid var(--brass)" }}>
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={17} style={{ color: "var(--brass)" }} />
              <span><strong>Backend Offline:</strong> Your Flask server is unreachable. Changes are currently being saved safely to your <strong>browser cache (localStorage)</strong> and will auto-sync when the backend reconnects.</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded shrink-0" style={{ background: "var(--brass)", color: "#FFFFFF" }}>Browser Cache Mode</span>
          </div>
        )}
        {error && <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>}
        {page === "dashboard" && <Dashboard habits={data.habits} completions={data.completions} transactions={data.transactions} categories={data.categories} salaries={data.salaries} settings={data.settings} />}
        {page === "habits" && <HabitsPage habits={data.habits} completions={data.completions} subCompletions={data.subCompletions} settings={data.settings} updateHabits={updateHabits} toggleCompletion={toggleCompletion} toggleSubCompletion={toggleSubCompletion} showToast={showToast} />}
        {page === "reminders_buys" && <RemindersAndBuysPage todos={data.todos} buys={data.buys} updateTodos={updateTodos} updateBuys={updateBuys} showToast={showToast} />}
        {page === "money" && <MoneyPage transactions={data.transactions} categories={data.categories} updateCategories={updateCategories} salaries={data.salaries} updateSalaries={updateSalaries} settings={data.settings} updateTransactions={updateTransactions} showToast={showToast} />}
        {page === "settings" && <SettingsPage habits={data.habits} updateHabits={updateHabits} categories={data.categories} updateCategories={updateCategories} transactions={data.transactions} updateTransactions={updateTransactions} settings={data.settings} updateSettings={updateSettings} showToast={showToast} />}
      </main>
      <BottomNav page={page} setPage={setPage} />
      <Toast toast={toast} />
    </div>
  );
}