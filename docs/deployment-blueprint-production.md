# Production Deployment Blueprint

## 1) Topology
- `Frontend`: Next.js production server on port `3000`
- `Backend`: NestJS API on port `4000`
- `Database`: MariaDB using Prisma `mysql` datasource
- `Storage`: persistent filesystem or object storage mounted for `backend/storage`

Recommended layout:
- public traffic hits reverse proxy
- reverse proxy forwards `/` to frontend
- reverse proxy forwards `/api/*` and `/storage/*` to backend
- backend connects to MariaDB over private/internal network

## 2) Reverse Proxy + TLS
- Terminate TLS at reverse proxy
- Force HTTPS redirect from `80` to `443`
- Forward `X-Forwarded-Proto=https`
- Forward `X-Forwarded-For`
- Forward `X-Request-Id`

Example routing:
- `https://hr.pralux.co.id/` -> `127.0.0.1:3000`
- `https://hr.pralux.co.id/api/*` -> `127.0.0.1:4000/api/*`
- `https://hr.pralux.co.id/storage/*` -> `127.0.0.1:4000/storage/*`

## 3) Required Environment Variables
- `NODE_ENV=production`
- `PORT=4000` for backend
- `DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/pralux_hr_app`
- `APP_STORAGE_MODE=database`
- `APP_SESSION_SECRET=<strong-random-secret>`
- `APP_TRUST_PROXY=1`
- `CORS_ORIGINS=https://hr.pralux.co.id`
- `API_BASE_URL=https://hr.pralux.co.id`
- `ENFORCE_BACKEND_AUTH=true`

Frontend:
- `API_BASE_URL=https://hr.pralux.co.id`
- `APP_SESSION_SECRET` must match backend secret if frontend routes validate session token locally

## 4) Database Notes
- Active Prisma provider is `mysql`, compatible with MariaDB
- Apply schema with `npm run db:migrate:deploy` from `backend`
- Import demo/local JSON snapshot with `npm run db:import-json` only when seeding non-production environments
- Backup/restore scripts in `backend/scripts` now target MariaDB/MySQL tooling

## 5) Persistent Data
Persist these paths across releases:
- `backend/storage/attendance-selfies`
- `backend/storage/documents`
- `backend/storage/exports`
- `backend/storage/leave`
- `backend/storage/reimbursements`
- `logs` if server-side runtime logs need to survive restarts

## 6) Health Endpoints
- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`
- Health: `GET /api/health`
- Metrics snapshot: `GET /api/ops/metrics`

Suggested probes:
- liveness every `15s`, timeout `3s`, failure threshold `3`
- readiness every `10s`, timeout `3s`, failure threshold `3`

## 7) Release Flow
1. Run `npm run build` in project root.
2. Run `npm run build` in `backend`.
3. Run `npm run db:migrate:deploy` in `backend`.
4. Start backend on `4000`.
5. Wait until `/api/health/ready` returns healthy.
6. Start frontend on `3000`.
7. Run smoke checks for login, dashboard, attendance, reimbursement, and reports.

## 8) Rollback
- Keep previous app artifact/build available.
- Roll back app processes first.
- Only roll back database if a release introduced incompatible schema/data changes.
- Re-run readiness check and core smoke tests after rollback.
