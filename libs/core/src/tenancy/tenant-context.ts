import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  /** Active tenant for the request. Undefined for platform-admin / public scope. */
  tenantId?: string;
  /** True only for platform_admin — bypasses tenant scoping (cross-tenant). */
  isPlatformAdmin: boolean;
  userId?: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/** Run a callback with a bound tenant store for its entire async lifetime. */
export function runWithTenant<T>(store: TenantStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function getTenantStore(): TenantStore | undefined {
  return storage.getStore();
}

export function getActiveTenantId(): string | undefined {
  return storage.getStore()?.tenantId;
}

export function isPlatformAdminScope(): boolean {
  return storage.getStore()?.isPlatformAdmin === true;
}
