import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NOTIFICATION_SERVICE } from '@cadence/core';
import type { NotificationService } from '@cadence/core';
import { Role, PlanTier, DEFAULT_VAT_RATE, DEFAULT_TRIAL_DAYS } from '@cadence/shared-types';
import type { AuthTokens } from '@cadence/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { hashPassword, verifyPassword } from './password.util';
import { generateToken, hashToken } from '../common/crypto.util';
import { SignupDto, LoginDto } from './auth.dto';
import type { JwtPayload } from './jwt.strategy';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(NOTIFICATION_SERVICE) private readonly notify: NotificationService,
  ) {}

  // --- Signup: creates tenant + owner + trial subscription -----------------
  async signup(dto: SignupDto): Promise<{ tokens: AuthTokens; refreshToken: string; tenantSlug: string }> {
    const db = this.prisma.raw; // bootstrap path: explicit tenantId, unscoped

    if (await db.user.findUnique({ where: { email: dto.email.toLowerCase() } })) {
      throw new ConflictException('Email already registered');
    }
    if (await db.tenant.findUnique({ where: { slug: dto.slug } })) {
      throw new ConflictException('Workspace slug already taken');
    }

    const plan = await this.ensurePlan(dto.planTier ?? PlanTier.Starter);
    const passwordHash = await hashPassword(dto.password);

    const { user, tenant } = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug: dto.slug,
          branding: {
            create: { companyName: dto.companyName },
          },
          settings: { create: {} },
          taxRates: {
            create: { name: 'VAT', ratePct: DEFAULT_VAT_RATE, isDefault: true },
          },
          subscription: {
            create: {
              planId: plan.id,
              status: 'trialing',
              trialEndsAt: new Date(Date.now() + DEFAULT_TRIAL_DAYS * 86_400_000),
            },
          },
        },
      });
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          memberships: { create: { tenantId: tenant.id, role: Role.FirmOwner } },
        },
      });
      return { user, tenant };
    });

    await this.sendEmailVerification(user.id, user.email, tenant.id);
    const { tokens, refreshToken } = await this.issueTokens(user.id, user.email, false, tenant.id, Role.FirmOwner);
    return { tokens, refreshToken, tenantSlug: tenant.slug };
  }

  /**
   * Passwordless session for demo deployments. Issues tokens for the platform
   * admin (or any seeded user) without verifying a password — deliberately
   * skips argon2 so the demo works regardless of native-module availability.
   */
  async demoLogin(): Promise<{ tokens: AuthTokens; refreshToken: string }> {
    const user =
      (await this.prisma.raw.user.findFirst({
        where: { isPlatformAdmin: true },
        include: { memberships: true },
      })) ?? (await this.prisma.raw.user.findFirst({ include: { memberships: true } }));
    if (!user) {
      throw new UnauthorizedException('No users available for demo login');
    }
    const membership = user.memberships[0];
    return this.issueTokens(
      user.id,
      user.email,
      user.isPlatformAdmin,
      membership?.tenantId,
      membership?.role as Role | undefined,
    );
  }

  // --- Login ---------------------------------------------------------------
  async login(dto: LoginDto): Promise<{ tokens: AuthTokens; refreshToken: string }> {
    const user = await this.prisma.raw.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { memberships: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }
    const ok = await verifyPassword(user.passwordHash, dto.password);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.raw.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil:
            failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.raw.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const membership = user.memberships[0];
    return this.issueTokens(
      user.id,
      user.email,
      user.isPlatformAdmin,
      membership?.tenantId,
      membership?.role as Role | undefined,
    );
  }

  // --- Refresh (rotating, with reuse detection) ----------------------------
  async refresh(rawToken: string): Promise<{ tokens: AuthTokens; refreshToken: string }> {
    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.raw.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { memberships: true } } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.revokedAt) {
      // Reuse of a revoked token → compromise; revoke the whole family.
      await this.prisma.raw.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    await this.prisma.raw.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const membership = stored.user.memberships[0];
    return this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.user.isPlatformAdmin,
      membership?.tenantId,
      membership?.role as Role | undefined,
      stored.family,
    );
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    await this.prisma.raw.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // --- Email verification --------------------------------------------------
  async sendEmailVerification(userId: string, email: string, tenantId?: string): Promise<void> {
    const raw = generateToken();
    await this.prisma.raw.emailVerification.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const link = `${env.apiBaseUrl}/api/auth/verify-email?token=${raw}`;
    await this.notify.send({
      to: email,
      template: 'email_verification',
      subject: 'Verify your email',
      html: `<p>Welcome to Cadence. Confirm your email:</p><p><a href="${link}">Verify email</a></p>`,
      tenantId,
    });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const rec = await this.prisma.raw.emailVerification.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!rec || rec.consumedAt || rec.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    await this.prisma.raw.$transaction([
      this.prisma.raw.emailVerification.update({
        where: { id: rec.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.raw.user.update({ where: { id: rec.userId }, data: { emailVerified: true } }),
    ]);
  }

  // --- Password reset ------------------------------------------------------
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.raw.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return; // do not reveal existence
    const raw = generateToken();
    await this.prisma.raw.passwordReset.create({
      data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const link = `${env.apiBaseUrl}/api/auth/reset-password?token=${raw}`;
    await this.notify.send({
      to: user.email,
      template: 'password_reset',
      subject: 'Reset your password',
      html: `<p>Reset your password:</p><p><a href="${link}">Choose a new password</a></p>`,
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const rec = await this.prisma.raw.passwordReset.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!rec || rec.consumedAt || rec.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.raw.$transaction([
      this.prisma.raw.passwordReset.update({ where: { id: rec.id }, data: { consumedAt: new Date() } }),
      this.prisma.raw.user.update({ where: { id: rec.userId }, data: { passwordHash } }),
      // Revoke all sessions on password change.
      this.prisma.raw.refreshToken.updateMany({
        where: { userId: rec.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // --- Invitations ---------------------------------------------------------
  async invite(tenantId: string, email: string, role: Role): Promise<void> {
    const raw = generateToken();
    await this.prisma.raw.invitation.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        role,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    const link = `${env.apiBaseUrl}/api/auth/accept-invite?token=${raw}`;
    await this.notify.send({
      to: email,
      template: 'team_invitation',
      subject: 'You have been invited to Cadence',
      html: `<p>Join the workspace:</p><p><a href="${link}">Accept invitation</a></p>`,
      tenantId,
    });
  }

  async acceptInvite(
    rawToken: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ): Promise<{ tokens: AuthTokens; refreshToken: string }> {
    const inv = await this.prisma.raw.invitation.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    const passwordHash = await hashPassword(password);
    const user = await this.prisma.raw.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: inv.email } });
      if (!user) {
        user = await tx.user.create({
          data: { email: inv.email, passwordHash, firstName, lastName, emailVerified: true },
        });
      }
      await tx.membership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: inv.tenantId } },
        create: { userId: user.id, tenantId: inv.tenantId, role: inv.role },
        update: { role: inv.role },
      });
      await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
      return user;
    });
    return this.issueTokens(user.id, user.email, false, inv.tenantId, inv.role as Role);
  }

  // --- Helpers -------------------------------------------------------------
  private async ensurePlan(tier: PlanTier) {
    const existing = await this.prisma.raw.plan.findFirst({ where: { tier, interval: 'monthly' } });
    if (existing) return existing;
    const prices: Record<PlanTier, number> = {
      [PlanTier.Starter]: 49900,
      [PlanTier.Growth]: 99900,
      [PlanTier.Scale]: 199900,
    };
    const limits: Record<PlanTier, { seat: number; proposals: number; clients: number }> = {
      [PlanTier.Starter]: { seat: 3, proposals: 20, clients: 100 },
      [PlanTier.Growth]: { seat: 10, proposals: 100, clients: 1000 },
      [PlanTier.Scale]: { seat: 50, proposals: 1000, clients: 10000 },
    };
    return this.prisma.raw.plan.create({
      data: {
        tier,
        name: `${tier[0].toUpperCase()}${tier.slice(1)}`,
        priceCents: prices[tier],
        seatLimit: limits[tier].seat,
        proposalsPerMonth: limits[tier].proposals,
        clientLimit: limits[tier].clients,
      },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    isPlatformAdmin: boolean,
    tenantId?: string,
    role?: Role,
    family?: string,
  ): Promise<{ tokens: AuthTokens; refreshToken: string }> {
    const payload: JwtPayload = { sub: userId, email, isPlatformAdmin, tenantId, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.jwt.accessSecret(),
      expiresIn: env.jwt.accessTtl,
    });
    const rawRefresh = generateToken();
    await this.prisma.raw.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawRefresh),
        family: family ?? generateToken(8),
        expiresAt: new Date(Date.now() + env.jwt.refreshTtl * 1000),
      },
    });
    return {
      tokens: { accessToken, expiresIn: env.jwt.accessTtl },
      refreshToken: rawRefresh,
    };
  }
}
