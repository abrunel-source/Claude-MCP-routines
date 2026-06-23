import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopeExtension } from '@cadence/core';

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
  private readonly base = new PrismaClient();
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
