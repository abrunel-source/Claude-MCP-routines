import type {
  AccountingProvider,
  AccountingTokens,
  AccountingContact,
  AccountingInvoiceInput,
  AccountingInvoiceResult,
} from '@cadence/core';

export interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * XeroAccountingProvider — real adapter over the xero-node SDK. The SDK is
 * imported dynamically so the workspace builds without it installed; install
 * `xero-node` and supply credentials to activate (ACCOUNTING_PROVIDER=real).
 *
 * TODO(production-credentials): Xero app credentials + sandbox connection.
 * See docs/HANDOFF.md.
 */
export class XeroAccountingProvider implements AccountingProvider {
  constructor(private readonly config: XeroConfig) {}

  // Cast the specifier to defeat static module resolution; resolved at runtime.
  private async sdk(): Promise<any> {
    return import('xero-node' as any);
  }

  async syncContact(_tokens: AccountingTokens, _contact: AccountingContact): Promise<{ externalId: string }> {
    await this.sdk();
    // TODO(production-credentials): map to Xero Contacts API upsert.
    throw new Error('XeroAccountingProvider requires xero-node + credentials.');
  }

  async createInvoice(
    _tokens: AccountingTokens,
    _input: AccountingInvoiceInput,
  ): Promise<AccountingInvoiceResult> {
    await this.sdk();
    throw new Error('XeroAccountingProvider requires xero-node + credentials.');
  }

  async getInvoiceStatus(
    _tokens: AccountingTokens,
    _externalId: string,
  ): Promise<{ status: string; paid: boolean }> {
    await this.sdk();
    throw new Error('XeroAccountingProvider requires xero-node + credentials.');
  }

  async refreshTokens(_tokens: AccountingTokens): Promise<AccountingTokens> {
    await this.sdk();
    throw new Error('XeroAccountingProvider requires xero-node + credentials.');
  }
}
