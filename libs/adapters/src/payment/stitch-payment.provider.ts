import { createHmac, timingSafeEqual } from 'node:crypto';
import { STITCH_FIELD_LIMITS } from '@cadence/shared-types';
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

export interface StitchConfig {
  graphqlUrl: string;
  tokenUrl: string;
}

/**
 * StitchPaymentProvider — real adapter against the Stitch GraphQL API
 * (https://api.stitch.money/graphql). Client-credential flow with a signed
 * client assertion (JWKS). Enforces Stitch reference field limits.
 *
 * TODO(production-credentials): the JWKS-signed client assertion and live
 * payment-initiation mutations require real Stitch test/live credentials. Until
 * those are provisioned the system runs on MockPaymentProvider. See docs/HANDOFF.md.
 */
export class StitchPaymentProvider implements PaymentProvider {
  constructor(private readonly config: StitchConfig) {}

  private enforceLimits(input: { payerReference: string; beneficiaryReference: string; externalReference: string }) {
    if (input.payerReference.length > STITCH_FIELD_LIMITS.payerReference) {
      throw new Error(`payerReference exceeds ${STITCH_FIELD_LIMITS.payerReference} chars`);
    }
    if (input.beneficiaryReference.length > STITCH_FIELD_LIMITS.beneficiaryReference) {
      throw new Error(`beneficiaryReference exceeds ${STITCH_FIELD_LIMITS.beneficiaryReference} chars`);
    }
    if (input.externalReference.length > STITCH_FIELD_LIMITS.externalReference) {
      throw new Error(`externalReference exceeds ${STITCH_FIELD_LIMITS.externalReference} chars`);
    }
  }

  private async getClientToken(_creds: PaymentCredentials): Promise<string> {
    // TODO(production-credentials): build signed client assertion (JWKS) and
    // exchange via client-credentials flow at this.config.tokenUrl.
    throw new Error('Stitch client-credentials flow requires production credentials.');
  }

  async createPaymentRequest(
    creds: PaymentCredentials,
    input: CreatePaymentRequestInput,
  ): Promise<PaymentRequestResult> {
    this.enforceLimits(input);
    await this.getClientToken(creds);
    // TODO(production-credentials): execute the Stitch paymentInitiationRequest
    // mutation and return { id, url } from the hosted payment page.
    throw new Error('StitchPaymentProvider.createPaymentRequest not available without credentials.');
  }

  async getPaymentStatus(creds: PaymentCredentials, _paymentRef: string): Promise<PaymentRequestResult> {
    await this.getClientToken(creds);
    throw new Error('StitchPaymentProvider.getPaymentStatus not available without credentials.');
  }

  async createMandate(creds: PaymentCredentials, input: CreateMandateInput): Promise<MandateResult> {
    this.enforceLimits({ ...input, beneficiaryReference: input.payerReference });
    await this.getClientToken(creds);
    throw new Error('StitchPaymentProvider.createMandate not available without credentials.');
  }

  async collect(creds: PaymentCredentials, _input: CollectionInput): Promise<CollectionResult> {
    await this.getClientToken(creds);
    throw new Error('StitchPaymentProvider.collect not available without credentials.');
  }

  async refund(creds: PaymentCredentials, _input: RefundInput): Promise<{ id: string; status: string }> {
    await this.getClientToken(creds);
    throw new Error('StitchPaymentProvider.refund not available without credentials.');
  }

  /** HMAC-SHA256 signature verification — independent of credentials, usable now. */
  verifyWebhook(rawBody: string, signatureHeader: string, secret: string): WebhookVerificationResult {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    let valid = false;
    try {
      const a = Buffer.from(signatureHeader);
      const b = Buffer.from(expected);
      valid = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      valid = false;
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      /* ignore */
    }
    return {
      valid,
      idempotencyKey: String(parsed['id'] ?? rawBody),
      paymentRef: parsed['paymentRequestId'] as string | undefined,
      externalReference: parsed['externalReference'] as string | undefined,
      status: parsed['status'] as 'succeeded' | 'failed' | 'processing' | undefined,
    };
  }
}
