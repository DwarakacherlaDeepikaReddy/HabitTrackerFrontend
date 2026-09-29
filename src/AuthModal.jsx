import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";
import { X, AlertCircle, CheckCircle, Loader2, Mail, Lock, User, LogIn, UserPlus } from "lucide-react";

// Google Client ID from environment variable or app configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AuthModal({ open, onClose, onAuthSuccess }) {
  const [tab, setTab] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const googleBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccessMsg("");

    if (typeof window !== "undefined" && !window.google) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleOAuth();
      document.body.appendChild(script);
    } else if (typeof window !== "undefined" && window.google) {
      initGoogleOAuth();
    }
  }, [open]);

  const handleGoogleCredentialResponse = useCallback(async (response) => {
    if (!response || !response.credential) return;
    setGoogleLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await api.googleAuth({ credential: response.credential });
      if (res?.token && res?.user) {
        localStorage.setItem("authToken", res.token);
        localStorage.setItem("authUser", JSON.stringify(res.user));
        setSuccessMsg(`Welcome, ${res.user.name}!`);
        setTimeout(() => { onAuthSuccess(res.user, res.token); onClose(); }, 500);
      }
    } catch (err) {
      setError(err.message || "Google authentication failed.");
    } finally {
      setGoogleLoading(false);
    }
  }, [onAuthSuccess, onClose]);

  const initGoogleOAuth = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !window.google.accounts) return;

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID.trim(),
        callback: handleGoogleCredentialResponse,
        auto_select: false,
      });

      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          width: "100%",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
        });
      }
    } catch (e) {
      console.warn("[Google OAuth Init Warning]:", e);
    }
  }, [handleGoogleCredentialResponse]);

  const handleGoogleSignInClick = () => {
    setError("");

    if (!GOOGLE_CLIENT_ID) {
      setError("Google OAuth Client ID is not configured yet. Please register directly using Email & Password below!");
      return;
    }

    if (!window.google?.accounts?.id) {
      setError("Google sign-in script is loading. Please try again or use Email Sign Up.");
      return;
    }
    window.google.accounts.id.prompt();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (tab === "signup") {
        if (!name.trim()) throw new Error("Please enter your name");
        if (!email.trim()) throw new Error("Please enter your email");
        if (!password || password.length < 6) throw new Error("Password must be at least 6 characters long");

        const res = await api.register(name.trim(), email.trim(), password);
        if (res?.token && res?.user) {
          localStorage.setItem("authToken", res.token);
          localStorage.setItem("authUser", JSON.stringify(res.user));
          setSuccessMsg(`Registration successful! Welcome, ${res.user.name}.`);
          setTimeout(() => {
            onAuthSuccess(res.user, res.token);
            onClose();
          }, 600);
        }
      } else {
        if (!email.trim()) throw new Error("Please enter your email");
        if (!password) throw new Error("Please enter your password");

        const res = await api.login(email.trim(), password);
        if (res?.token && res?.user) {
          localStorage.setItem("authToken", res.token);
          localStorage.setItem("authUser", JSON.stringify(res.user));
          setSuccessMsg(`Welcome back, ${res.user.name}!`);
          setTimeout(() => {
            onAuthSuccess(res.user, res.token);
            onClose();
          }, 600);
        }
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl relative transition-all"
        style={{ background: "var(--card)", border: "1px solid var(--rule)" }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tabs */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-serif font-semibold text-stone-900 dark:text-stone-100 mb-1">
            Welcome to Daybook
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Sign in or create an account to activate email notifications & session syncing.
          </p>

          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl mt-4 border border-stone-200 dark:border-stone-700">
            <button
              type="button"
              onClick={() => { setTab("signin"); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === "signin"
                  ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm"
                  : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab("signup"); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === "signup"
                  ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm"
                  : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-200"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Register / Sign Up
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === "signup" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 rounded-xl font-medium text-sm transition-all shadow flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{tab === "signup" ? "Creating Account..." : "Signing In..."}</span>
              </>
            ) : (
              <span>{tab === "signup" ? "Create Free Account" : "Sign In to Account"}</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200 dark:border-stone-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-stone-900 px-2 text-stone-400 dark:text-stone-500 font-medium">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google OAuth Section */}
        <div className="space-y-2">
          <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]"></div>

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignInClick}
            className="w-full py-2.5 px-4 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 border border-stone-300 dark:border-stone-600 text-stone-800 dark:text-stone-100 rounded-xl font-medium text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-5 text-center text-[11px] text-stone-400 dark:text-stone-500 border-t border-stone-200 dark:border-stone-800 pt-3">
          🔒 Reminders for your logged-in session will be sent directly to your registered email address.
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
