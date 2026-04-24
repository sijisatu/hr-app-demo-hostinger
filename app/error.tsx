"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-10">
      <div className="page-card w-full max-w-xl p-8 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Application Error</p>
        <h1 className="mt-4 text-[28px] font-semibold text-[var(--primary)]">This page could not be loaded.</h1>
        <p className="mt-3 text-[14px] leading-6 text-[var(--text-muted)]">
          The app hit an unexpected runtime issue. Try reloading this page or go back to the dashboard.
        </p>
        {error.digest ? (
          <p className="mt-4 text-[12px] text-[var(--text-muted)]">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="primary-button" onClick={() => reset()}>
            Retry
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.assign("/dashboard");
              }
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
