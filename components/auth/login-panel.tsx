"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { demoUsers, type SessionUser } from "@/lib/auth-config";
import { useSession } from "@/components/providers/session-provider";

export function LoginPanel() {
  const router = useRouter();
  const { setCurrentUser } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const nativeLoginAction = "/api/auth/login?redirect=/dashboard";

  const completeLogin = (payload: { data: { redirectTo: string; user: SessionUser } }) => {
    setCurrentUser(payload.data.user);
    router.replace(payload.data.redirectTo);
    router.refresh();
    if (typeof window !== "undefined") {
      window.location.assign(payload.data.redirectTo);
    }
  };

  const loginAs = (user: SessionUser) => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey: user.sessionKey })
        });

        if (!response.ok) {
          setError("Failed to sign in to the demo account.");
          return;
        }

        const payload = (await response.json()) as { data: { redirectTo: string; user: SessionUser } };
        completeLogin(payload);
      } catch {
        setError("Unable to reach the login service. Please try again.");
      }
    });
  };

  const loginWithCredentials = () => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          setError(payload?.error ?? "Failed to sign in with username and password.");
          return;
        }

        const payload = (await response.json()) as { data: { redirectTo: string; user: SessionUser } };
        completeLogin(payload);
      } catch {
        setError("Unable to reach the login service. Please try again.");
      }
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,var(--background)_0%,#eaf0f8_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-1/2 top-1/2 h-[62rem] w-[62rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(20,43,87,0.09)_0%,_rgba(233,238,248,0.2)_36%,_transparent_72%)] blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.32),_transparent_58%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,640px)_320px] lg:items-center">
          <section className="rounded-[30px] border border-[rgba(20,43,87,0.1)] bg-[rgba(255,255,255,0.78)] p-6 shadow-[0_24px_56px_rgba(15,23,42,0.08)] backdrop-blur-[16px] sm:p-8 lg:p-10">
            <div className="mx-auto max-w-[480px]">
              <div className="flex items-center justify-center gap-3 text-center">
                <Image
                  src="/pralux-logo-mark.svg"
                  alt="Pralux HR-App"
                  width={42}
                  height={42}
                  className="h-10 w-10 object-contain"
                  priority
                />
                <div className="text-left">
                  <p className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--primary)] sm:text-[20px]">
                    Pralux HR-App
                  </p>
                  <p className="text-[12px] uppercase tracking-[0.12em] text-[rgba(20,43,87,0.58)]">
                    Workforce intelligence platform
                  </p>
                </div>
              </div>

              <div className="mt-8 text-center">
                <h1 className="section-title text-[40px] font-medium leading-[1.02] tracking-[-0.05em] text-[var(--primary)] sm:text-[52px]">
                  Sign in to your workspace
                </h1>
                <p className="mt-3 text-[15px] text-[var(--text-muted)] sm:text-[16px]">
                  HR employee access and account management.
                </p>
              </div>

              <form
                className="mt-10"
                action={nativeLoginAction}
                method="post"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pending || !username.trim() || !password.trim()) {
                    return;
                  }
                  loginWithCredentials();
                }}
              >
                <div className="space-y-5">
                  <label className="block space-y-2.5 text-[15px] font-medium text-[var(--text)]">
                    <span>Username</span>
                    <input
                      name="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      className="h-14 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-[16px] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition focus:border-[var(--primary)] focus:bg-white"
                      placeholder="e.g., employee.nik"
                    />
                  </label>

                  <label className="block space-y-2.5 text-[15px] font-medium text-[var(--text)]">
                    <span>Password</span>
                    <input
                      name="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-14 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-[16px] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition focus:border-[var(--primary)] focus:bg-white"
                      placeholder="Enter your password"
                    />
                  </label>
                </div>

                <div className="mt-4 text-[14px] text-[var(--text-muted)]">
                  Forgot password?{" "}
                  <button
                    type="button"
                    className="font-medium text-[var(--primary)] hover:underline"
                    onClick={() => setForgotPasswordOpen(true)}
                  >
                    Contact HR
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={pending || !username.trim() || !password.trim()}
                  className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[14px] border border-[rgba(20,43,87,0.14)] bg-[var(--primary)] px-5 text-[18px] font-semibold text-white shadow-[0_16px_30px_rgba(20,43,87,0.18)] transition hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Sign In
                </button>
              </form>

              {error ? (
                <div className="mt-4 rounded-[14px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-[14px] text-[var(--danger)]">
                  {error}
                </div>
              ) : null}

              {pending ? (
                <div className="mt-4 flex items-center justify-center gap-2 text-[14px] text-[var(--text-muted)]">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Preparing session...
                </div>
              ) : null}
            </div>
          </section>

          <aside className="rounded-[28px] border border-[rgba(20,43,87,0.1)] bg-[rgba(255,255,255,0.72)] p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)] backdrop-blur-[16px] sm:p-6">
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--primary)]">Demo Accounts</h2>
              <p className="mt-2 text-[14px] text-[var(--text-muted)]">For testing access and restrictions.</p>
            </div>

            <div className="mt-6 divide-y divide-[rgba(20,43,87,0.08)]">
              {demoUsers.map((user) => (
                <a
                  key={user.sessionKey}
                  href={`/api/auth/login?sessionKey=${encodeURIComponent(user.sessionKey)}&redirect=${encodeURIComponent("/dashboard")}`}
                  onClick={(event) => {
                    if (!pending) {
                      loginAs(user);
                      event.preventDefault();
                    }
                  }}
                  aria-disabled={pending}
                  className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[var(--text)]">{user.name}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{user.position}</p>
                  </div>
                  <span className="inline-flex flex-shrink-0 rounded-[10px] border border-[rgba(20,43,87,0.08)] bg-[var(--primary-soft)] px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--primary)] shadow-[0_6px_16px_rgba(20,43,87,0.04)]">
                    {user.role}
                  </span>
                </a>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {forgotPasswordOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.4)] p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white shadow-2xl">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Forgot Password?</p>
              <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
                Please contact the HR team to reset your employee account password. When you report the issue, include your employee ID or username so the reset can be processed faster.
              </p>
            </div>
            <div className="px-6 py-5 text-[14px] text-[var(--text-muted)]">
              After HR resets the password, you can sign in again using the new password provided by HR.
            </div>
            <div className="flex justify-end border-t border-[var(--border)] px-6 py-4">
              <button type="button" className="primary-button" onClick={() => setForgotPasswordOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
