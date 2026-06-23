# GCP Portability Checklist

The interim stack (Vercel + Supabase) must migrate to GCP (`africa-south1`,
Johannesburg) with no logic changes. Every item is kept green.

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | All config via env vars; no hardcoded URLs/regions/endpoints | ✅ | `apps/api/src/config/env.ts`; `.env.example` complete |
| 2 | Backend stateless (JWT sessions, files in object storage, jobs in Postgres) | ✅ | No local-disk/in-memory request state; refresh tokens + jobs in DB |
| 3 | API container builds & runs identically to Vercel | ✅ | `apps/api/Dockerfile` builds the same `main.js` bundle |
| 4 | Standard Postgres only; no Supabase-proprietary features; no supabase-js | ✅ | Plain `DATABASE_URL` via Prisma only |
| 5 | Object storage only via S3-compatible interface, env-driven | ✅ | `S3StorageService`, endpoint/keys from env |
| 6 | Email/payments/accounting/secrets/scheduling behind ports | ✅ | No vendor SDK in `libs/core` |
| 7 | No Vercel-proprietary primitives (KV/Blob/Edge Config) in core | ✅ | None used |
| 8 | Scheduling = cron trigger + Postgres job table | ⏳ | `JobRunner`/`Scheduler` ports defined; `PostgresJobRunner` lands in Phase 4 |
| 9 | Prefer SA data residency; target `africa-south1` on GCP | ⚠️ | Interim Vercel/Supabase may place data outside SA — the reason the GCP move matters. Documented; no code dependency on region |

## Migration map

| Concern | Now | Later (GCP) |
|---|---|---|
| Frontend hosting | Vercel | Cloud Storage + Cloud CDN / Firebase Hosting |
| API hosting | Vercel serverless | Cloud Run (Dockerfile ready) |
| Postgres | Supabase (plain conn string) | Cloud SQL for Postgres |
| Object storage | Supabase Storage / R2 | Cloud Storage (S3 XML API) |
| Payments | Stitch | Stitch (unchanged) |
| Accounting | Xero | Xero (unchanged) |
| Email | Resend | Resend (unchanged) |
| Secrets | Env vars (`EnvAesKeyProvider`) | Cloud KMS + Secret Manager (`CloudKmsKeyProvider`) |
| Scheduling | Vercel Cron → worker endpoint | Cloud Scheduler → Cloud Run job |

Swapping a provider = implementing its existing port + changing DI binding/env.
No domain code changes.
