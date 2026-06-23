import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopeExtension } from '@cadence/core';

/**
 * Resolve the database connection string from whichever env var is present.
 * Vercel Postgres / Neon integrations inject different names depending on
 * version, so we accept all of them and fall back to DATABASE_URL.
 */
function resolveDatabaseUrl(): string {
  // Prefer a DIRECT (non-pooling) connection. Vercel Postgres / Neon poolers run
  // PgBouncer in transaction mode, which breaks Prisma's prepared statements
  // unless `pgbouncer=true` is set — using the direct URL avoids that entirely
  // and is fine for this app's load.
  const direct =
    process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  if (direct) return direct;

  const pooled =
    process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (pooled) {
    // If it's a pooled endpoint, make Prisma PgBouncer-safe.
    if (/-pooler\.|pgbouncer/.test(pooled) && !/pgbouncer=true/.test(pooled)) {
      return pooled + (pooled.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
    return pooled;
  }

  // Valid-format placeholder so PrismaClient construction never throws when no
  // database is configured; queries fail gracefully and are caught at runtime.
  return 'postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured';
}

/**
 * PrismaService owns the connection and exposes a tenant-scoped client. The
 * tenant-scope extension reads the active tenant from AsyncLocalStorage at query
 * time, so a single extended client serves every request safely.
 *
 * Always query through `prisma.client.*`. System/bootstrap paths run outside a
 * tenant store (or under platform-admin scope) and are not auto-scoped.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly base = new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
  });
  readonly client = this.base.$extends(tenantScopeExtension());

  async onModuleInit(): Promise<void> {
    // Non-fatal: in serverless/cold environments DATABASE_URL may be unset or the
    // DB briefly unreachable. Prisma connects lazily on first query, so we don't
    // block app boot — health endpoints surface DB status separately.
    try {
      await this.base.$connect();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Prisma initial connect failed (will retry lazily):', (err as Error).message);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }

  /** Raw, unscoped client for migrations/seed/system tasks. Use sparingly. */
  get raw(): PrismaClient {
    return this.base;
  }
}
