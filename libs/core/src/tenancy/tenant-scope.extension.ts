import { getTenantStore } from './tenant-context';

/**
 * Models that carry a `tenantId` scalar and must be auto-scoped to the active
 * tenant. Child rows (line items, events, etc.) are scoped transitively via
 * their parent and are intentionally NOT listed here.
 */
export const TENANT_SCOPED_MODELS = new Set<string>([
  'TenantSubscription',
  'PlatformInvoice',
  'TenantBranding',
  'TenantSettings',
  'CustomDomain',
  'TaxRate',
  'TenantPaymentCredential',
  'TenantAccountingConnection',
  'Membership',
  'Invitation',
  'Organization',
  'Contact',
  'Deal',
  'Activity',
  'Tag',
  'Service',
  'ServicePackage',
  'CoverLetter',
  'TermsTemplate',
  'EmailTemplate',
  'DocumentTemplate',
  'ProposalTemplate',
  'Proposal',
  'ClientPaymentMandate',
  'Invoice',
  'Payment',
  'BillingSchedule',
  'Form',
  'FormSubmission',
  'NotificationLog',
]);

const WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const CREATE_OPS = new Set(['create', 'createMany']);

/**
 * Prisma client extension enforcing tenant isolation at the application layer.
 *
 * Rules:
 *  - platform_admin scope bypasses scoping entirely (cross-tenant).
 *  - Outside any tenant store, tenant-scoped models are left untouched (used by
 *    bootstrap/seed/system paths that set tenantId explicitly).
 *  - Inside a tenant store, every where-bearing query is filtered by tenantId
 *    and every create injects tenantId.
 *  - findUnique/update/delete (single, unique-keyed) are refused for tenant
 *    models in tenant scope — callers must use findFirst/updateMany/deleteMany
 *    so tenantId is always part of the filter. This removes a whole class of
 *    cross-tenant read/write leaks.
 *
 * This is defence in depth alongside Postgres RLS (SET LOCAL app.tenant_id).
 */
export function tenantScopeExtension() {
  return {
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const store = getTenantStore();

          // No active store, or platform admin: do not scope.
          if (!store || store.isPlatformAdmin) {
            return query(args);
          }

          const tenantId = store.tenantId;
          if (!tenantId) {
            throw new Error(
              `Tenant scope required for ${model}.${operation} but no tenantId is set.`,
            );
          }

          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            throw new Error(
              `${model}.${operation} is not permitted in tenant scope; use findFirst so tenantId is enforced.`,
            );
          }
          if (operation === 'update' || operation === 'delete') {
            throw new Error(
              `${model}.${operation} is not permitted in tenant scope; use updateMany/deleteMany so tenantId is enforced.`,
            );
          }

          const next = { ...args };

          if (WHERE_OPS.has(operation)) {
            next.where = { ...(next.where ?? {}), tenantId };
          } else if (CREATE_OPS.has(operation)) {
            if (operation === 'createMany') {
              const data = Array.isArray(next.data) ? next.data : [next.data];
              next.data = data.map((d: Record<string, unknown>) => ({ ...d, tenantId }));
            } else {
              next.data = { ...(next.data ?? {}), tenantId };
            }
          } else if (operation === 'upsert') {
            next.where = { ...(next.where ?? {}), tenantId };
            next.create = { ...(next.create ?? {}), tenantId };
          }

          return query(next);
        },
      },
    },
  };
}
