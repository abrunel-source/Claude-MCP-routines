// Mirror of the Prisma enums, kept framework-free so the web app can use them.

export enum Role {
  PlatformAdmin = 'platform_admin',
  FirmOwner = 'firm_owner',
  FirmAdmin = 'firm_admin',
  FirmMember = 'firm_member',
  FirmReadonly = 'firm_readonly',
}

/** Role hierarchy weight — higher can do everything a lower role can. */
export const ROLE_RANK: Record<Role, number> = {
  [Role.PlatformAdmin]: 100,
  [Role.FirmOwner]: 50,
  [Role.FirmAdmin]: 40,
  [Role.FirmMember]: 30,
  [Role.FirmReadonly]: 10,
};

export enum SubscriptionStatus {
  Trialing = 'trialing',
  Active = 'active',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Suspended = 'suspended',
}

export enum PlanTier {
  Starter = 'starter',
  Growth = 'growth',
  Scale = 'scale',
}

export enum BillingInterval {
  Monthly = 'monthly',
  Annual = 'annual',
}

export enum TaxMode {
  Inclusive = 'inclusive',
  Exclusive = 'exclusive',
}

export enum DealStage {
  Lead = 'lead',
  Qualified = 'qualified',
  ProposalSent = 'proposal_sent',
  Won = 'won',
  Lost = 'lost',
}

export enum ProposalStatus {
  Draft = 'draft',
  Sent = 'sent',
  Delivered = 'delivered',
  Viewed = 'viewed',
  PackageSelected = 'package_selected',
  Signed = 'signed',
  Declined = 'declined',
  Expired = 'expired',
}

export enum ProposalEventType {
  Created = 'created',
  Sent = 'sent',
  Delivered = 'delivered',
  FirstViewed = 'first_viewed',
  StepViewed = 'step_viewed',
  PackageSelected = 'package_selected',
  TermsAccepted = 'terms_accepted',
  Signed = 'signed',
  Declined = 'declined',
}

export enum InvoiceKind {
  Full = 'full',
  Partial = 'partial',
  Deposit = 'deposit',
  Progress = 'progress',
  Recurring = 'recurring',
}

export enum InvoiceStatus {
  Draft = 'draft',
  Issued = 'issued',
  Viewed = 'viewed',
  Paid = 'paid',
  PartiallyPaid = 'partially_paid',
  Overdue = 'overdue',
  Void = 'void',
}

export enum PaymentStatus {
  Pending = 'pending',
  Processing = 'processing',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum RecurringInterval {
  Weekly = 'weekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Annual = 'annual',
}
