// PaymentProvider port — implemented by StitchPaymentProvider + MockPaymentProvider.
// Domain billing logic depends on this interface only; it must never import the
// Stitch client directly.

export interface PaymentCredentials {
  clientId: string;
  clientSecret: string;
  signingKey?: string;
}

export interface CreatePaymentRequestInput {
  /** Minor units (cents). */
  amountCents: number;
  currency: string; // ZAR
  /** Carries internal correlation, e.g. tenantId|invoiceId. Max 4096 chars. */
  externalReference: string;
  /** Max 12 chars. */
  payerReference: string;
  /** Max 20 chars. */
  beneficiaryReference: string;
  payerName?: string;
  payerEmail?: string;
  redirectUrl: string;
}

export interface PaymentRequestResult {
  /** Stitch payment request id. */
  id: string;
  /** Hosted payment page URL to redirect the client to. */
  url: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
}

export interface CreateMandateInput {
  amountCents: number;
  currency: string;
  payerName: string;
  payerReference: string; // max 12
  externalReference: string;
}

export interface MandateResult {
  id: string;
  status: 'pending' | 'active' | 'rejected' | 'cancelled';
}

export interface CollectionInput {
  mandateRef: string;
  amountCents: number;
  currency: string;
  externalReference: string;
}

export interface CollectionResult {
  id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
}

export interface RefundInput {
  paymentRef: string;
  amountCents: number;
}

export interface WebhookVerificationResult {
  valid: boolean;
  idempotencyKey: string;
  paymentRef?: string;
  externalReference?: string;
  status?: 'succeeded' | 'failed' | 'processing';
}

export interface PaymentProvider {
  /** Create a hosted payment page (Pay by Bank / card) for an upfront payment. */
  createPaymentRequest(
    creds: PaymentCredentials,
    input: CreatePaymentRequestInput,
  ): Promise<PaymentRequestResult>;

  /** Query a payment request's current status. */
  getPaymentStatus(creds: PaymentCredentials, paymentRef: string): Promise<PaymentRequestResult>;

  /** Capture a DebiCheck mandate for recurring collections. */
  createMandate(creds: PaymentCredentials, input: CreateMandateInput): Promise<MandateResult>;

  /** Collect against an active mandate (scheduled debit order). */
  collect(creds: PaymentCredentials, input: CollectionInput): Promise<CollectionResult>;

  /** Refund a settled payment. */
  refund(creds: PaymentCredentials, input: RefundInput): Promise<{ id: string; status: string }>;

  /** Verify a webhook signature and extract reconciliation keys. */
  verifyWebhook(rawBody: string, signatureHeader: string, secret: string): WebhookVerificationResult;
}
