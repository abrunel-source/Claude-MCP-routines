import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../app.module';

/**
 * End-to-end happy path (spec §15): compose → send → view → select → accept →
 * sign → upfront pay. Requires a live Postgres (DATABASE_URL); skipped without one.
 */
const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d('proposal lifecycle (e2e)', () => {
  let app: INestApplication;
  const db = new PrismaClient();
  const slug = `e2e-${Date.now()}`;
  let token = '';
  let proposalId = '';
  let publicToken = '';

  beforeAll(async () => {
    // Seed a tenant + owner + library content directly.
    const passwordHash = await argon2.hash('Password123!', { type: argon2.argon2id });
    const plan = await db.plan.upsert({
      where: { tier_interval: { tier: 'starter', interval: 'monthly' } },
      update: {},
      create: { tier: 'starter', name: 'Starter', priceCents: 49900, seatLimit: 3, proposalsPerMonth: 20, clientLimit: 100 },
    });
    const tenant = await db.tenant.create({
      data: {
        name: 'E2E Firm',
        slug,
        supportEmail: 'firm@e2e.test',
        branding: { create: { companyName: 'E2E Firm' } },
        settings: { create: {} },
        subscription: { create: { planId: plan.id, status: 'trialing' } },
      },
    });
    await db.user.create({
      data: {
        email: `owner-${slug}@e2e.test`,
        passwordHash,
        emailVerified: true,
        memberships: { create: { tenantId: tenant.id, role: 'firm_owner' } },
      },
    });
    await db.coverLetter.create({ data: { tenantId: tenant.id, name: 'Welcome', body: 'Hello and welcome.' } });
    await db.termsTemplate.create({ data: { tenantId: tenant.id, name: 'Terms', body: 'Standard terms apply.' } });
    await db.servicePackage.create({
      data: {
        tenantId: tenant.id,
        name: 'Pro Bundle',
        isRecurring: true,
        recurringInterval: 'monthly',
        items: { create: [{ name: 'Bookkeeping', quantity: 1, unitPriceCents: 350000, taxRatePct: 15 }] },
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db.tenant.deleteMany({ where: { slug } });
    await db.$disconnect();
  });

  it('logs in the firm owner', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `owner-${slug}@e2e.test`, password: 'Password123!' })
      .expect(200);
    token = res.body.accessToken;
    expect(token).toBeTruthy();
  });

  it('composes and sends a proposal', async () => {
    const [cover, terms, pkg] = await Promise.all([
      db.coverLetter.findFirstOrThrow({ where: { tenant: { slug } } }),
      db.termsTemplate.findFirstOrThrow({ where: { tenant: { slug } } }),
      db.servicePackage.findFirstOrThrow({ where: { tenant: { slug } } }),
    ]);
    const composed = await request(app.getHttpServer())
      .post('/api/proposals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'E2E Engagement',
        prospectName: 'Prospect Person',
        prospectEmail: 'prospect@e2e.test',
        coverLetterId: cover.id,
        termsTemplateId: terms.id,
        packageIds: [pkg.id],
        upfrontAmountCents: 500000,
      })
      .expect(201);
    proposalId = composed.body.id;

    const sent = await request(app.getHttpServer())
      .post(`/api/proposals/${proposalId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    publicToken = sent.body.link.split('/p/')[1];
    expect(publicToken).toBeTruthy();
  });

  it('drives the public wizard and signs with upfront payment', async () => {
    const view = await request(app.getHttpServer())
      .get(`/api/public/proposals/${publicToken}`)
      .expect(200);
    expect(view.body.options).toHaveLength(1);
    const optionId = view.body.options[0].id;

    await request(app.getHttpServer())
      .post(`/api/public/proposals/${publicToken}/select-package`)
      .send({ optionId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/public/proposals/${publicToken}/accept-terms`)
      .expect(201);

    const signed = await request(app.getHttpServer())
      .post(`/api/public/proposals/${publicToken}/sign`)
      .send({ signerName: 'Prospect Person', signerEmail: 'prospect@e2e.test', signatureData: 'Prospect Person', consent: true })
      .expect(201);

    expect(signed.body.status).toBe('signed');
    expect(signed.body.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.body.paymentUrl).toBeTruthy();

    // Verify persisted state.
    const proposal = await db.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { signature: true, signedDocument: true, events: true },
    });
    expect(proposal.status).toBe('signed');
    expect(proposal.signature?.documentSha256).toBe(signed.body.documentSha256);
    expect(proposal.signedDocument).toBeTruthy();
    expect(proposal.events.some((e) => e.type === 'signed')).toBe(true);
    expect(proposal.viewCount).toBeGreaterThan(0);

    const payment = await db.payment.findFirst({ where: { tenantId: proposal.tenantId } });
    expect(payment?.amountCents).toBe(500000);
    const schedule = await db.billingSchedule.findFirst({ where: { proposalId } });
    expect(schedule).toBeTruthy(); // recurring package -> schedule created
  });
});
