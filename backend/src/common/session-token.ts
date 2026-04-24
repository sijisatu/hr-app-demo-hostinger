import { createHmac, timingSafeEqual } from "node:crypto";

const IS_PRODUCTION = (process.env.NODE_ENV || "").toLowerCase() === "production";
const DEMO_SESSION_SECRET = "local-demo-session-secret-2026-04-23-pralux";
const INVALID_PRODUCTION_SECRETS = new Set([
  "dev-session-secret-change-me",
  "change-this-production-secret"
]);

function resolveSessionSecret() {
  const configuredSecret = process.env.APP_SESSION_SECRET?.trim() || DEMO_SESSION_SECRET;
  if (IS_PRODUCTION && INVALID_PRODUCTION_SECRETS.has(configuredSecret)) {
    throw new Error("APP_SESSION_SECRET must be configured with a strong unique value in production.");
  }

  return configuredSecret;
}

function toSignature(value: string) {
  const sessionSecret = resolveSessionSecret();
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

export function signSessionToken(sessionSubject: string) {
  const signature = toSignature(sessionSubject);
  return `${sessionSubject}.${signature}`;
}

export function verifyAndExtractSessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return IS_PRODUCTION ? null : token;
  }

  const sessionSubject = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = toSignature(sessionSubject);

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
