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
    await this.base.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }

  /** Raw, unscoped client for migrations/seed/system tasks. Use sparingly. */
  get raw(): PrismaClient {
    return this.base;
  }
}
