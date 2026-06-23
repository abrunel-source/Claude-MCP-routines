import { PrismaClient } from '@prisma/client';
import { tenantScopeExtension, runWithTenant } from '@cadence/core';

/**
 * MANDATORY tenant-isolation test (spec §15). Proves that under tenant A's
 * scope, tenant B's rows are invisible and immutable. Requires a live Postgres
 * (DATABASE_URL) with migrations applied — runs in CI; skipped locally without a DB.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d('tenant isolation (integration)', () => {
  const base = new PrismaClient();
  const db = base.$extends(tenantScopeExtension());
  let tenantA = '';
  let tenantB = '';
  let contactB = '';

  beforeAll(async () => {
    await base.$connect();
    const a = await base.tenant.create({ data: { name: 'Firm A', slug: `a-${Date.now()}` } });
    const b = await base.tenant.create({ data: { name: 'Firm B', slug: `b-${Date.now()}` } });
    tenantA = a.id;
    tenantB = b.id;
    await base.contact.create({
      data: { tenantId: tenantA, firstName: 'Alice', email: 'alice@a.test' },
    });
    const cb = await base.contact.create({
      data: { tenantId: tenantB, firstName: 'Bob', email: 'bob@b.test' },
    });
    contactB = cb.id;
  });

  afterAll(async () => {
    await base.contact.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await base.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await base.$disconnect();
  });

  it('cannot READ another tenant rows', async () => {
    await runWithTenant({ tenantId: tenantA, isPlatformAdmin: false }, async () => {
      const contacts = await db.contact.findMany();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].firstName).toBe('Alice');
      const bob = await db.contact.findFirst({ where: { id: contactB } });
      expect(bob).toBeNull();
    });
  });

  it('cannot WRITE another tenant rows', async () => {
    await runWithTenant({ tenantId: tenantA, isPlatformAdmin: false }, async () => {
      const updated = await db.contact.updateMany({
        where: { id: contactB },
        data: { firstName: 'Hacked' },
      });
      expect(updated.count).toBe(0);
      const deleted = await db.contact.deleteMany({ where: { id: contactB } });
      expect(deleted.count).toBe(0);
    });
    // Bob is untouched.
    const bob = await base.contact.findUnique({ where: { id: contactB } });
    expect(bob?.firstName).toBe('Bob');
  });

  it('auto-stamps tenantId on create', async () => {
    await runWithTenant({ tenantId: tenantA, isPlatformAdmin: false }, async () => {
      const c = await db.contact.create({ data: { firstName: 'Carol', email: 'carol@a.test' } as any });
      expect(c.tenantId).toBe(tenantA);
    });
  });
});
