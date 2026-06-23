# Cadence

Multi-tenant, white-label SaaS for South African professional-services firms to
**sell, sign, bill, and get paid** — proposals, e-signed engagement letters, and
upfront + recurring payments, localised for South Africa and processing payments
through **Stitch** (which Ignition does not). Working codename: _Cadence_.

Two billing layers, never conflated:

- **Layer A (platform):** Brunel Studios charges subscribing firms a recurring
  SaaS fee in ZAR via Brunel's own Stitch account.
- **Layer B (tenant → client):** each firm charges its own clients via the
  firm's own Stitch account (upfront at sign + recurring via DebiCheck).

## Stack

Nx + pnpm monorepo · NestJS (API) · Angular (web) · Prisma + PostgreSQL 15 ·
Passport/JWT + argon2id auth · ports-and-adapters for every vendor (Stitch, Xero,
Resend, S3-compatible storage, pdfmake, AES-GCM key provider, Postgres job runner).

```
apps/api            NestJS application (Cloud Run / Vercel artifact)
apps/web            Angular console (white-label, runtime-themed)
libs/shared-types   DTOs + enums shared both ways
libs/core           domain + ports (interfaces) + tenancy + money/VAT
libs/adapters       concrete vendor adapters + working mocks
prisma/             schema, migrations, demo seed
```

## Local setup

Prerequisites: Node 20+, pnpm 10, Docker (for Postgres).

```bash
cp .env.example .env                 # fill in secrets (mocks work out of the box)
pnpm install
pnpm db:up                           # start Postgres via docker-compose
pnpm db:migrate                      # apply Prisma migrations
pnpm db:seed                         # demo tenant + platform admin
pnpm api:dev                         # API at http://localhost:3000 (docs at /api/docs)
pnpm web:dev                         # web at http://localhost:4200
```

If you cannot run Docker, point `DATABASE_URL` at any PostgreSQL 15+ instance.

### Demo credentials (after seed)

- Firm owner: `owner@demo-advisory.co.za` / `Password123!` (tenant slug `demo`)
- Platform admin: `admin@brunelstudios.com` / `Password123!`

In local/dev, select a tenant by sending header `x-tenant-slug: demo` (in
production the tenant is resolved from the Host header / custom domain).

## Quality gates

```bash
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit (strict)
pnpm test        # jest (unit + tenant-isolation integration when DATABASE_URL set)
pnpm build       # webpack bundle -> dist/apps/api/main.js
```

The **tenant-isolation test is mandatory** and proves no cross-tenant read or
write is possible (`apps/api/src/tenancy/tenant-isolation.spec.ts`).

## Adapters: real vs mock

Every external service sits behind a port with a real adapter **and** a working
mock. `PAYMENT_PROVIDER`, `ACCOUNTING_PROVIDER`, `NOTIFICATION_PROVIDER` select
`real`|`mock`. With mocks (the default) the whole sell→sign→pay flow runs without
any live credentials. See `docs/HANDOFF.md` for what to supply before go-live.

## Documentation

- `docs/ARCHITECTURE.md` — hexagonal design, tenancy, modules
- `docs/PORTABILITY.md` — GCP-portability checklist (kept green)
- `docs/DECISIONS.md` — ADRs for every non-obvious choice
- `docs/RUNBOOK.md` — deploy, ops, POPIA/breach notes
- `docs/HANDOFF.md` — credentials/branding/domains the user must supply
- `docs/BUILD_LOG.md` — per-phase build log
