import { NextResponse } from "next/server";
import { writeSystemLog } from "@/lib/system-log";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        type?: string;
        message?: string;
        stack?: string | null;
        pathname?: string;
        userAgent?: string;
      }
    | null;

  await writeSystemLog({
    source: "frontend-client",
    event: payload?.type ?? "client.error",
    level: "error",
    details: {
      message: payload?.message ?? "Unknown client error",
      stack: payload?.stack ?? null,
      pathname: payload?.pathname ?? null,
      userAgent: payload?.userAgent ?? null
    }
  });

  return NextResponse.json({ success: true, data: { logged: true }, error: null });
}
