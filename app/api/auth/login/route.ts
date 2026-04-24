import { NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/api-base";
import {
  authCookieName,
  authProfileCookieName,
  defaultRouteForRole,
  encodeSessionProfile,
  findDemoUser,
  type SessionUser
} from "@/lib/auth-config";
import { signSessionToken } from "@/lib/session-token";

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

function sanitizeRedirectPath(value: string | null | undefined) {
  const target = (value ?? "/dashboard").trim();
  if (!target.startsWith("/")) {
    return "/dashboard";
  }
  if (target.startsWith("//")) {
    return "/dashboard";
  }
  return target;
}

function shouldRespondWithRedirect(request: Request, contentType: string) {
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

type EmployeeLoginResponse = {
  sessionId: string;
  maxAgeSeconds: number;
  user: SessionUser;
};

function buildAuthResponse(
  user?: SessionUser,
  redirectTo?: string,
  sessionSubject?: string,
  maxAgeSeconds = 60 * 60 * 12,
  requestOrigin?: string
) {
  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid account" }, { status: 400 });
  }

  const safeRedirect = sanitizeRedirectPath(redirectTo);
  const secureCookies = shouldUseSecureCookies(requestOrigin);
  const response = redirectTo
    ? NextResponse.redirect(new URL(safeRedirect, requestOrigin ?? "http://localhost:3000"))
    : NextResponse.json({ success: true, data: { redirectTo: defaultRouteForRole(user.role), user }, error: null });

  response.cookies.set(authCookieName, signSessionToken(sessionSubject ?? user.sessionKey), {
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: secureCookies,
    maxAge: maxAgeSeconds
  });
  response.cookies.set(authProfileCookieName, encodeSessionProfile(user), {
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: secureCookies,
    maxAge: maxAgeSeconds
  });

  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionKey = searchParams.get("sessionKey") ?? undefined;
  const redirectTo = sanitizeRedirectPath(searchParams.get("redirect") ?? "/dashboard");
  const user = findDemoUser(sessionKey);
  return buildAuthResponse(user ?? undefined, redirectTo, undefined, undefined, new URL(request.url).origin);
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectTo = sanitizeRedirectPath(requestUrl.searchParams.get("redirect") ?? "/dashboard");
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const expectsRedirect = shouldRespondWithRedirect(request, contentType);
  const payload = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")
    ? await request.formData().then((formData) => ({
        sessionKey: formData.get("sessionKey")?.toString(),
        username: formData.get("username")?.toString(),
        password: formData.get("password")?.toString()
      }))
    : await request.json() as { sessionKey?: string; username?: string; password?: string };

  if (payload.sessionKey) {
    const demoUser = findDemoUser(payload.sessionKey);
    return buildAuthResponse(demoUser ?? undefined, expectsRedirect ? redirectTo : undefined, undefined, undefined, requestUrl.origin);
  }

  const username = payload.username?.trim();
  const password = payload.password?.trim();
  if (!username || !password) {
    if (expectsRedirect) {
      return NextResponse.redirect(new URL("/login?error=missing-credentials", requestUrl));
    }
    return NextResponse.json({ success: false, error: "Username and password are required." }, { status: 400 });
  }

  const response = await fetch(`${getServerApiBase()}/api/auth/employee-login`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    if (expectsRedirect) {
      return NextResponse.redirect(new URL("/login?error=invalid-credentials", requestUrl));
    }
    return NextResponse.json({ success: false, error: "Invalid username or password." }, { status: 400 });
  }

  const employeePayload = (await response.json()) as { data: EmployeeLoginResponse };
  return buildAuthResponse(
    employeePayload.data.user,
    expectsRedirect ? redirectTo : undefined,
    employeePayload.data.sessionId,
    employeePayload.data.maxAgeSeconds,
    requestUrl.origin
  );
}
