"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { deviceTz, useProgress } from "@/lib/progress";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { adoptAuth } = useProgress();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tokens =
        mode === "register"
          ? await api.register(email, password, deviceTz())
          : await api.login(email, password);
      await adoptAuth(tokens);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <main className="container">
      <div className="center-card">
        <h2>{mode === "register" ? "Create your account" : "Welcome back"}</h2>
        {mode === "register" && (
          <p style={{ color: "var(--text-muted)" }}>Your guest progress carries over automatically.</p>
        )}
        <form className="form" onSubmit={submit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            value={password}
            required
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "…" : mode === "register" ? "Sign up" : "Log in"}
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
