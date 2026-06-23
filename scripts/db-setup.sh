#!/usr/bin/env bash
# Applies migrations and seeds the demo data during the Vercel build, but only
# when a database connection string is available. Accepts whichever env var the
# Vercel Postgres / Neon integration injects. Non-fatal: a missing or unreachable
# DB never fails the build (the SPA still deploys; DB-backed routes degrade).
set -uo pipefail

# Prefer a direct (non-pooling) URL for migrations; fall back through the names
# different integration versions use.
DBURL="${DATABASE_URL:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL_UNPOOLED:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}}}}"

if [ -z "$DBURL" ]; then
  echo "db-setup: no database env var found (DATABASE_URL / POSTGRES_URL*); skipping migrate + seed."
  exit 0
fi

echo "db-setup: database detected — applying migrations..."
DATABASE_URL="$DBURL" pnpm run db:deploy || {
  echo "db-setup: migrate deploy failed (continuing build; check this log if login fails)."
  exit 0
}

echo "db-setup: seeding demo data (idempotent)..."
DATABASE_URL="$DBURL" pnpm run db:seed || {
  echo "db-setup: seed failed (continuing build; check this log if login fails)."
  exit 0
}

echo "db-setup: done. Demo accounts: admin@brunelstudios.com / owner@demo-advisory.co.za (Password123!)."
