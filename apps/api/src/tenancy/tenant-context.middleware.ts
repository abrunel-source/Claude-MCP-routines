import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { runWithTenant, TenantStore } from '@cadence/core';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';

// The store is created here and mutated later by the JWT guard (same request
// reference) once the authenticated user — and platform-admin status — is known.
declare module 'express' {
  interface Request {
    tenantStore?: TenantStore;
    tenantSlug?: string | null;
  }
}

/**
 * Resolves the active tenant from the Host header (subdomain or mapped custom
 * domain) and binds an AsyncLocalStorage store for the whole request lifetime.
 * Platform hosts resolve to no tenant (Brunel surface).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const hostname = host.split(':')[0].trim().toLowerCase();

    let tenantId: string | undefined;
    let slug: string | null = null;

    const isPlatformHost = env.platformHosts.includes(hostname);

    // Dev convenience: allow explicit tenant selection on platform/localhost.
    const headerSlug = (req.headers['x-tenant-slug'] as string | undefined)?.toLowerCase();

    if (!isPlatformHost || headerSlug) {
      slug = headerSlug ?? this.subdomainOf(hostname);
      if (slug) {
        const tenant = await this.prisma.raw.tenant.findUnique({ where: { slug } });
        if (tenant) {
          tenantId = tenant.id;
        }
      }
      if (!tenantId && !isPlatformHost) {
        const domain = await this.prisma.raw.customDomain.findUnique({
          where: { domain: hostname },
        });
        if (domain) {
          tenantId = domain.tenantId;
        }
      }
    }

    const store: TenantStore = { tenantId, isPlatformAdmin: false };
    req.tenantStore = store;
    req.tenantSlug = slug;

    runWithTenant(store, () => next());
  }

  /** Extract `<slug>` from `<slug>.<rootDomain>`; null if not a subdomain. */
  private subdomainOf(hostname: string): string | null {
    const root = env.appRootDomain.toLowerCase();
    if (hostname === root || !hostname.endsWith(`.${root}`)) {
      return null;
    }
    const sub = hostname.slice(0, -1 * (root.length + 1));
    return sub.split('.')[0] || null;
  }
}
