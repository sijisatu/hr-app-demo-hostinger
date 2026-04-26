"use client";

import { LogOut } from "lucide-react";
import clsx from "clsx";

export function LogoutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });
      } catch {
        // Even if the logout request fails, we still send the user back to login
        // so the browser stays on the current deployment domain.
      }

      window.location.assign("/login");
    }
  };

  return (
    <button
      className={clsx(
        "relative z-[2] flex w-full items-center gap-3 rounded-2xl px-4 py-3 pointer-events-auto hover:bg-white/70",
        className
      )}
      onClick={handleLogout}
      type="button"
    >
      {children ?? (
        <>
          <LogOut className="h-4 w-4" />
          Sign Out
        </>
      )}
    </button>
  );
}
