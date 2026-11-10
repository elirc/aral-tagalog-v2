"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError, type AuthTokens } from "@/lib/api";
import { deviceTz, useProgress } from "@/lib/progress";

type Mode = "login" | "register";

/** A hung request (captive portal, dead cell signal) must not spin forever. */
const AUTH_TIMEOUT_MS = 15_000;

class AuthTimeout extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new AuthTimeout()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

interface FormError {
  text: string;
  /** register hit an existing account — offer the login link inline */
  suggestLogin?: boolean;
}

/**
 * Turn API/network failures into something a person can act on. The raw
 * messages ("Failed to fetch", "Load failed", "invalid body") are developer
 * text and differ per browser.
 */
function describeError(err: unknown, mode: Mode): FormError {
  if (err instanceof AuthTimeout) {
    return { text: "The server is taking too long to respond. Check your connection and try again." };
  }
  if (err instanceof ApiError) {
    if (err.status === 401) return { text: "That email and password don't match. Please try again." };
    if (err.status === 409) {
      return { text: "An account with this email already exists.", suggestLogin: mode === "register" };
    }
    if (err.status === 429) return { text: "Too many attempts. Wait a minute, then try again." };
    if (err.status === 400) {
      if (/email/i.test(err.message)) return { text: "Please enter a valid email address." };
      if (/password|8/i.test(err.message)) return { text: "Your password needs at least 8 characters." };
      return { text: "Please check your email and password." };
    }
    return { text: "Something went wrong on our end. Please try again in a moment." };
  }
  // fetch() rejects with a TypeError when the server can't be reached at all
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { text: "You're offline. Connect to the internet and try again." };
  }
  return { text: "Can't reach the server right now. Please try again in a moment." };
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { adoptAuth, user, needsRelogin, progress } = useProgress();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);
  // state updates are async — a ref blocks a second tap/Enter in the same frame
  const inFlight = useRef(false);

  const guestWithProgress = !user && progress.lessonsCompleted > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    let tokens: AuthTokens;
    try {
      tokens = await withTimeout(
        mode === "register"
          ? api.register(email.trim(), password, deviceTz())
          : api.login(email.trim(), password),
        AUTH_TIMEOUT_MS,
      );
    } catch (err) {
      setError(describeError(err, mode));
      setBusy(false);
      inFlight.current = false;
      return;
    }
    // adoptAuth swallows sync failures itself; the account is signed in either way
    await adoptAuth(tokens);
    // replace: the back gesture shouldn't land on a form you've already used
    router.replace("/");
  };

  const clearError = () => {
    if (error) setError(null);
  };

  return (
    <main className="container">
      <div className="center-card">
        <h1 className="auth-title">{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        {mode === "login" && user && needsRelogin ? (
          <p className="auth-note">Your session expired. Log in again to keep your progress syncing.</p>
        ) : mode === "register" ? (
          <p className="auth-note">Save your progress and pick up on any device. Your guest progress carries over automatically.</p>
        ) : guestWithProgress ? (
          <p className="auth-note">Progress you made as a guest will be added to your account.</p>
        ) : null}
        <form className="form auth-form" onSubmit={submit}>
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete={mode === "register" ? "email" : "username"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="Email"
            aria-label="Email"
            value={email}
            required
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
          />
          <div className="pw-field">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={mode === "register" ? "done" : "go"}
              placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
              aria-label="Password"
              value={password}
              required
              minLength={8}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
            />
            {/* no confirm field on sign-up, so let phone users check what they typed */}
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error.text}
              {error.suggestLogin && (
                <>
                  {" "}
                  <Link href="/login">Log in instead</Link>
                </>
              )}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy} aria-busy={busy}>
            {busy
              ? mode === "register"
                ? "Creating account…"
                : "Logging in…"
              : mode === "register"
                ? "Sign up"
                : "Log in"}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 15 }}>
          {mode === "register" ? (
            <>Already have an account? <Link href="/login">Log in</Link></>
          ) : (
            <>New here? <Link href="/register">Create an account</Link></>
          )}
        </p>
        {/* auth pages render no header — give phones a way back */}
        <Link href="/" className="auth-back">
          {user ? "← Back to course" : "← Keep learning as a guest"}
        </Link>
      </div>
    </main>
  );
}
