import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { PAYMENT_PROVIDER } from '@cadence/core';
import { MockPaymentProvider } from '@cadence/adapters';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

/**
 * MANDATORY (spec §12/§15): a duplicate webhook must cause no double effect.
 * Requires a live Postgres (DATABASE_URL); skipped without one.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d('Stitch webhook idempotency', () => {
  const db = new PrismaClient();
  let service: PaymentsService;
  let tenantId = '';
  let paymentId = '';
  const paymentRef = `mock_pay_${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        PrismaService,
        { provide: PAYMENT_PROVIDER, useValue: new MockPaymentProvider() },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
    await moduleRef.get(PrismaService).onModuleInit();

    const tenant = await db.tenant.create({ data: { name: 'WH Firm', slug: `wh-${Date.now()}` } });
    tenantId = tenant.id;
    const payment = await db.payment.create({
      data: { tenantId, amountCents: 500000, status: 'pending', providerRef: paymentRef, externalReference: `${tenantId}|x` },
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    await db.payment.deleteMany({ where: { tenantId } });
    await db.webhookEvent.deleteMany({ where: { idempotencyKey: paymentRef } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it('processes once and ignores the duplicate', async () => {
    const body = JSON.stringify({ id: paymentRef, paymentRequestId: paymentRef, status: 'succeeded' });
    // secret 'mock' makes the mock verifier accept the signature.
    const first = await service.handleStitchWebhook(body, 'irrelevant');
    expect(first).toBe(false); // processed

    const second = await service.handleStitchWebhook(body, 'irrelevant');
    expect(second).toBe(true); // duplicate, no-op

    // Exactly one webhook event; payment settled exactly once.
    const events = await db.webhookEvent.findMany({ where: { idempotencyKey: paymentRef } });
    expect(events).toHaveLength(1);
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('succeeded');
    expect(payment.paidAt).toBeTruthy();
  });
});
