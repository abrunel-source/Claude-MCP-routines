// DocumentService port — implemented by PdfmakeDocumentService (serverless-safe).

export interface SignedProposalDocInput {
  tenantName: string;
  proposalNumber: string;
  prospectName: string;
  coverLetterBody: string;
  selectedPackageName: string;
  lineItems: { name: string; quantity: number; unitPriceCents: number }[];
  termsBody: string;
  signerName: string;
  signedAtIso: string;
  currency: string;
}

export interface InvoiceDocInput {
  tenantName: string;
  invoiceNumber: string;
  clientName: string;
  currency: string;
  lineItems: { name: string; quantity: number; unitPriceCents: number; taxRatePct: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export interface DocumentService {
  renderSignedProposal(input: SignedProposalDocInput): Promise<Buffer>;
  renderInvoice(input: InvoiceDocInput): Promise<Buffer>;
}
