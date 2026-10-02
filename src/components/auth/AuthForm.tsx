"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

const GOOGLE_ERRORS: Record<string, string> = {
  google_failed: "Google sign-in didn't complete. Please try again.",
  google_not_configured: "Google sign-in isn't set up yet. Use email and password for now.",
};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();

  const redirect = params.get("redirect") || "/";
  const queryError = params.get("error");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    queryError ? GOOGLE_ERRORS[queryError] ?? "Something went wrong." : null
  );

  const withRedirect = (path: string) =>
    redirect && redirect !== "/"
      ? `${path}?redirect=${encodeURIComponent(redirect)}`
      : path;
  const googleParams = new URLSearchParams({
    redirect,
    screen: mode,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup ? { name, email, password } : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setUser(data.user);
      router.push(redirect.startsWith("/") ? redirect : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border p-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isSignup
            ? "Sign up to add items to your cart and check out."
            : "Log in to continue shopping."}
        </p>

        {/* Google */}
        <a
          href={`/api/auth/google?${googleParams.toString()}`}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border px-6 py-3 text-sm font-semibold transition hover:bg-surface"
        >
          <GoogleIcon /> Continue with Google
        </a>

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> or {isSignup ? "sign up" : "log in"} with email
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {isSignup && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              className="rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            className="rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "Password (min. 8 characters)" : "Password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link
            href={withRedirect(isSignup ? "/login" : "/signup")}
            className="font-semibold text-accent hover:underline"
          >
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
