"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/auth-config";

type SessionContextValue = {
  currentUser: SessionUser | null;
  setCurrentUser: (user: SessionUser | null) => void;
};

const SessionContext = createContext<SessionContextValue>({
  currentUser: null,
  setCurrentUser: () => undefined
});

export function SessionProvider({ children, currentUser }: { children: ReactNode; currentUser: SessionUser | null }) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(currentUser);

  useEffect(() => {
    setSessionUser(currentUser);
  }, [currentUser]);

  return <SessionContext.Provider value={{ currentUser: sessionUser, setCurrentUser: setSessionUser }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

