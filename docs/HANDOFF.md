# Handoff — what the user must supply before go-live

Everything below currently runs on **mocks** or **dev defaults** so the product
is demoable end-to-end. Replace each with production values (env vars only —
never commit secrets).

## Production credentials

| Item | Env vars | Used by | Status |
|---|---|---|---|
| **Stitch (platform, Layer A)** | `STITCH_PLATFORM_CLIENT_ID/_SECRET/_SIGNING_KEY`, `STITCH_WEBHOOK_SECRET` | Brunel SaaS billing | ⛔ mock — `// TODO(production-credentials)` in `StitchPaymentProvider` |
| **Stitch (per-tenant, Layer B)** | stored encrypted per tenant via onboarding | client payments/mandates | ⛔ mock |
| **Xero app** | `XERO_CLIENT_ID/_SECRET/_REDIRECT_URI` | accounting sync | ⛔ mock — `XeroAccountingProvider` needs `xero-node` + creds |
| **Resend** | `RESEND_API_KEY`, `RESEND_DEFAULT_FROM` + verified sender domain | all transactional email | ⛔ mock (emails logged to console) |
| **S3-compatible storage** | `S3_ENDPOINT/_REGION/_BUCKET/_ACCESS_KEY_ID/_SECRET_ACCESS_KEY` | signed PDFs, logos | ⚠️ unset — set before file features |
| **Encryption master key** | `ENCRYPTION_MASTER_KEY` (32 bytes base64) | tenant secret encryption | ⚠️ dev fallback in non-prod; **must** be set in prod |
| **JWT secrets** | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | auth | ⚠️ set strong values in prod |

To activate a real adapter: set its `*_PROVIDER=real` flag, install the SDK if
noted, and supply credentials. Mocks remain the default.

## Deploy configuration

- **Vercel** team `brunel-studios-team`. The repo deploys as **one** project
  (`claude-mcp-routines-api`) via the root `vercel.json`: the Angular SPA is
  served at `/` and the NestJS API runs as a serverless function at `/api/*`
  (same origin). See `docs/RUNBOOK.md` → Vercel for the full setup.
- **Known Vercel blockers to clear (one-time, dashboard only — cannot be done
  via API/committed files):**
  - **Builds being CANCELED before they start** (no build logs): this is a
    team-level condition — Vercel build **concurrency** or a **usage/spend cap**.
    Check the team's Usage/Billing and cancel any stuck builds, then redeploy.
  - **Framework Preset**: the project auto-detected as **NestJS**, which forces
    the Output Directory to the Nx project name (`web`) and ignores
    `vercel.json#outputDirectory`, causing `No Output Directory named "web"`.
    Set **Project → Settings → Build & Deployment → Framework Preset = Other**
    (and, if shown, Output Directory = `dist/apps/web`). The repo already
    flattens the Angular output to `dist/apps/web/index.html` and declares the
    Nx build `outputs`, so once the preset is "Other" the committed `vercel.json`
    is authoritative.
- **Action required in the Vercel dashboard (one-time):**
  1. Project → Settings → **Environment Variables**: set at least `DATABASE_URL`,
     `ENCRYPTION_MASTER_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and
     `PLATFORM_HOSTS` (include the deployment domain). Without `DATABASE_URL` the
     SPA loads and `/api/health/live` responds, but DB-backed routes return errors.
  2. After setting `DATABASE_URL`, apply schema + demo data once:
     `pnpm prisma migrate deploy` and `pnpm db:seed` against the prod DB.
  3. If the project's **Output Directory**/**Framework Preset** were set by the
     initial NestJS auto-detection, leave them — `vercel.json` builds the SPA to
     `web/` and the API bundle to `dist/apps/api/`, which the committed config
     already targets.
- **GitHub** org `abrunel-source`. CI runs on every push/PR.
- **Custom domains** — add `CustomDomain` rows per tenant and configure DNS +
  TLS; set `APP_ROOT_DOMAIN` and `PLATFORM_HOSTS`.

## Branding & legal (real content)

- Real Brunel + tenant logos and brand colours (replace seed placeholders).
- Finalised legal: engagement-letter terms, platform ToS, POPIA privacy policy,
  data-processing terms.

## Reference material not available

- No `reference/ignition/*.webarchive` files were present, so Phase A reference
  extraction was skipped (ADR-008). To refine the data model / IA against the
  real Ignition screens, drop the 19 web archives into `reference/ignition/` or
  provide screenshots.

## Carried-forward TODOs (`// TODO(production-credentials)`)

- `libs/adapters/src/payment/stitch-payment.provider.ts` — JWKS client assertion,
  token exchange, payment-initiation + mandate mutations.
- `libs/adapters/src/accounting/xero-accounting.provider.ts` — Contacts/Invoices
  mapping via `xero-node`.
