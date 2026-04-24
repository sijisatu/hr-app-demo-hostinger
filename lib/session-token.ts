import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
const demoSessionSecret = "local-demo-session-secret-2026-04-23-pralux";
const invalidProductionSecrets = new Set([
  "dev-session-secret-change-me",
  "change-this-production-secret"
]);

function resolveSessionSecret() {
  const configuredSecret = process.env.APP_SESSION_SECRET?.trim() || demoSessionSecret;
  if (isProduction && invalidProductionSecrets.has(configuredSecret)) {
    throw new Error("APP_SESSION_SECRET must be configured with a strong unique value in production.");
  }

  return configuredSecret;
}

export function signSessionToken(sessionSubject: string) {
  const sessionSecret = resolveSessionSecret();
  const signature = createHmac("sha256", sessionSecret).update(sessionSubject).digest("base64url");
  return `${sessionSubject}.${signature}`;
}

export function verifyAndExtractSessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return isProduction ? null : token;
  }

  const sessionSecret = resolveSessionSecret();
  const sessionSubject = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = createHmac("sha256", sessionSecret).update(sessionSubject).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  return sessionSubject;
}

export const verifyAndExtractSessionKey = verifyAndExtractSessionToken;
