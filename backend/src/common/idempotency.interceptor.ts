import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Request } from "express";
import { Observable, of } from "rxjs";
import { catchError, tap } from "rxjs/operators";

type CachedResponse = {
  status: "processing" | "completed";
  expiresAt: number;
  response?: unknown;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CachedResponse>();
  private readonly ttlMs = Math.max(10, Number(process.env.IDEMPOTENCY_TTL_SECONDS ?? 120)) * 1000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const key = this.buildCacheKey(request);
    const now = Date.now();

    this.clearExpired(now);
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > now) {
      if (existing.status === "processing") {
        throw new ConflictException("Duplicate request is being processed.");
      }
      return of(existing.response ?? null);
    }

    this.cache.set(key, { status: "processing", expiresAt: now + this.ttlMs });
    return next.handle().pipe(
      tap((response) => {
        this.cache.set(key, { status: "completed", response, expiresAt: Date.now() + this.ttlMs });
      }),
      catchError((error) => {
        this.cache.delete(key);
        throw error;
      })
    );
  }

  private buildCacheKey(request: Request & { user?: { id?: string } }) {
    const actorId = request.user?.id ?? "anonymous";
    const idempotencyHeader = request.headers["x-idempotency-key"];
    const rawHeader = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;
    const providedKey = typeof rawHeader === "string" ? rawHeader.trim() : "";
    const fallbackSource = `${request.method}:${request.path}:${actorId}:${this.stableSerialize({
      params: request.params,
      query: request.query,
      body: request.body
    })}`;
    const fallbackKey = createHash("sha256").update(fallbackSource).digest("hex");
    return `${request.method}:${request.path}:${actorId}:${providedKey || fallbackKey}`;
  }

  private stableSerialize(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableSerialize(entry)).join(",")}]`;
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => `"${key}":${this.stableSerialize(nested)}`);
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private clearExpired(now: number) {
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

