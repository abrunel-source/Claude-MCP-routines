// VAT-aware money maths. All amounts in minor units (cents). South African
// default is tax-inclusive pricing at 15% VAT (see docs/DECISIONS.md).

export type TaxMode = 'inclusive' | 'exclusive';

export interface LineItemLike {
  quantity: number;
  unitPriceCents: number;
  taxRatePct: number; // e.g. 15
  taxMode: TaxMode;
}

export interface TaxBreakdown {
  subtotalCents: number; // ex-VAT
  taxCents: number;
  totalCents: number; // inc-VAT
}

/** Round half-up to nearest cent. */
function round(n: number): number {
  return Math.round(n);
}

/** Compute the ex-VAT, VAT and inc-VAT totals for a single line. */
export function lineTax(item: LineItemLike): TaxBreakdown {
  const gross = item.quantity * item.unitPriceCents;
  const rate = item.taxRatePct / 100;

  if (item.taxMode === 'inclusive') {
    // gross already includes VAT
    const subtotal = round(gross / (1 + rate));
    const tax = gross - subtotal;
    return { subtotalCents: subtotal, taxCents: tax, totalCents: gross };
  }

  // exclusive: gross is ex-VAT
  const tax = round(gross * rate);
  return { subtotalCents: gross, taxCents: tax, totalCents: gross + tax };
}

/** Sum a set of lines into an invoice-level breakdown. */
export function totalsFor(items: LineItemLike[]): TaxBreakdown {
  return items.reduce<TaxBreakdown>(
    (acc, item) => {
      const t = lineTax(item);
      return {
        subtotalCents: acc.subtotalCents + t.subtotalCents,
        taxCents: acc.taxCents + t.taxCents,
        totalCents: acc.totalCents + t.totalCents,
      };
    },
    { subtotalCents: 0, taxCents: 0, totalCents: 0 },
  );
}

/** Format minor units as a localised currency string (en-ZA). */
export function formatMoney(amountCents: number, currency = 'ZAR'): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(
    amountCents / 100,
  );
}
