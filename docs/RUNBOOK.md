# Runbook

## Local development

```bash
pnpm install
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm api:dev      # http://localhost:3000 (Swagger at /api/docs)
pnpm web:dev      # http://localhost:4200
```

No Docker? Point `DATABASE_URL` at any PostgreSQL 15+ instance and run
`pnpm db:migrate && pnpm db:seed`.

## Build & run the container (Cloud Run parity)

```bash
docker build -f apps/api/Dockerfile -t cadence-api .
docker run -p 3000:3000 --env-file .env cadence-api
```

## Deploy

### Vercel (interim) — single combined project

The repo deploys as **one** Vercel project (root `vercel.json`) that serves the
Angular SPA at `/` and the NestJS API as a serverless function at `/api/*`
(same origin — the web's `/api` calls work with no CORS/proxy):

- `buildCommand`: `pnpm run vercel-build` → builds the Angular app
  (`dist/apps/web`) **and** the API serverless bundle (`dist/apps/api/serverless.js`).
- `outputDirectory`: `dist/apps/web` (static SPA, with a rewrite to `index.html`).
- Function `api/[[...path]].js` re-exports the bundled Nest handler; webhook raw
  body works (`rawBody: true` in `app.factory.ts`).
- Set **Project → Settings → Framework Preset = Other** (the root `vercel.json`
  already sets `framework: null`; do not use the NestJS preset).

**Required environment variables** (Project → Settings → Environment Variables):

| Var | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | all DB features | Supabase Postgres connection string |
| `ENCRYPTION_MASTER_KEY` | tenant secret encryption | `openssl rand -base64 32` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | auth | strong random strings |
| `PLATFORM_HOSTS` | tenant routing | include the deployment domain so it maps to the platform surface, e.g. `your-app.vercel.app` |
| `APP_ROOT_DOMAIN` | subdomain tenants | e.g. `cadence.co.za` |
| `*_PROVIDER` + vendor keys | real Stitch/Xero/Resend/S3 | optional; default to mocks |

After setting `DATABASE_URL`, apply schema + demo data once:
`pnpm prisma migrate deploy` and `pnpm db:seed` (run locally against the prod DB,
or from a one-off job). Until `DATABASE_URL` is set the SPA still loads and
`/api/health/live` responds; DB-backed routes return errors by design.

### GCP (target)
- API → Cloud Run from `apps/api/Dockerfile`, region `africa-south1`.
- DB → Cloud SQL for Postgres; set `DATABASE_URL`.
- Secrets → Secret Manager + Cloud KMS (swap `EnvAesKeyProvider` →
  `CloudKmsKeyProvider`).
- Scheduling → Cloud Scheduler hitting the protected worker endpoint.

## Scheduled jobs / cron

Jobs are rows in the Postgres `Job` table drained by a protected worker endpoint
(shared `CRON_SECRET`). Vercel Cron now, Cloud Scheduler later — no logic change.

## Database operations

```bash
pnpm prisma migrate deploy     # apply migrations (prod release)
pnpm prisma migrate dev        # create + apply a new migration (dev)
pnpm prisma studio             # inspect data
```

## POPIA / data protection

- **Lawful processing & minimisation:** only data needed for engagements/billing.
- **Data-subject access/erasure:** tenant-scoped deletes cascade
  (`onDelete: Cascade`); export per data subject via tenant-scoped queries.
- **Secrets at rest:** tenant Stitch/Xero credentials AES-256-GCM encrypted; no
  secrets in logs.
- **Payment data:** none stored — Stitch hosted pages minimise PCI scope.
- **Data residency:** prefer SA (`africa-south1`). Interim Vercel/Supabase may
  place data outside SA (see `PORTABILITY.md`).

## Breach response (outline)

1. Contain — rotate affected credentials (env vars / KMS), revoke sessions
   (`RefreshToken.revokedAt`).
2. Assess scope via `AuditLog` and `WebhookEvent`.
3. Notify the Information Regulator and affected data subjects per POPIA §22.
4. Post-incident review; record in this runbook.

## Common issues

- **401 on `/api/...`** — global JWT guard; add `@Public()` for unauthenticated
  routes (e.g. health, signup, public proposal/invoice views).
- **`Tenant scope required` errors** — a tenant-owned query ran without a tenant
  store; ensure the request passed through `TenantContextMiddleware` or use
  `prisma.raw` for system/bootstrap paths.
- **P1001 (can't reach DB)** — check `DATABASE_URL` and that Postgres is up.
