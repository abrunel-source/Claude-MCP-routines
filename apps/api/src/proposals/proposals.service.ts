import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NOTIFICATION_SERVICE,
  DOCUMENT_SERVICE,
  STORAGE_SERVICE,
  PAYMENT_PROVIDER,
} from '@cadence/core';
import type {
  NotificationService,
  DocumentService,
  StorageService,
  PaymentProvider,
} from '@cadence/core';
import { ProposalStatus } from '@cadence/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { generateToken, hashToken } from '../common/crypto.util';
import { env } from '../config/env';
import { ComposeProposalDto, SignDto } from './proposals.dto';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_SERVICE) private readonly notify: NotificationService,
    @Inject(DOCUMENT_SERVICE) private readonly docs: DocumentService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  // --- Firm side: compose ---------------------------------------------------
  async compose(tenantId: string, dto: ComposeProposalDto) {
    const [cover, terms, packages] = await Promise.all([
      this.db.coverLetter.findFirst({ where: { id: dto.coverLetterId } }),
      this.db.termsTemplate.findFirst({ where: { id: dto.termsTemplateId } }),
      this.db.servicePackage.findMany({
        where: { id: { in: dto.packageIds } },
        include: { items: { orderBy: { position: 'asc' } } },
      }),
    ]);
    if (!cover) throw new BadRequestException('Cover letter not found');
    if (!terms) throw new BadRequestException('Terms template not found');
    if (packages.length === 0) throw new BadRequestException('No packages found');

    const count = await this.db.proposal.count();
    const number = `PROP-${String(count + 1).padStart(4, '0')}`;

    return this.db.proposal.create({
      // tenantId injected by the tenant-scope extension at runtime
      data: {
        dealId: dto.dealId,
        number,
        title: dto.title,
        status: 'draft',
        prospectName: dto.prospectName,
        prospectEmail: dto.prospectEmail.toLowerCase(),
        coverLetterBody: cover.body,
        termsBody: terms.body,
        upfrontAmountCents: dto.upfrontAmountCents ?? 0,
        publicTokenHash: hashToken(generateToken()), // placeholder until sent
        packageOptions: {
          create: packages.map((p, i) => ({
            sourcePackageId: p.id,
            name: p.name,
            description: p.description,
            isRecurring: p.isRecurring,
            recurringInterval: p.recurringInterval,
            position: i,
            lineItems: {
              create: p.items.map((it, j) => ({
                name: it.name,
                description: it.description,
                quantity: it.quantity,
                unitPriceCents: it.unitPriceCents,
                taxMode: it.taxMode,
                taxRatePct: it.taxRatePct,
                position: j,
              })),
            },
          })),
        },
        events: { create: { type: 'created' } },
      } as never,
      include: { packageOptions: { include: { lineItems: true } } },
    });
  }

  // --- Firm side: send (issues the unique signed link) ---------------------
  async send(tenantId: string, id: string): Promise<{ link: string }> {
    const proposal = await this.db.proposal.findFirst({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    const rawToken = generateToken();
    await this.db.proposal.updateMany({
      where: { id },
      data: {
        publicTokenHash: hashToken(rawToken),
        status: 'sent',
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    await this.db.proposalEvent.create({ data: { proposalId: id, type: 'sent' } });

    const link = `${env.apiBaseUrl.replace(/\/$/, '')}/p/${rawToken}`;
    await this.notify.send({
      to: proposal.prospectEmail,
      template: 'proposal_sent',
      subject: `Your proposal from ${proposal.title}`,
      html: `<p>Hi ${proposal.prospectName},</p><p>Your proposal is ready.</p><p><a href="${link}">View &amp; sign your proposal</a></p>`,
      tenantId,
    });
    return { link };
  }

  list() {
    return this.db.proposal.findMany({
      orderBy: { createdAt: 'desc' },
      include: { packageOptions: true },
    });
  }

  async get(id: string) {
    const p = await this.db.proposal.findFirst({
      where: { id },
      include: {
        packageOptions: { include: { lineItems: { orderBy: { position: 'asc' } } } },
        events: { orderBy: { occurredAt: 'asc' } },
        signature: true,
        signedDocument: true,
      },
    });
    if (!p) throw new NotFoundException();
    return p;
  }

  // --- Public wizard (token-based, no auth) --------------------------------
  private async byToken(rawToken: string) {
    const p = await this.prisma.raw.proposal.findUnique({
      where: { publicTokenHash: hashToken(rawToken) },
      include: {
        packageOptions: { include: { lineItems: { orderBy: { position: 'asc' } } } },
        tenant: { include: { branding: true } },
      },
    });
    if (!p) throw new NotFoundException('Proposal not found');
    if (p.expiresAt && p.expiresAt < new Date() && p.status !== 'signed') {
      throw new ForbiddenException('This proposal link has expired');
    }
    return p;
  }

  async viewPublic(rawToken: string, ip?: string, ua?: string) {
    const p = await this.byToken(rawToken);
    const isFirstView = !p.firstViewedAt;
    await this.prisma.raw.proposal.update({
      where: { id: p.id },
      data: {
        viewCount: { increment: 1 },
        firstViewedAt: p.firstViewedAt ?? new Date(),
        status: p.status === 'sent' || p.status === 'delivered' ? 'viewed' : p.status,
      },
    });
    await this.prisma.raw.proposalEvent.create({
      data: { proposalId: p.id, type: isFirstView ? 'first_viewed' : 'step_viewed', ipAddress: ip, userAgent: ua },
    });
    return {
      number: p.number,
      title: p.title,
      status: p.status,
      coverLetterBody: p.coverLetterBody,
      termsBody: p.termsBody,
      currency: p.currency,
      upfrontAmountCents: p.upfrontAmountCents,
      selectedOptionId: p.selectedOptionId,
      options: p.packageOptions.map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description,
        isRecurring: o.isRecurring,
        lineItems: o.lineItems.map((li) => ({
          name: li.name,
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
        })),
      })),
      branding: {
        companyName: p.tenant.branding?.companyName ?? p.tenant.name,
        primaryColor: p.tenant.branding?.primaryColor ?? '#1f6feb',
        secondaryColor: p.tenant.branding?.secondaryColor ?? '#0b3d91',
        logoUrl: p.tenant.branding?.logoUrl ?? null,
      },
    };
  }

  async selectPackage(rawToken: string, optionId: string) {
    const p = await this.byToken(rawToken);
    const option = p.packageOptions.find((o) => o.id === optionId);
    if (!option) throw new BadRequestException('Invalid package option');
    await this.prisma.raw.proposal.update({
      where: { id: p.id },
      data: { selectedOptionId: optionId, status: 'package_selected' },
    });
    await this.prisma.raw.proposalEvent.create({
      data: { proposalId: p.id, type: 'package_selected' },
    });
    return { ok: true };
  }

  async acceptTerms(rawToken: string) {
    const p = await this.byToken(rawToken);
    await this.prisma.raw.proposalEvent.create({
      data: { proposalId: p.id, type: 'terms_accepted' },
    });
    return { ok: true };
  }

  // --- Sign + capture upfront/recurring ------------------------------------
  async sign(rawToken: string, dto: SignDto, ip?: string, ua?: string) {
    if (!dto.consent) throw new BadRequestException('Consent is required to sign');
    const p = await this.byToken(rawToken);
    if (p.status === 'signed') throw new BadRequestException('Already signed');

    const option =
      p.packageOptions.find((o) => o.id === p.selectedOptionId) ??
      (p.packageOptions.length === 1 ? p.packageOptions[0] : undefined);
    if (!option) throw new BadRequestException('A package must be selected before signing');

    const signedAt = new Date();
    const signedAtIso = signedAt.toISOString();

    // Render the immutable signed PDF and hash its bytes (ECTA audit trail).
    const pdf = await this.docs.renderSignedProposal({
      tenantName: p.tenant.branding?.companyName ?? p.tenant.name,
      proposalNumber: p.number,
      prospectName: p.prospectName,
      coverLetterBody: p.coverLetterBody,
      selectedPackageName: option.name,
      lineItems: option.lineItems.map((li) => ({
        name: li.name,
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
      })),
      termsBody: p.termsBody,
      signerName: dto.signerName,
      signedAtIso,
      currency: p.currency,
    });
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    const storageKey = `tenants/${p.tenantId}/proposals/${p.id}/signed-${sha256.slice(0, 12)}.pdf`;
    await this.storage.put({ key: storageKey, body: pdf, contentType: 'application/pdf' });

    await this.prisma.raw.$transaction([
      this.prisma.raw.signatureEvent.create({
        data: {
          proposalId: p.id,
          signerName: dto.signerName,
          signerEmail: dto.signerEmail.toLowerCase(),
          method: dto.method ?? 'typed',
          signatureData: dto.signatureData,
          ipAddress: ip,
          userAgent: ua,
          documentSha256: sha256,
          consent: dto.consent,
          signedAt,
        },
      }),
      this.prisma.raw.signedDocument.create({
        data: { proposalId: p.id, storageKey, sha256 },
      }),
      this.prisma.raw.proposal.update({
        where: { id: p.id },
        data: { status: 'signed', signedAt, selectedOptionId: option.id },
      }),
      this.prisma.raw.proposalEvent.create({
        data: { proposalId: p.id, type: 'signed', ipAddress: ip, userAgent: ua },
      }),
    ]);

    // Capture upfront payment (hosted page) + recurring mandate via the port.
    const creds = { clientId: 'mock', clientSecret: 'mock' };
    let paymentUrl: string | undefined;
    if (p.upfrontAmountCents > 0) {
      const externalReference = `${p.tenantId}|${p.id}`;
      const pay = await this.payments.createPaymentRequest(creds, {
        amountCents: p.upfrontAmountCents,
        currency: p.currency,
        externalReference,
        payerReference: p.number.replace('-', '').slice(0, 12),
        beneficiaryReference: p.number.slice(0, 20),
        payerName: dto.signerName,
        payerEmail: dto.signerEmail,
        redirectUrl: `${env.apiBaseUrl}/p/${rawToken}/done`,
      });
      paymentUrl = pay.url;
      await this.prisma.raw.payment.create({
        data: {
          tenantId: p.tenantId,
          amountCents: p.upfrontAmountCents,
          currency: p.currency,
          status: 'pending',
          providerRef: pay.id,
          providerUrl: pay.url,
          externalReference,
          method: 'pay_by_bank',
        },
      });
    }

    if (option.isRecurring) {
      const mandate = await this.payments.createMandate(creds, {
        amountCents: option.lineItems.reduce((s, li) => s + li.quantity * li.unitPriceCents, 0),
        currency: p.currency,
        payerName: dto.signerName,
        payerReference: p.number.replace('-', '').slice(0, 12),
        externalReference: `${p.tenantId}|${p.id}`,
      });
      const cm = await this.prisma.raw.clientPaymentMandate.create({
        data: {
          tenantId: p.tenantId,
          proposalId: p.id,
          status: mandate.status === 'active' ? 'active' : 'pending',
          providerRef: mandate.id,
          payerName: dto.signerName,
          payerReference: p.number.replace('-', '').slice(0, 12),
        },
      });
      await this.prisma.raw.billingSchedule.create({
        data: {
          tenantId: p.tenantId,
          proposalId: p.id,
          mandateId: cm.id,
          amountCents: option.lineItems.reduce((s, li) => s + li.quantity * li.unitPriceCents, 0),
          currency: p.currency,
          interval: (option.recurringInterval ?? 'monthly') as never,
          nextRunAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
    }

    // Email the immutable signed PDF to both parties.
    const firmEmail = p.tenant.supportEmail ?? p.tenant.branding?.supportEmail ?? undefined;
    await this.notify.send({
      to: dto.signerEmail,
      template: 'proposal_signed',
      subject: `Signed: ${p.title}`,
      html: `<p>Thank you, ${dto.signerName}. Your signed engagement letter is attached.</p>`,
      tenantId: p.tenantId,
      attachments: [{ filename: `${p.number}-signed.pdf`, content: pdf }],
    });
    if (firmEmail) {
      await this.notify.send({
        to: firmEmail,
        template: 'proposal_signed',
        subject: `${p.prospectName} signed ${p.number}`,
        html: `<p>${p.prospectName} has signed ${p.title}.</p>`,
        tenantId: p.tenantId,
        attachments: [{ filename: `${p.number}-signed.pdf`, content: pdf }],
      });
    }

    return { status: ProposalStatus.Signed, documentSha256: sha256, paymentUrl };
  }
}
