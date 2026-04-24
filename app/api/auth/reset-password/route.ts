import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/api-base";
import { authCookieName } from "@/lib/auth-config";
import { getCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Session not found." }, { status: 401 });
  }
  if (session.role !== "hr" && session.role !== "admin") {
    return NextResponse.json({ success: false, error: "Only HR or admin users can reset an employee password." }, { status: 403 });
  }

  const body = (await request.json()) as { employeeId?: string; newPassword?: string };
  const employeeId = body.employeeId?.trim();
  const newPassword = body.newPassword?.trim();

  if (!employeeId || !newPassword) {
    return NextResponse.json({ success: false, error: "Employee and new password are required." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const signedSession = cookieStore.get(authCookieName)?.value;
  if (!signedSession) {
    return NextResponse.json({ success: false, error: "Session cookie was not found." }, { status: 401 });
  }

  const response = await fetch(`${getServerApiBase()}/api/auth/reset-password`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${authCookieName}=${signedSession}`
    },
    body: JSON.stringify({ employeeId, newPassword })
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; error?: string; data?: unknown } | null;
  if (!response.ok) {
    return NextResponse.json({ success: false, error: payload?.error ?? "Failed to reset the employee password." }, { status: response.status });
  }

  return NextResponse.json({ success: true, data: payload?.data ?? { success: true }, error: null });
}
