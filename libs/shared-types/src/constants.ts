// Commercial defaults for the South African market (see docs/DECISIONS.md).

export const DEFAULT_CURRENCY = 'ZAR';
export const DEFAULT_VAT_RATE = 15; // percent
export const DEFAULT_TRIAL_DAYS = 14;

/** Stitch reference field limits — enforce in validation and adapters. */
export const STITCH_FIELD_LIMITS = {
  payerReference: 12,
  beneficiaryReference: 20,
  beneficiaryName: 20,
  externalReference: 4096,
} as const;

/** The five steps of the prospect proposal wizard (section 10). */
export enum ProposalWizardStep {
  CoverLetter = 1,
  Packages = 2,
  Terms = 3,
  Signature = 4,
  Confirmation = 5,
}
