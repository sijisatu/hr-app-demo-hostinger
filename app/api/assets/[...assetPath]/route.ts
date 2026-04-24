import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerApiBase } from "@/lib/api-base";
import { authCookieName } from "@/lib/auth-config";
import { verifyAndExtractSessionToken } from "@/lib/session-token";

export async function GET(
  request: Request,
  context: { params: Promise<{ assetPath: string[] }> }
) {
  const { assetPath } = await context.params;
  const cookieStore = await cookies();
  const signedSession = cookieStore.get(authCookieName)?.value ?? null;

  if (!signedSession || !verifyAndExtractSessionToken(signedSession)) {
    return NextResponse.json({ success: false, error: "Session cookie not found." }, { status: 401 });
  }

  const targetUrl = new URL(`/api/assets/${assetPath.join("/")}`, getServerApiBase());
  const upstream = await fetch(targetUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      Cookie: `${authCookieName}=${signedSession}`,
      "X-Session-Token": signedSession
    }
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text().catch(() => "");
    return new NextResponse(errorBody || "Asset request failed.", {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8"
      }
    });
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "Content-Type",
    "Content-Length",
    "Content-Disposition",
    "Cache-Control",
    "Last-Modified",
    "ETag"
  ];

  for (const headerName of passthroughHeaders) {
    const value = upstream.headers.get(headerName);
    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
}
