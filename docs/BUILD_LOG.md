# Build Log

Per-phase record of what was built. Newest first within each phase.

## Phase A — reference extraction
- No `reference/ignition/*.webarchive` files present in the repo → Phase A
  skipped per spec (best-effort, non-blocking). Proceeded on the spec + Ignition
  IA from §10/§11. Logged as ADR-008 and in HANDOFF for later refinement.

## Phase 0 — foundation ✅
- Nx + pnpm monorepo: `apps/api`, `apps/web` (shell), `libs/shared-types`,
  `libs/core`, `libs/adapters`. Strict TypeScript, ESLint, Prettier.
- Full Prisma schema for the entire §8 data model (platform, tenant, identity,
  CRM, library, engagements, Layer-B billing, forms, system) on PostgreSQL 15;
  initial migration created and applied.
- Ports-and-adapters wired: `PaymentProvider`, `AccountingProvider`,
  `NotificationService`, `StorageService`, `DocumentService`, `KeyProvider`,
  `Scheduler`/`JobRunner` — each with a real adapter and a working mock,
  selected by env flag.
- NestJS API boots: global prefix `/api`, Swagger at `/api/docs`, validation
  pipe, cookie-parser, raw-body for webhooks. `/health` returns 200 (DB check).
- Dockerfile (Cloud Run artifact), docker-compose Postgres, GitHub Actions CI
  (lint + typecheck + test + build with a Postgres service), `.env.example`,
  demo seed.
- **Acceptance met:** web/api build; DB migrates; `/health` 200; seed creates a
  demo tenant. (Verified by booting the bundled `dist/apps/api/main.js`.)

## Phase 1 — auth, tenancy, white-label, RBAC, onboarding ✅ (backend)
- JWT auth (short access + rotating refresh w/ reuse detection), argon2id
  hashing, account lockout, strong password policy. Email verification, password
  reset, team invitations + accept — all via `NotificationService` (mock by
  default).
- Tenant model with Host resolution (`TenantContextMiddleware`),
  AsyncLocalStorage context, and the Prisma tenant-scoping client extension.
  Memberships + 5 roles + `RolesGuard` rank enforcement; `@Public()` opt-out.
- Runtime white-label: `GET /api/tenant/context` returns per-tenant branding;
  firm signup creates tenant + owner + 14-day trial subscription (Layer A).
- **Acceptance met:**
  - ✅ Automated **tenant-isolation test** proves two tenants cannot read or
    write each other's data (integration test against real Postgres) + unit
    tests of the scoping extension. **Mandatory gate passed.**
  - ✅ Theme resolves by hostname / tenant (verified: demo brand colours).
  - ✅ Invitations + role enforcement; password reset flow implemented.
  - ✅ Verified live: signup → JWT, login → `/api/auth/me` with tenant + role.

### Verified this session
- `pnpm lint` clean · `pnpm typecheck` clean · `pnpm test` 12/12 green
  (incl. tenant-isolation integration) · `pnpm build` → single
  `dist/apps/api/main.js` · API boots and serves health/auth/tenant endpoints
  against a live Postgres.

## Status of later phases
Phases 2–6 (CRM, proposals/e-sign/PDF, Layer-B payments, Layer-A plan gating,
Xero/reporting/notifications/forms) are scaffolded by the data model, ports, and
mock adapters but not yet implemented as feature modules. See the final summary
(to be appended on completion) and `docs/HANDOFF.md`.
