"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth-config";
import { AttendanceModalProvider } from "@/components/providers/attendance-modal-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { SystemClientErrorListener } from "@/components/providers/system-client-error-listener";

export function AppProviders({ children, currentUser }: { children: React.ReactNode; currentUser: SessionUser | null }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider currentUser={currentUser}>
        <SystemClientErrorListener />
        <AttendanceModalProvider>{children}</AttendanceModalProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
