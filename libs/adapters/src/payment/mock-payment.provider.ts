import { createHmac, randomUUID } from 'node:crypto';
import type {
  PaymentProvider,
  PaymentCredentials,
  CreatePaymentRequestInput,
  PaymentRequestResult,
  CreateMandateInput,
  MandateResult,
  CollectionInput,
  CollectionResult,
  RefundInput,
  WebhookVerificationResult,
} from '@cadence/core';

/**
 * MockPaymentProvider — a realistic in-memory Stitch double so the full
 * sell→sign→pay flow runs end-to-end without live credentials. Selected when
 * PAYMENT_PROVIDER=mock. Hosted-page URLs point at a local sandbox confirm route.
 */
export class MockPaymentProvider implements PaymentProvider {
  private readonly requests = new Map<string, PaymentRequestResult>();

  async createPaymentRequest(
    _creds: PaymentCredentials,
    input: CreatePaymentRequestInput,
  ): Promise<PaymentRequestResult> {
    const id = `mock_pay_${randomUUID()}`;
    const url = `${input.redirectUrl}?mockPaymentId=${id}&ref=${encodeURIComponent(
      input.externalReference,
    )}`;
    const result: PaymentRequestResult = { id, url, status: 'pending' };
    this.requests.set(id, result);
    return result;
  }

  async getPaymentStatus(
    _creds: PaymentCredentials,
    paymentRef: string,
  ): Promise<PaymentRequestResult> {
    // Mock settles deterministically on first status check.
    const existing = this.requests.get(paymentRef) ?? {
      id: paymentRef,
      url: '',
      status: 'pending' as const,
    };
    const settled = { ...existing, status: 'succeeded' as const };
    this.requests.set(paymentRef, settled);
    return settled;
  }

  async createMandate(_creds: PaymentCredentials, _input: CreateMandateInput): Promise<MandateResult> {
    return { id: `mock_mandate_${randomUUID()}`, status: 'active' };
  }

  async collect(_creds: PaymentCredentials, _input: CollectionInput): Promise<CollectionResult> {
    return { id: `mock_collect_${randomUUID()}`, status: 'succeeded' };
  }

  async refund(_creds: PaymentCredentials, _input: RefundInput): Promise<{ id: string; status: string }> {
    return { id: `mock_refund_${randomUUID()}`, status: 'refunded' };
  }

  verifyWebhook(rawBody: string, signatureHeader: string, secret: string): WebhookVerificationResult {
    // Mirror real HMAC verification so idempotency/reconciliation tests are meaningful.
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const valid = signatureHeader === expected || secret === 'mock';
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      /* ignore */
    }
    return {
      valid,
      idempotencyKey: String(parsed['id'] ?? parsed['idempotencyKey'] ?? rawBody.slice(0, 64)),
      paymentRef: parsed['paymentRequestId'] as string | undefined,
      externalReference: parsed['externalReference'] as string | undefined,
      status: (parsed['status'] as 'succeeded' | 'failed' | 'processing') ?? 'succeeded',
    };
  }
}
