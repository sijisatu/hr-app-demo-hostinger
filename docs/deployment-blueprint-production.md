# Production Deployment Blueprint

## 1) Topology
- `Frontend service`: Next.js production server exposed on its own subdomain
- `Backend service`: NestJS API exposed on its own subdomain
- `Database`: MariaDB using Prisma `mysql` datasource
- `Storage`: persistent filesystem or object storage mounted for `backend/storage`

Recommended layout:
- `https://hr.pralux.co.id` serves the frontend service
- `https://api-hr.pralux.co.id` serves the backend service
- frontend calls backend over HTTPS using `API_BASE_URL`
- backend connects to MariaDB over private/internal network or managed database endpoint
- each service is deployed independently and can be restarted independently

## 2) Domains + TLS
- Enable TLS on both subdomains
- Force HTTPS redirect for both frontend and backend domains
- Backend must receive `X-Forwarded-Proto=https`
- Backend should receive `X-Forwarded-For`
- Backend should preserve or generate `X-Request-Id`

Suggested subdomains:
- `https://hr.pralux.co.id` -> frontend service
- `https://api-hr.pralux.co.id` -> backend service

Notes:
- do not rely on path-based reverse proxy routing like `/api/*` if the Hostinger plan does not expose custom reverse proxy rules
- frontend already supports talking to backend directly through configured API base URL
- storage URLs served by backend should stay under the backend domain

## 3) Required Environment Variables
Backend:
- `NODE_ENV=production`
- `PORT=4000` if Hostinger requires an explicit app port, otherwise use platform-assigned port
- `DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/pralux_hr_app`
- `APP_STORAGE_MODE=database`
- `APP_SESSION_SECRET=<strong-random-secret>`
- `APP_TRUST_PROXY=1`
- `CORS_ORIGINS=https://hr.pralux.co.id`
- `API_BASE_URL=https://api-hr.pralux.co.id`
- `ENFORCE_BACKEND_AUTH=true`

Frontend:
- `NODE_ENV=production`
- `API_BASE_URL=https://api-hr.pralux.co.id`
- `NEXT_PUBLIC_API_BASE_URL=https://api-hr.pralux.co.id`
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

Production URLs:
- `https://api-hr.pralux.co.id/api/health/live`
- `https://api-hr.pralux.co.id/api/health/ready`
- `https://api-hr.pralux.co.id/api/health`

## 7) Release Flow
1. Provision MariaDB database and create production credentials.
2. Deploy backend service with backend environment variables.
3. Run `npm run build` in `backend`.
4. Run `npm run db:migrate:deploy` in `backend`.
5. Start backend service and wait until `https://api-hr.pralux.co.id/api/health/ready` returns healthy.
6. Deploy frontend service with frontend environment variables.
7. Run `npm run build` in project root.
8. Start frontend service on `https://hr.pralux.co.id`.
9. Run smoke checks for login, dashboard, attendance, reimbursement, and reports across both subdomains.

## 8) Rollback
- Keep previous app artifact/build available.
- Roll back frontend and backend independently if only one service is affected.
- Only roll back database if a release introduced incompatible schema/data changes.
- Re-run readiness check and core smoke tests after rollback.
