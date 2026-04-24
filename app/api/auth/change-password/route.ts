import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/api-base";
import { authCookieName, findDemoUser } from "@/lib/auth-config";
import { getCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Session not found." }, { status: 401 });
  }
  if (findDemoUser(session.sessionKey)) {
    return NextResponse.json({ success: false, error: "Demo account passwords cannot be changed." }, { status: 400 });
  }

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword?.trim();
  const newPassword = body.newPassword?.trim();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: "Current password and new password are required." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const signedSession = cookieStore.get(authCookieName)?.value;
  if (!signedSession) {
    return NextResponse.json({ success: false, error: "Session cookie was not found." }, { status: 401 });
  }

  const response = await fetch(`${getServerApiBase()}/api/auth/change-password`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${authCookieName}=${signedSession}`
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; error?: string; data?: unknown } | null;
  if (!response.ok) {
    return NextResponse.json({ success: false, error: payload?.error ?? "Failed to change password." }, { status: response.status });
  }

  return NextResponse.json({ success: true, data: payload?.data ?? { success: true }, error: null });
}
