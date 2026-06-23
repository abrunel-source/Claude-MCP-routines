import { Role, PlanTier } from './enums';

// --- Auth -------------------------------------------------------------------
export interface SignupRequest {
  companyName: string;
  slug: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  planTier?: PlanTier;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  // refreshToken is delivered via httpOnly cookie, not in the body
  expiresIn: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  tenantId?: string;
  role?: Role;
}

export interface InviteRequest {
  email: string;
  role: Role;
}

// --- Money ------------------------------------------------------------------
export interface Money {
  amountCents: number;
  currency: string;
}

// --- Tenant context ---------------------------------------------------------
export interface TenantContext {
  tenantId: string;
  slug: string;
  brandingPrimaryColor: string;
  brandingSecondaryColor: string;
  companyName: string;
  logoUrl?: string | null;
}

// --- Health -----------------------------------------------------------------
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  checks: Record<string, 'ok' | 'fail' | 'skipped'>;
}
