import { randomUUID } from 'node:crypto';
import type {
  AccountingProvider,
  AccountingTokens,
  AccountingContact,
  AccountingInvoiceInput,
  AccountingInvoiceResult,
} from '@cadence/core';

/** MockAccountingProvider — Xero double for when the sandbox is unreachable. */
export class MockAccountingProvider implements AccountingProvider {
  async syncContact(_tokens: AccountingTokens, _contact: AccountingContact): Promise<{ externalId: string }> {
    return { externalId: `mock_contact_${randomUUID()}` };
  }

  async createInvoice(
    _tokens: AccountingTokens,
    _input: AccountingInvoiceInput,
  ): Promise<AccountingInvoiceResult> {
    return { externalId: `mock_inv_${randomUUID()}`, status: 'AUTHORISED' };
  }

  async getInvoiceStatus(
    _tokens: AccountingTokens,
    _externalId: string,
  ): Promise<{ status: string; paid: boolean }> {
    return { status: 'PAID', paid: true };
  }

  async refreshTokens(tokens: AccountingTokens): Promise<AccountingTokens> {
    return { ...tokens, expiresAt: new Date(Date.now() + 1800_000) };
  }
}
