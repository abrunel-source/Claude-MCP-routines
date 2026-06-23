// AccountingProvider port — implemented by XeroAccountingProvider + MockAccountingProvider.

export interface AccountingTokens {
  accessToken: string;
  refreshToken: string;
  tenantRef?: string;
  expiresAt?: Date;
}

export interface AccountingContact {
  name: string;
  email: string;
  externalId?: string;
}

export interface AccountingInvoiceLine {
  description: string;
  quantity: number;
  unitAmountCents: number;
  taxRatePct: number;
}

export interface AccountingInvoiceInput {
  contact: AccountingContact;
  reference: string;
  currency: string;
  lines: AccountingInvoiceLine[];
  taxInclusive: boolean;
  dueAt?: Date;
}

export interface AccountingInvoiceResult {
  externalId: string;
  status: string;
}

export interface AccountingProvider {
  syncContact(tokens: AccountingTokens, contact: AccountingContact): Promise<{ externalId: string }>;
  createInvoice(tokens: AccountingTokens, input: AccountingInvoiceInput): Promise<AccountingInvoiceResult>;
  getInvoiceStatus(tokens: AccountingTokens, externalId: string): Promise<{ status: string; paid: boolean }>;
  refreshTokens(tokens: AccountingTokens): Promise<AccountingTokens>;
}
