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

## Phase 2 — CRM ✅ (backend)
- Tenant-scoped CRUD for organizations, contacts, deals (kanban with
  stage + position move), activities (timeline), tags; search/filter on
  contacts & organizations; lifecycle links (deal → proposals).
- **Acceptance met:** all entities tenant-scoped (enforced by the Prisma
  extension proven in Phase 1); `PATCH /crm/deals/:id/move` updates stage +
  position; activity timeline via `GET /crm/activities`; search via `?q=`.

## Phase 3 — proposals, e-sign, PDF ✅ (backend) + Phase 4 upfront pay (partial)
- Library: cover letters, terms templates, services catalogue, service packages
  (with line items) — `LibraryController`.
- Proposal composition: pick cover letter + one/more packages + terms, assign by
  email; snapshots content; auto-numbered `PROP-XXXX`.
- Send: issues a unique signed, expiring public link; status → `sent`; emails the
  prospect (mock); `ProposalEvent` recorded.
- Strict ordered public wizard (no login, tenant-themed payload):
  view → select package → accept terms → sign. Every step writes a
  `ProposalEvent` with IP/UA/UTC; first-view + view-count tracked.
- Sign: binds the selected package + accepted terms + signature into an
  immutable PDF (pdfmake), SHA-256 hashes the bytes, stores it
  (`StorageService`), writes `SignatureEvent` (ECTA audit trail: signer, IP, UA,
  consent, hash) + `SignedDocument`, sets status `signed`, and emails the signed
  PDF to **both** prospect and firm.
- At sign, captures the upfront payment via `PaymentProvider` (mock hosted page →
  `Payment` row) and, for recurring packages, a DebiCheck mandate +
  `BillingSchedule` (Layer-B groundwork for Phase 4).
- **Acceptance met:** full compose→send→view→step→sign flow works end-to-end
  (e2e test); single-package `Next` progression; firm status timeline via
  `GET /proposals/:id` (events with UTC timestamps + view count); audit record
  includes the document SHA-256; signed PDF stored + emailed to both parties.

### Verified this session (Phases 2–3)
- `pnpm lint` clean · `pnpm typecheck` clean · `pnpm test` **15/15 green**
  (incl. tenant-isolation + the sell→sign→pay e2e) · `pnpm build` succeeds.

## Web console (Angular) ✅ (shell + themed prospect wizard)
- Angular 18 standalone + signals app that builds (`pnpm nx run web:build`).
- **Runtime white-label theming**: `ThemeService` fetches `/api/tenant/context`
  and applies brand colours via CSS custom properties — no rebuild per tenant.
- Pages: landing, firm login (calls the API, stores the access token),
  dashboard shell (`/app`, guarded), and the **themed public proposal wizard**
  (`/p/:token`) implementing the strict 5-step flow (cover → packages → terms →
  signature → confirmation) against the public API, including the upfront-payment
  call-to-action and the document hash on completion.
- The full Material-themed firm console (the §11 IA: Home/Clients/Deals/
  Proposals/Services/Library/Invoices/Billing/Forms/Settings) builds on this
  scaffold — next increment, see HANDOFF.
- Webhook idempotency module added (Stitch): signature verify + `WebhookEvent`
  dedup + reconciliation; mandatory duplicate-no-double-effect test passes.

## Status of remaining phases
- **Phase 4 (Layer-B payments):** upfront pay + mandate + schedule done at sign;
  still to do — hosted invoice views, `InvoiceView` open-tracking, webhook
  verification + idempotency endpoint, dunning/retries via the job runner.
- **Phase 5 (Layer-A plan gating):** trial subscription created on signup; still
  to do — plan-limit enforcement, upgrade/downgrade/cancel, platform admin
  console + metrics.
- **Phase 6 (Xero, reporting, notifications, forms):** ports + mocks exist;
  feature modules not yet built.
See `docs/HANDOFF.md` and the final summary below.
