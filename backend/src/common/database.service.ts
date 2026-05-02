import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { toLoggableError, writeSystemLog } from "./system-log";

type PrismaClientLike = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe(query: string): Promise<unknown>;
  $on?(eventType: string, callback: (event: unknown) => void): void;
};

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? "development";
  private readonly storageMode = process.env.APP_STORAGE_MODE?.trim().toLowerCase() ?? "auto";
  private readonly databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  private prismaClient: PrismaClientLike | null = null;
  private prismaEventHandlersRegistered = false;

  isEnabled() {
    if (this.storageMode === "json") {
      return false;
    }

    if (this.storageMode === "database") {
      return true;
    }

    return this.databaseUrl.length > 0;
  }

  isStrictDatabaseMode() {
    return this.storageMode === "database" || this.nodeEnv === "production";
  }

  getModeLabel() {
    return this.isEnabled() ? "database-configured" : "local-json";
  }

  getClient() {
    if (!this.isEnabled()) {
      return null;
    }

    if (!this.databaseUrl) {
      throw new Error("DATABASE_URL is required when APP_STORAGE_MODE uses database.");
    }

    if (!this.prismaClient) {
      const { PrismaMariaDb } = require("@prisma/adapter-mariadb") as {
        PrismaMariaDb: new (config: string) => unknown;
      };
      const { PrismaClient } = require("@prisma/client") as {
        PrismaClient: new (options?: Record<string, unknown>) => PrismaClientLike;
      };
      const adapter = new PrismaMariaDb(this.databaseUrl);
      this.prismaClient = new PrismaClient({
        adapter,
        log: [
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" }
        ]
      });
      void writeSystemLog({
        source: "database",
        event: "prisma.client-created",
        details: {
          mode: this.getModeLabel(),
          engineType: "client",
          adapter: "@prisma/adapter-mariadb"
        }
      });
      this.registerPrismaEventLogging();
    }

    return this.prismaClient;
  }

  private registerPrismaEventLogging() {
    if (!this.prismaClient || this.prismaEventHandlersRegistered || typeof this.prismaClient.$on !== "function") {
      return;
    }

    this.prismaEventHandlersRegistered = true;

    this.prismaClient.$on("warn", (event) => {
      void writeSystemLog({
        source: "database",
        event: "prisma.warn",
        level: "warn",
        details: {
          event
        }
      });
    });

    this.prismaClient.$on("error", (event) => {
      void writeSystemLog({
        source: "database",
        event: "prisma.error",
        level: "error",
        details: {
          event
        }
      });
    });
  }

  async healthcheck() {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        status: "not-configured"
      } as const;
    }

    try {
      const prisma = this.getClient();
      if (!prisma) {
        return {
          enabled: false,
          status: "not-configured"
        } as const;
      }

      await prisma.$queryRawUnsafe("SELECT 1");
      return {
        enabled: true,
        status: "online"
      } as const;
    } catch (error) {
      return {
        enabled: true,
        status: "offline",
        message: error instanceof Error ? error.message : "Unknown database error"
      } as const;
      }
  }

  async ensureReady() {
    if (!this.isEnabled()) {
      if (this.isStrictDatabaseMode()) {
        await writeSystemLog({
          source: "database",
          event: "database.required-missing-config",
          level: "error",
          details: {
            storageMode: this.storageMode,
            nodeEnv: this.nodeEnv
          }
        });
        throw new Error("Database is required in the current runtime mode, but DATABASE_URL is not configured.");
      }

      await writeSystemLog({
        source: "database",
        event: "database.disabled",
        level: "warn",
        details: {
          storageMode: this.storageMode
        }
      });
      return;
    }

    await writeSystemLog({
      source: "database",
      event: "database.ensure-ready.start",
      details: {
        mode: this.getModeLabel()
      }
    });

    try {
      const prisma = this.getClient();
      await prisma?.$connect();

      const status = await this.healthcheck();
      if (status.status !== "online") {
        await writeSystemLog({
          source: "database",
          event: "database.ensure-ready.failed",
          level: "error",
          details: {
            status
          }
        });
        throw new Error(status.message ?? "Database connection is not ready.");
      }

      await writeSystemLog({
        source: "database",
        event: "database.ensure-ready.ready",
        details: {
          status: status.status
        }
      });
    } catch (error) {
      await writeSystemLog({
        source: "database",
        event: "database.ensure-ready.exception",
        level: "error",
        details: {
          error: toLoggableError(error)
        }
      });
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.prismaClient?.$disconnect();
      if (this.prismaClient) {
        await writeSystemLog({
          source: "database",
          event: "prisma.disconnected",
          level: "warn",
          details: {
            mode: this.getModeLabel()
          }
        });
      }
    } catch (error) {
      await writeSystemLog({
        source: "database",
        event: "prisma.disconnect.failed",
        level: "error",
        details: {
          error: toLoggableError(error)
        }
      });
    }
  }
}
