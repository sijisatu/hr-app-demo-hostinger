const LOCAL_API_BASE = "http://127.0.0.1:4000";
const LOCAL_API_FALLBACK_BASE = "http://localhost:4000";

function isProductionEnvironment() {
  return (process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getConfiguredApiBase() {
  return trimEnvValue(process.env.API_BASE_URL) ?? trimEnvValue(process.env.NEXT_PUBLIC_API_BASE_URL);
}

export function getBrowserApiBase() {
  if (typeof window === "undefined") {
    return null;
  }

  return trimEnvValue(process.env.NEXT_PUBLIC_API_BASE_URL) ?? "/api/proxy";
}

export function getServerApiBase() {
  const configuredBase = getConfiguredApiBase();
  if (configuredBase) {
    return configuredBase;
  }

  if (isProductionEnvironment()) {
    throw new Error("API_BASE_URL must be configured in production.");
  }

  return LOCAL_API_BASE;
}

export function getApiBase() {
  return getBrowserApiBase() ?? getServerApiBase();
}

export function getLocalApiFallbackBase() {
  return LOCAL_API_FALLBACK_BASE;
}

export function shouldTryLocalApiFallback(currentBase: string) {
  return !isProductionEnvironment() && currentBase !== LOCAL_API_FALLBACK_BASE;
}
