import { toLoggableError, writeSystemLog } from "@/lib/system-log";

let handlersRegistered = false;

export async function register() {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  await writeSystemLog({
    source: "frontend-server",
    event: "bootstrap.register",
    details: {
      pid: process.pid,
      nodeEnv: process.env.NODE_ENV ?? "development",
      cwd: process.cwd()
    }
  });

  process.on("uncaughtException", (error) => {
    void writeSystemLog({
      source: "frontend-server",
      event: "process.uncaught-exception",
      level: "error",
      details: { error: toLoggableError(error) }
    });
  });

  process.on("unhandledRejection", (reason) => {
    void writeSystemLog({
      source: "frontend-server",
      event: "process.unhandled-rejection",
      level: "error",
      details: { reason: toLoggableError(reason) }
    });
  });

  process.on("SIGINT", () => {
    void writeSystemLog({
      source: "frontend-server",
      event: "process.sigint",
      level: "warn",
      details: { pid: process.pid }
    });
  });

  process.on("SIGTERM", () => {
    void writeSystemLog({
      source: "frontend-server",
      event: "process.sigterm",
      level: "warn",
      details: { pid: process.pid }
    });
  });
}
