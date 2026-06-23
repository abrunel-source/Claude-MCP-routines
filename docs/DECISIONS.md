# Architecture Decision Records

Short ADRs for non-obvious choices. Format: context · choice · why.

## ADR-001 — Money stored as integer cents
**Context:** floating-point money causes rounding drift; SA VAT needs exactness.
**Choice:** all monetary values are `Int` minor units with a `currency` field.
**Why:** exact arithmetic; trivial multi-currency-ready storage while enforcing ZAR now.

## ADR-002 — VAT inclusive by default, 15%
**Context:** South African professional-services pricing is usually quoted VAT-inclusive.
**Choice:** `TaxMode.inclusive` default; `TaxRate` per tenant, default 15%.
**Why:** matches local commercial norm; `lineTax()` supports both modes per line.

## ADR-003 — Tenant isolation via Prisma client extension + ALS
**Context:** need strong, vendor-neutral tenant isolation portable off Supabase.
**Choice:** AsyncLocalStorage tenant store + a Prisma `$extends` query interceptor
that injects `tenantId` and forbids unique-keyed single-row ops in tenant scope.
**Why:** application-layer enforcement independent of any auth vendor; testable;
RLS added later as defence in depth. Forbidding `findUnique`/`update`/`delete`
removes a whole class of cross-tenant leaks (proven by the isolation test).

## ADR-004 — Hoisted pnpm node-linker
**Context:** the API is bundled to one `main.js` with node_modules external; the
Dockerfile copies a single `node_modules`.
**Choice:** `.npmrc` `node-linker=hoisted`.
**Why:** runtime dependency resolution from one root `node_modules` matches both
the container and Vercel layouts; avoids pnpm nested-store resolution failures.

## ADR-005 — webpack bundle, deps external
**Context:** native modules (argon2) and Prisma cannot be naively bundled.
**Choice:** Nest webpack builder bundles only `@cadence/*` libs from source;
every bare import stays external/`commonjs`.
**Why:** single deployable artifact, native modules load normally at runtime.

## ADR-006 — Plan tiers & commercial defaults
**Context:** spec leaves platform (Layer A) pricing open.
**Choice:** Starter R499, Growth R999, Scale R1 999 / month (ZAR, VAT-inclusive),
14-day no-card trial, 17% annual discount; limits seats/proposals/clients per tier.
**Why:** sensible SA SaaS price points; trial mirrors Ignition (no card to start);
annual discount is standard upsell. Revisit with real market data pre-launch.

## ADR-007 — Mock adapters selected by env flag
**Context:** Stitch/Xero/Resend credentials are not available during the build.
**Choice:** every port ships a real adapter + a working mock; `*_PROVIDER=mock`
default runs the full flow without credentials.
**Why:** never stall on missing external dependencies (spec §0); swap to real via
env only.

## ADR-008 — Reference extraction (Phase A) skipped
**Context:** no `reference/ignition/*.webarchive` files were present in the repo.
**Choice:** proceed on the spec + best-judgement IA mirroring Ignition (§11).
**Why:** Phase A is explicitly best-effort/non-blocking. Logged in HANDOFF so the
user can supply screenshots to refine schema/IA later.

## ADR-009 — Refresh-token rotation with reuse detection
**Context:** long-lived refresh tokens are a theft risk.
**Choice:** hashed refresh tokens with a rotation `family`; presenting a revoked
token revokes the whole family; password reset revokes all sessions.
**Why:** standard, robust session security without a third-party auth vendor.
