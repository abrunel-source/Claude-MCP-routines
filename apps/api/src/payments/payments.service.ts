import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PAYMENT_PROVIDER } from '@cadence/core';
import type { PaymentProvider } from '@cadence/core';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Verify, deduplicate and reconcile a Stitch webhook.
   * @returns true if the event was a duplicate (no effect), false if processed.
   */
  async handleStitchWebhook(rawBody: string, signature: string): Promise<boolean> {
    const result = this.provider.verifyWebhook(rawBody, signature, env.stitch.webhookSecret);
    if (!result.valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency: unique idempotencyKey. A second delivery is a no-op.
    const existing = await this.prisma.raw.webhookEvent.findUnique({
      where: { idempotencyKey: result.idempotencyKey },
    });
    if (existing?.processedAt) {
      return true; // duplicate — already processed, no double effect
    }
    if (!existing) {
      await this.prisma.raw.webhookEvent.create({
        data: {
          source: 'stitch',
          idempotencyKey: result.idempotencyKey,
          payload: safeJson(rawBody),
        },
      });
    }

    // Reconcile the payment by provider ref or externalReference.
    const payment = await this.findPayment(result.paymentRef, result.externalReference);
    if (payment) {
      const status = result.status === 'failed' ? 'failed' : 'succeeded';
      await this.prisma.raw.payment.update({
        where: { id: payment.id },
        data: { status, paidAt: status === 'succeeded' ? new Date() : null },
      });
      if (status === 'succeeded' && payment.invoiceId) {
        await this.prisma.raw.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: 'paid', paidAt: new Date(), amountPaidCents: payment.amountCents },
        });
      }
    }

    await this.prisma.raw.webhookEvent.update({
      where: { idempotencyKey: result.idempotencyKey },
      data: { processedAt: new Date() },
    });
    return false;
  }

  private async findPayment(providerRef?: string, externalReference?: string) {
    if (providerRef) {
      const byRef = await this.prisma.raw.payment.findFirst({ where: { providerRef } });
      if (byRef) return byRef;
    }
    if (externalReference) {
      return this.prisma.raw.payment.findFirst({ where: { externalReference } });
    }
    return null;
  }
}

function safeJson(raw: string): object {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}
