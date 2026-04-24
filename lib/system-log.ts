import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type SystemLogLevel = "info" | "warn" | "error";

type SystemLogPayload = {
  source: string;
  event: string;
  level?: SystemLogLevel;
  details?: Record<string, unknown>;
};

function resolveProjectRoot() {
  const cwd = process.cwd();
  return path.basename(cwd).toLowerCase() === "backend" ? path.resolve(cwd, "..") : cwd;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null
    };
  }
  return error;
}

function getWibTimestampParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
  return {
    year: lookup.year ?? "0000",
    month: lookup.month ?? "00",
    day: lookup.day ?? "00",
    hour: lookup.hour ?? "00",
    minute: lookup.minute ?? "00",
    second: lookup.second ?? "00"
  };
}

function createLogTimestamps() {
  const now = new Date();
  const wib = getWibTimestampParts(now);
  return {
    timestamp: `${wib.year}-${wib.month}-${wib.day} ${wib.hour}:${wib.minute}:${wib.second} WIB`,
    timestampIsoUtc: now.toISOString(),
    timezone: "Asia/Jakarta"
  };
}

function formatValue(value: unknown, depth = 0): string[] {
  const indent = "  ".repeat(depth);
  const childIndent = "  ".repeat(depth + 1);

  if (value === null || value === undefined) {
    return [`${indent}-`];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indent}[]`];
    }
    return value.flatMap((item) => {
      if (item !== null && typeof item === "object") {
        return [`${indent}-`, ...formatValue(item, depth + 1)];
      }
      return [`${indent}- ${String(item)}`];
    });
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [`${indent}{}`];
    }
    return entries.flatMap(([key, entryValue]) => {
      if (entryValue !== null && typeof entryValue === "object") {
        return [`${indent}${key}:`, ...formatValue(entryValue, depth + 1)];
      }
      return [`${indent}${key}: ${String(entryValue)}`];
    });
  }

  return [`${childIndent}${String(value)}`];
}

function createReadableRecord(record: {
  timestamp: string;
  level: string;
  source: string;
  event: string;
  details: Record<string, unknown> | null;
}) {
  const lines = [
    `[${record.timestamp}] ${record.level.toUpperCase()} ${record.source} ${record.event}`
  ];

  if (record.details && Object.keys(record.details).length > 0) {
    lines.push("details:");
    lines.push(...formatValue(record.details));
  } else {
    lines.push("details: -");
  }

  lines.push("---");
  return `${lines.join("\n")}\n`;
}

export async function writeSystemLog(payload: SystemLogPayload) {
  try {
    const projectRoot = resolveProjectRoot();
    const targetDir = path.join(projectRoot, "logs", "system");
    const targetFile = path.join(targetDir, "system-events.ndjson");
    const readableFile = path.join(targetDir, "system-events.log");
    await mkdir(targetDir, { recursive: true });
    const timestamps = createLogTimestamps();
    const record = {
      timestamp: timestamps.timestamp,
      timestampIsoUtc: timestamps.timestampIsoUtc,
      timezone: timestamps.timezone,
      level: payload.level ?? "info",
      source: payload.source,
      event: payload.event,
      details: payload.details ?? null
    };
    await appendFile(targetFile, `${JSON.stringify(record)}\n`, "utf8");
    await appendFile(readableFile, createReadableRecord(record), "utf8");
  } catch (error) {
    console.error("Failed to write system log", serializeError(error));
  }
}

export function toLoggableError(error: unknown) {
  return serializeError(error);
}
