import { lineTax, totalsFor, formatMoney } from './tax';

describe('VAT money maths (ZAR, 15%)', () => {
  it('splits a tax-inclusive line into ex-VAT + VAT', () => {
    // R115.00 inclusive @ 15% -> R100.00 ex + R15.00 VAT
    const t = lineTax({ quantity: 1, unitPriceCents: 11500, taxRatePct: 15, taxMode: 'inclusive' });
    expect(t.subtotalCents).toBe(10000);
    expect(t.taxCents).toBe(1500);
    expect(t.totalCents).toBe(11500);
  });

  it('adds VAT on a tax-exclusive line', () => {
    const t = lineTax({ quantity: 2, unitPriceCents: 5000, taxRatePct: 15, taxMode: 'exclusive' });
    expect(t.subtotalCents).toBe(10000);
    expect(t.taxCents).toBe(1500);
    expect(t.totalCents).toBe(11500);
  });

  it('sums mixed lines into an invoice total', () => {
    const total = totalsFor([
      { quantity: 1, unitPriceCents: 11500, taxRatePct: 15, taxMode: 'inclusive' },
      { quantity: 1, unitPriceCents: 10000, taxRatePct: 15, taxMode: 'exclusive' },
    ]);
    expect(total.subtotalCents).toBe(20000);
    expect(total.taxCents).toBe(3000);
    expect(total.totalCents).toBe(23000);
  });

  it('formats ZAR', () => {
    expect(formatMoney(11500).replace(/ /g, ' ')).toContain('115');
  });
});
