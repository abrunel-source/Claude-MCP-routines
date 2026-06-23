import { Injectable, signal } from '@angular/core';
import { ApiService, TenantContext } from './api.service';

/**
 * Applies per-tenant branding at runtime by setting CSS custom properties from
 * GET /api/tenant/context (resolved by Host header). No rebuilds per tenant.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly context = signal<TenantContext | null>(null);

  constructor(private readonly api: ApiService) {}

  load(): void {
    this.api.tenantContext().subscribe({
      next: (ctx) => {
        this.context.set(ctx);
        this.apply(ctx);
      },
      error: () => this.context.set({ platform: true, companyName: 'Cadence' }),
    });
  }

  apply(ctx: TenantContext): void {
    const root = document.documentElement.style;
    if (ctx.brandingPrimaryColor) root.setProperty('--brand-primary', ctx.brandingPrimaryColor);
    if (ctx.brandingSecondaryColor) root.setProperty('--brand-secondary', ctx.brandingSecondaryColor);
    document.title = ctx.companyName ? `${ctx.companyName} · Cadence` : 'Cadence';
  }

  applyBranding(primary?: string, secondary?: string): void {
    const root = document.documentElement.style;
    if (primary) root.setProperty('--brand-primary', primary);
    if (secondary) root.setProperty('--brand-secondary', secondary);
  }
}
