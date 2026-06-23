/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// Seeds a demo tenant ("Demo Advisory") with services, a package, a client,
// a deal and a sample proposal, plus a platform admin and the plan catalogue,
// so the product is immediately demoable. Idempotent on slug/email.
const db = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await argon2.hash('Password123!', { type: argon2.argon2id });

  // --- Plan catalogue (Layer A) -------------------------------------------
  const plans = [
    { tier: 'starter' as const, name: 'Starter', priceCents: 49900, seatLimit: 3, proposalsPerMonth: 20, clientLimit: 100 },
    { tier: 'growth' as const, name: 'Growth', priceCents: 99900, seatLimit: 10, proposalsPerMonth: 100, clientLimit: 1000 },
    { tier: 'scale' as const, name: 'Scale', priceCents: 199900, seatLimit: 50, proposalsPerMonth: 1000, clientLimit: 10000 },
  ];
  for (const p of plans) {
    await db.plan.upsert({
      where: { tier_interval: { tier: p.tier, interval: 'monthly' } },
      update: {},
      create: { ...p, annualDiscountPct: 17 },
    });
  }
  const starter = await db.plan.findFirstOrThrow({ where: { tier: 'starter', interval: 'monthly' } });

  // --- Platform admin (Brunel) --------------------------------------------
  await db.user.upsert({
    where: { email: 'admin@brunelstudios.com' },
    update: { isPlatformAdmin: true },
    create: { email: 'admin@brunelstudios.com', passwordHash, isPlatformAdmin: true, emailVerified: true, firstName: 'Platform', lastName: 'Admin' },
  });

  // --- Demo tenant ---------------------------------------------------------
  const existing = await db.tenant.findUnique({ where: { slug: 'demo' } });
  if (existing) {
    console.log('Demo tenant already seeded.');
    return;
  }

  const tenant = await db.tenant.create({
    data: {
      name: 'Demo Advisory',
      slug: 'demo',
      supportEmail: 'hello@demo-advisory.co.za',
      branding: { create: { companyName: 'Demo Advisory', primaryColor: '#0b7285', secondaryColor: '#155e63' } },
      settings: { create: { resendFromEmail: 'hello@demo-advisory.co.za' } },
      taxRates: { create: { name: 'VAT', ratePct: 15, isDefault: true } },
      subscription: {
        create: { planId: starter.id, status: 'trialing', trialEndsAt: new Date(Date.now() + 14 * 86_400_000) },
      },
    },
  });

  await db.user.create({
    data: {
      email: 'owner@demo-advisory.co.za',
      passwordHash,
      firstName: 'Thandi',
      lastName: 'Nkosi',
      emailVerified: true,
      memberships: { create: { tenantId: tenant.id, role: 'firm_owner' } },
    },
  });

  // --- Services catalogue --------------------------------------------------
  const bookkeeping = await db.service.create({
    data: { tenantId: tenant.id, name: 'Monthly Bookkeeping', pricingType: 'recurring', recurringInterval: 'monthly', defaultPriceCents: 350000, taxMode: 'inclusive', taxRatePct: 15 },
  });
  const taxReturn = await db.service.create({
    data: { tenantId: tenant.id, name: 'Annual Tax Return', pricingType: 'fixed', defaultPriceCents: 850000, taxMode: 'inclusive', taxRatePct: 15 },
  });
  const onboarding = await db.service.create({
    data: { tenantId: tenant.id, name: 'Onboarding & Setup', pricingType: 'fixed', defaultPriceCents: 500000, taxMode: 'inclusive', taxRatePct: 15 },
  });

  // --- Service package -----------------------------------------------------
  const pkg = await db.servicePackage.create({
    data: {
      tenantId: tenant.id,
      name: 'Growth Bundle',
      description: 'Monthly bookkeeping, annual tax and onboarding.',
      isRecurring: true,
      recurringInterval: 'monthly',
      items: {
        create: [
          { serviceId: bookkeeping.id, name: bookkeeping.name, quantity: 1, unitPriceCents: 350000, taxRatePct: 15 },
          { serviceId: taxReturn.id, name: taxReturn.name, quantity: 1, unitPriceCents: 850000, taxRatePct: 15 },
          { serviceId: onboarding.id, name: onboarding.name, quantity: 1, unitPriceCents: 500000, taxRatePct: 15 },
        ],
      },
    },
  });

  // --- Library content -----------------------------------------------------
  await db.coverLetter.create({
    data: { tenantId: tenant.id, name: 'Standard Welcome', body: 'Thank you for considering Demo Advisory. We are delighted to present this proposal for your accounting and advisory needs.' },
  });
  const terms = await db.termsTemplate.create({
    data: { tenantId: tenant.id, name: 'Standard Engagement Terms', body: 'These terms govern the engagement between Demo Advisory and the client, subject to South African law. Fees are quoted in ZAR and include VAT at 15% where applicable.' },
  });

  // --- CRM: organization, contact, deal ------------------------------------
  const org = await db.organization.create({
    data: { tenantId: tenant.id, name: 'Acme Trading (Pty) Ltd', vatNumber: '4123456789' },
  });
  const contact = await db.contact.create({
    data: { tenantId: tenant.id, organizationId: org.id, firstName: 'Sipho', lastName: 'Dlamini', email: 'sipho@acmetrading.co.za', phone: '+27 82 555 0100' },
  });
  const deal = await db.deal.create({
    data: { tenantId: tenant.id, organizationId: org.id, contactId: contact.id, title: 'Acme Trading — annual engagement', stage: 'proposal_sent', valueCents: 1700000 },
  });

  // --- Sample proposal -----------------------------------------------------
  await db.proposal.create({
    data: {
      tenantId: tenant.id,
      dealId: deal.id,
      number: 'PROP-0001',
      title: 'Acme Trading — Growth Bundle',
      status: 'sent',
      prospectName: 'Sipho Dlamini',
      prospectEmail: 'sipho@acmetrading.co.za',
      coverLetterBody: 'Thank you for considering Demo Advisory.',
      termsBody: terms.body,
      publicTokenHash: 'seed-demo-proposal-token-hash',
      sentAt: new Date(),
      upfrontAmountCents: 500000,
      packageOptions: {
        create: {
          sourcePackageId: pkg.id,
          name: pkg.name,
          isRecurring: true,
          recurringInterval: 'monthly',
          lineItems: {
            create: [
              { name: 'Monthly Bookkeeping', quantity: 1, unitPriceCents: 350000, taxRatePct: 15 },
              { name: 'Annual Tax Return', quantity: 1, unitPriceCents: 850000, taxRatePct: 15 },
              { name: 'Onboarding & Setup', quantity: 1, unitPriceCents: 500000, taxRatePct: 15 },
            ],
          },
        },
      },
      events: { create: { type: 'sent' } },
    },
  });

  console.log('Seeded demo tenant "demo" (owner@demo-advisory.co.za / Password123!).');
  console.log('Platform admin: admin@brunelstudios.com / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
