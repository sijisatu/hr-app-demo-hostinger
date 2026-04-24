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

async function forwardRequest(request: Request, path: string[]) {
  const requestUrl = new URL(request.url);
  const normalizedPath = path[0] === "api" ? path.slice(1) : path;
  const targetPath = normalizedPath.map((segment) => encodeURIComponent(segment)).join("/");
  const targetUrl = normalizedPath[0] === "storage"
    ? new URL(`/${targetPath}${requestUrl.search}`, getServerApiBase())
    : new URL(`/api/${targetPath}${requestUrl.search}`, getServerApiBase());
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

  const init: RequestInit = {
    method: request.method,
    headers: forwardedHeaders,
    redirect: "manual",
    cache: "no-store"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
    // @ts-expect-error Node fetch duplex is required for streaming request bodies in route handlers.
    init.duplex = "half";
  }

  const backendResponse = await fetch(targetUrl, init);
  const responseHeaders = new Headers();
  backendResponse.headers.forEach((value, key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) {
      return;
    }
    responseHeaders.set(key, value);
  });

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders
  });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export async function OPTIONS(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}
