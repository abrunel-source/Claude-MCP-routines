import type {
  DocumentService,
  SignedProposalDocInput,
  InvoiceDocInput,
} from '@cadence/core';
import { formatMoney } from '@cadence/core';

/**
 * PdfmakeDocumentService — pure-JS, serverless-safe PDF generation via pdfmake's
 * PdfPrinter using the built-in standard fonts (no font files to bundle). The
 * SDK is imported dynamically so the workspace builds without it installed.
 * A headless-Chromium renderer can replace this behind the same port later.
 */
export class PdfmakeDocumentService implements DocumentService {
  private async printer(): Promise<any> {
    const PdfPrinter = (await import('pdfmake' as any)).default ?? (await import('pdfmake' as any));
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    return new PdfPrinter(fonts);
  }

  private async toBuffer(docDef: any): Promise<Buffer> {
    const printer = await this.printer();
    const pdfDoc = printer.createPdfKitDocument({ defaultStyle: { font: 'Helvetica' }, ...docDef });
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (c: Buffer) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  async renderSignedProposal(input: SignedProposalDocInput): Promise<Buffer> {
    const rows = input.lineItems.map((li) => [
      li.name,
      String(li.quantity),
      formatMoney(li.unitPriceCents, input.currency),
    ]);
    return this.toBuffer({
      content: [
        { text: input.tenantName, style: 'h1' },
        { text: `Engagement letter — ${input.proposalNumber}`, style: 'h2', margin: [0, 4, 0, 12] },
        { text: input.coverLetterBody, margin: [0, 0, 0, 12] },
        { text: `Selected package: ${input.selectedPackageName}`, style: 'h3' },
        {
          table: { widths: ['*', 'auto', 'auto'], body: [['Item', 'Qty', 'Price'], ...rows] },
          margin: [0, 6, 0, 12],
        },
        { text: 'Terms & Conditions', style: 'h3' },
        { text: input.termsBody, fontSize: 9, margin: [0, 0, 0, 16] },
        { text: `Signed by ${input.signerName} on ${input.signedAtIso} (UTC).`, italics: true },
      ],
      styles: {
        h1: { fontSize: 20, bold: true },
        h2: { fontSize: 14, bold: true },
        h3: { fontSize: 12, bold: true, margin: [0, 8, 0, 4] },
      },
    });
  }

  async renderInvoice(input: InvoiceDocInput): Promise<Buffer> {
    const rows = input.lineItems.map((li) => [
      li.name,
      String(li.quantity),
      `${li.taxRatePct}%`,
      formatMoney(li.unitPriceCents, input.currency),
    ]);
    return this.toBuffer({
      content: [
        { text: input.tenantName, style: 'h1' },
        { text: `Tax invoice — ${input.invoiceNumber}`, style: 'h2', margin: [0, 4, 0, 4] },
        { text: `Bill to: ${input.clientName}`, margin: [0, 0, 0, 12] },
        {
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [['Item', 'Qty', 'VAT', 'Price'], ...rows],
          },
        },
        {
          margin: [0, 12, 0, 0],
          text: [
            `Subtotal: ${formatMoney(input.subtotalCents, input.currency)}\n`,
            `VAT: ${formatMoney(input.taxCents, input.currency)}\n`,
            { text: `Total: ${formatMoney(input.totalCents, input.currency)}`, bold: true },
          ],
        },
      ],
      styles: { h1: { fontSize: 20, bold: true }, h2: { fontSize: 14, bold: true } },
    });
  }
}
