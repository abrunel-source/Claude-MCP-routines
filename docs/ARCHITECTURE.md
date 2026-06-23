# Architecture

## Style: hexagonal (ports & adapters)

Domain and application logic live in `libs/core` and depend **only** on ports
(interfaces). Concrete vendor adapters live in `libs/adapters` and are bound to
DI tokens in `apps/api`. Domain code never imports a vendor SDK.

```
            ┌─────────────────────────────────────────────┐
            │                 apps/api (Nest)             │
            │   controllers · services · DI wiring        │
            └───────────────┬─────────────────────────────┘
                            │ depends on
            ┌───────────────▼───────────────┐    implemented by
            │          libs/core             │◄────────────────────┐
            │  ports (interfaces) · tenancy  │                     │
            │  money/VAT · domain logic      │             libs/adapters
            └───────────────┬───────────────┘     Stitch · Xero · Resend · S3
                            │ shares                pdfmake · AES-GCM key · jobs
            ┌───────────────▼───────────────┐       (+ a working mock each)
            │       libs/shared-types        │
            │       DTOs · enums (both ways) │
            └────────────────────────────────┘
```

### Ports (each: 1 real adapter + 1 mock/double)

| Port | Real | Mock/double |
|---|---|---|
| `PaymentProvider` | `StitchPaymentProvider` | `MockPaymentProvider` |
| `AccountingProvider` | `XeroAccountingProvider` | `MockAccountingProvider` |
| `NotificationService` | `ResendNotificationService` | `MockNotificationService` |
| `StorageService` | `S3StorageService` | (S3-compatible, any endpoint) |
| `DocumentService` | `PdfmakeDocumentService` | (pure JS) |
| `KeyProvider` | `EnvAesKeyProvider` | (AES-256-GCM) |
| `Scheduler`/`JobRunner` | `PostgresJobRunner`/`HttpCronScheduler` | (Postgres table) |

`PAYMENT_PROVIDER` / `ACCOUNTING_PROVIDER` / `NOTIFICATION_PROVIDER` env flags
select real vs mock, so the system runs end-to-end when a credential is absent.

## Multi-tenancy

1. **Resolution by Host** — `TenantContextMiddleware` maps `firm.cadence.co.za`
   (subdomain) or a mapped `CustomDomain` to a `tenantId`. Platform hosts
   (`PLATFORM_HOSTS`) resolve to the Brunel surface (no tenant). Dev override:
   `x-tenant-slug` header.
2. **Request context via AsyncLocalStorage** — the middleware binds a
   `TenantStore` for the whole async request lifetime (`libs/core/tenancy`).
   The JWT strategy later mutates the same store with the user + platform-admin
   flag.
3. **Auto-scoping via a Prisma client extension** — `tenantScopeExtension`
   injects `tenantId` into every where/create on tenant-owned models, and
   refuses `findUnique`/`update`/`delete` (unique-keyed) in tenant scope so
   `tenantId` is always part of the filter. `platform_admin` bypasses scoping.
   Defence-in-depth Postgres RLS (`SET LOCAL app.tenant_id`) is planned per the
   portability rules.
4. **Branding at runtime** — `TenantBranding` (logo, colours, company name)
   served by `GET /api/tenant/context`; the web app applies it via CSS custom
   properties. No rebuilds.

## Roles

`platform_admin` (cross-tenant) · `firm_owner` · `firm_admin` · `firm_member` ·
`firm_readonly`. A `Membership` links a user to a tenant with a role. `RolesGuard`
enforces a rank hierarchy; `@Roles()` sets the minimum required.

## Money & VAT

All amounts are stored in **minor units (cents)** as integers, with a `currency`
field (default + enforced ZAR). VAT maths (inclusive/exclusive, 15% default) is
pure and unit-tested in `libs/core/money`.

## API modules (current)

`PrismaModule` (global) · `AdaptersModule` (global DI bindings) · `HealthModule`
· `AuthModule` (signup/login/refresh/verify/reset/invite) · `TenancyModule`
(branding context). Global guards: `JwtAuthGuard` + `RolesGuard`; `@Public()`
opts a route out of auth.

## Build & deploy artifact

`apps/api` bundles via webpack to a single `dist/apps/api/main.js` with
node_modules external — identical for the Dockerfile (Cloud Run) and the Vercel
serverless path.
