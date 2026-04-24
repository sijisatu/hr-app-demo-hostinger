import { Injectable } from "@nestjs/common";

type RequestEvent = {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly requestEvents: RequestEvent[] = [];
  private readonly maxEvents = 5_000;

  recordRequest(event: RequestEvent) {
    this.requestEvents.push(event);
    if (this.requestEvents.length > this.maxEvents) {
      this.requestEvents.splice(0, this.requestEvents.length - this.maxEvents);
    }
  }

  getSnapshot() {
    const now = Date.now();
    const total = this.requestEvents.length;
    const recentWindowMs = 5 * 60 * 1000;
    const recent = this.requestEvents.filter((entry) => now - entry.timestamp <= recentWindowMs);
    const durations = this.requestEvents.map((entry) => entry.durationMs).sort((a, b) => a - b);
    const recentDurations = recent.map((entry) => entry.durationMs).sort((a, b) => a - b);
    const errorCount = this.requestEvents.filter((entry) => entry.statusCode >= 500).length;
    const recentErrorCount = recent.filter((entry) => entry.statusCode >= 500).length;

    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.round((now - this.startedAt) / 1000),
      requestCount: total,
      requestCountLast5m: recent.length,
      errorRatePercent: total === 0 ? 0 : Number(((errorCount / total) * 100).toFixed(2)),
      errorRateLast5mPercent: recent.length === 0 ? 0 : Number(((recentErrorCount / recent.length) * 100).toFixed(2)),
      latencyMs: {
        p50: percentile(durations, 0.5),
        p95: percentile(durations, 0.95),
        p99: percentile(durations, 0.99),
        avg: average(durations),
        last5mP95: percentile(recentDurations, 0.95)
      }
    };
  }
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * ratio) - 1));
  return Number(values[index].toFixed(2));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}
