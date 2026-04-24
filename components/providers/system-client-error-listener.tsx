"use client";

import { useEffect } from "react";

function sendClientError(payload: {
  type: string;
  message: string;
  stack?: string | null;
}) {
  const body = JSON.stringify({
    ...payload,
    pathname: window.location.pathname,
    userAgent: navigator.userAgent
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/system/client-error", new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}

export function SystemClientErrorListener() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      sendClientError({
        type: "window.error",
        message: event.message || "Unhandled client error",
        stack: event.error instanceof Error ? event.error.stack ?? null : null
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      sendClientError({
        type: "window.unhandled-rejection",
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection",
        stack: reason instanceof Error ? reason.stack ?? null : null
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
