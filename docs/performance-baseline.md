# Performance Baseline (Pre-Production)

Tanggal baseline awal: 2026-04-17

## Scope Endpoint Utama
- `GET /api/dashboard/summary`
- `GET /api/attendance/history`
- `GET /api/reimbursement/requests`
- `POST /api/reports/export` (+ status polling)

## Target SLA (Initial)
- API availability: `>= 99.5%`
- `p95 latency` read endpoint utama: `<= 1200 ms`
- `error rate` 5 menit: `< 5%`
- export queue depth normal: `< 25` queued jobs

## Cara Pengukuran
1. Jalankan backend dalam mode production-like config.
2. Gunakan endpoint observability:
   - `GET /api/ops/metrics`
3. Validasi indikator:
   - `metrics.requests.latencyMs.p95`
   - `metrics.requests.errorRateLast5mPercent`
   - `metrics.exportQueue.queued`
   - status database pada `metrics.database.status`

## Baseline Operasional
- Threshold alert di `.env`:
  - `OPS_ALERT_ERROR_RATE_PERCENT=5`
  - `OPS_ALERT_P95_MS=1200`
  - `OPS_ALERT_QUEUE_DEPTH=25`
- Alert akan muncul pada `GET /api/ops/metrics` bila threshold terlampaui.

## Review Periodik
- Review baseline setiap sebelum release mayor.
- Re-baseline jika ada perubahan arsitektur besar:
  - perubahan storage mode
  - perubahan pipeline export
  - penambahan modul traffic tinggi
