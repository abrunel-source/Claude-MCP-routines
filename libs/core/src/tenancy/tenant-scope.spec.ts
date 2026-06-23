import { tenantScopeExtension } from './tenant-scope.extension';
import { runWithTenant } from './tenant-context';

// Exercise the extension's query interceptor directly with a fake `query`
// continuation, proving tenantId is injected and unsafe ops are refused.
function op() {
  return tenantScopeExtension().query.$allModels.$allOperations as (args: any) => Promise<any>;
}

describe('tenant-scope extension', () => {
  it('injects tenantId into where for findMany', async () => {
    await runWithTenant({ tenantId: 't1', isPlatformAdmin: false }, async () => {
      const captured: any[] = [];
      await op()({
        model: 'Contact',
        operation: 'findMany',
        args: { where: { email: 'a@b.c' } },
        query: (a: any) => {
          captured.push(a);
          return Promise.resolve([]);
        },
      });
      expect(captured[0].where).toEqual({ email: 'a@b.c', tenantId: 't1' });
    });
  });

  it('injects tenantId into create data', async () => {
    await runWithTenant({ tenantId: 't1', isPlatformAdmin: false }, async () => {
      let seen: any;
      await op()({
        model: 'Contact',
        operation: 'create',
        args: { data: { firstName: 'A' } },
        query: (a: any) => {
          seen = a;
          return Promise.resolve({});
        },
      });
      expect(seen.data).toEqual({ firstName: 'A', tenantId: 't1' });
    });
  });

  it('refuses findUnique on a tenant model in tenant scope', async () => {
    await runWithTenant({ tenantId: 't1', isPlatformAdmin: false }, async () => {
      await expect(
        op()({ model: 'Invoice', operation: 'findUnique', args: { where: { id: 'x' } }, query: async () => ({}) }),
      ).rejects.toThrow(/findFirst/);
    });
  });

  it('does not scope for platform admin', async () => {
    await runWithTenant({ isPlatformAdmin: true }, async () => {
      let seen: any;
      await op()({
        model: 'Contact',
        operation: 'findMany',
        args: { where: {} },
        query: (a: any) => {
          seen = a;
          return Promise.resolve([]);
        },
      });
      expect(seen.where).toEqual({});
    });
  });

  it('leaves non-tenant models untouched', async () => {
    await runWithTenant({ tenantId: 't1', isPlatformAdmin: false }, async () => {
      let seen: any;
      await op()({
        model: 'User',
        operation: 'findUnique',
        args: { where: { id: 'u1' } },
        query: (a: any) => {
          seen = a;
          return Promise.resolve(null);
        },
      });
      expect(seen.where).toEqual({ id: 'u1' });
    });
  });
});
