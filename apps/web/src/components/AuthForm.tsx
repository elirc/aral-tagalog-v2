"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { deviceTz, useProgress } from "@/lib/progress";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { adoptAuth, ready } = useProgress();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const tokens =
        mode === "register"
          ? await api.register(email.trim(), password, deviceTz())
          : await api.login(email.trim(), password);
      await adoptAuth(tokens);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429
        ? "Too many attempts. Please wait a minute and try again."
        : err instanceof ApiError && err.status >= 500
          ? "The service is temporarily unavailable. Please try again shortly."
          : err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="container">
      <div className="center-card">
        <h1 className="page-title">{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        {mode === "register" && (
          <p style={{ color: "var(--text-muted)" }}>Your guest progress carries over automatically.</p>
        )}
        <form className="form" onSubmit={submit} aria-busy={busy}>
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Email"
            value={email}
            required
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="auth-password">Password</label>
          <div className="password-field"><input
            id="auth-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            aria-describedby={[mode === "register" ? "password-help" : "", error ? "auth-error" : ""].filter(Boolean).join(" ") || undefined}
            placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            value={password}
            required
            disabled={busy}
            minLength={8}
            maxLength={200}
            onChange={(e) => setPassword(e.target.value)}
          /><button type="button" className="text-button" disabled={busy} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div>
          {mode === "register" && <p id="password-help" className="field-help">Use at least 8 characters. A unique passphrase is easy to remember.</p>}
          {error && <p id="auth-error" className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || !ready}>
            {busy ? "Please wait…" : mode === "register" ? "Sign up" : "Log in"}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 15 }}>
          {mode === "register" ? (
            <>Already have an account? <Link href="/login">Log in</Link></>
          ) : (
            <>New here? <Link href="/register">Create an account</Link></>
          )}
        </p>
      </div>
    </main>
  );
}
