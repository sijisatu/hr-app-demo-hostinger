import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/api-base";
import { authCookieName, authProfileCookieName } from "@/lib/auth-config";

const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

function shouldUseSecureCookies(requestOrigin: string | undefined) {
  if (!isProduction) {
    return false;
  }

  try {
    return new URL(requestOrigin ?? "http://localhost").protocol === "https:";
  } catch {
    return false;
  }
}

function clearAuthCookies(response: NextResponse, requestOrigin?: string) {
  const secureCookies = shouldUseSecureCookies(requestOrigin);
  response.cookies.set(authCookieName, "", {
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: secureCookies,
    maxAge: 0
  });
  response.cookies.set(authProfileCookieName, "", {
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: secureCookies,
    maxAge: 0
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function revokeCurrentSession() {
  try {
    const cookieStore = await cookies();
    const signedSession = cookieStore.get(authCookieName)?.value;

    if (signedSession) {
      await fetch(`${getServerApiBase()}/api/auth/logout`, {
        method: "POST",
        cache: "no-store",
        headers: {
          Cookie: `${authCookieName}=${signedSession}`,
          "X-Session-Token": signedSession
        }
      }).catch(() => null);
    }
  } catch {
    return;
  }
}

export async function GET(request: Request) {
  try {
    await revokeCurrentSession();
    const requestUrl = new URL(request.url);
    const redirectTo = requestUrl.searchParams.get("redirect");
    const safeRedirect = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/login";
    return clearAuthCookies(NextResponse.redirect(new URL(safeRedirect, requestUrl.origin)), requestUrl.origin);
  } catch {
    return clearAuthCookies(NextResponse.redirect(new URL("/login", request.url)), request.url);
  }
}

export async function POST() {
  try {
    await revokeCurrentSession();
    return clearAuthCookies(NextResponse.json({ success: true, data: { loggedOut: true }, error: null }));
  } catch {
    return clearAuthCookies(NextResponse.json({ success: true, data: { loggedOut: true }, error: null }));
  }
}
