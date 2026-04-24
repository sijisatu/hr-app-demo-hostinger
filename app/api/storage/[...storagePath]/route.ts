import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/api-base";
import { authCookieName } from "@/lib/auth-config";

const hopByHopHeaders = new Set([
  "accept-encoding",
  "connection",
  "content-encoding",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

async function forwardStorageRequest(request: Request, storagePath: string[]) {
  const requestUrl = new URL(request.url);
  const normalizedPath = storagePath.map((segment) => encodeURIComponent(segment)).join("/");
  const targetUrl = new URL(`/storage/${normalizedPath}${requestUrl.search}`, getServerApiBase());
  const incomingHeaders = new Headers(request.headers);
  const forwardedHeaders = new Headers();

  incomingHeaders.forEach((value, key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) {
      return;
    }
    forwardedHeaders.set(key, value);
  });

  const cookieStore = await cookies();
  const signedSession = cookieStore.get(authCookieName)?.value;
  if (signedSession) {
    forwardedHeaders.set("Cookie", `${authCookieName}=${signedSession}`);
    forwardedHeaders.set("X-Session-Token", signedSession);
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: forwardedHeaders,
    redirect: "manual",
    cache: "no-store"
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) {
      return;
    }
    responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders
  });
}

export async function GET(request: Request, context: { params: Promise<{ storagePath: string[] }> }) {
  const { storagePath } = await context.params;
  return forwardStorageRequest(request, storagePath);
}

