import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authCookieName,
  authProfileCookieName,
  decodeSessionProfile,
  defaultRouteForRole,
  findDemoUser,
  type SessionUser,
  type UserRole
} from "@/lib/auth-config";
import { getServerApiBase } from "@/lib/api-base";
import { verifyAndExtractSessionToken } from "@/lib/session-token";

const getCurrentBackendSession = cache(async (signedSessionToken: string): Promise<SessionUser | null> => {
  const response = await fetch(`${getServerApiBase()}/api/auth/session/current`, {
    cache: "no-store",
    headers: {
      Cookie: `${authCookieName}=${signedSessionToken}`,
      "X-Session-Token": signedSessionToken
    }
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data: SessionUser };
  return payload.data ?? null;
});

export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const signedSessionToken = cookieStore.get(authCookieName)?.value;
  const sessionKey = verifyAndExtractSessionToken(signedSessionToken);
  const cachedProfile = decodeSessionProfile(cookieStore.get(authProfileCookieName)?.value);
  const demoUser = findDemoUser(sessionKey);
  if (demoUser) {
    return cachedProfile && cachedProfile.sessionKey === sessionKey ? cachedProfile : demoUser;
  }
  if (!signedSessionToken || !sessionKey) {
    return null;
  }
  return getCurrentBackendSession(signedSessionToken);
});

export async function requireSession(allowedRoles?: UserRole[]) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect(defaultRouteForRole(session.role));
  }
  return session;
}

export function canAccess(role: UserRole, allowedRoles?: UserRole[]) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }
  return allowedRoles.includes(role);
}
