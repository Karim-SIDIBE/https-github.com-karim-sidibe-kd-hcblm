/**
 * receipt.ts — reçu PDF d'une commande payée (spec paiement §08, B2C).
 * Même patron que les certificats (pdfkit → Buffer complet). Mentions légales
 * détaillées (n° contribuable, TVA) : configurables au lot PAY-4.
 */
import PDFDocument from "pdfkit";
import { env } from "../../config/env.js";
import { formatAmount, type Currency } from "../../domain/payments/money.js";

export type ReceiptData = {
  orderId: string;
  paidAt: Date;
  buyerName: string;
  buyerEmail?: string | null;
  productTitle: string;
  quantity: number;
  amountMinor: number;
  currency: Currency;
  method?: string | null;
  provider: string;
  providerRef?: string | null;
};

export async function receiptPdf(d: ReceiptData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const navy = "#123A7A", accent = "#E4620F", muted = "#6b7280";
  doc.font("Helvetica-Bold").fontSize(18).fillColor(navy).text(env.BRAND_NAME, { continued: false });
  doc.font("Helvetica").fontSize(10).fillColor(muted).text(`Opéré par ${env.BRAND_OPERATOR}`);
  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fontSize(22).fillColor(accent).text("Reçu de paiement");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10.5).fillColor(muted)
    .text(`Reçu n° ${d.orderId}`)
    .text(`Émis le ${d.paidAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`);
  doc.moveDown(1.2);

  const row = (label: string, value: string) => {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(label, { continued: true });
    doc.font("Helvetica").fillColor("#111827").text(`  ${value}`);
    doc.moveDown(0.25);
  };
  row("Acheteur :", d.buyerEmail ? `${d.buyerName} <${d.buyerEmail}>` : d.buyerName);
  row("Produit :", d.quantity > 1 ? `${d.productTitle} × ${d.quantity}` : d.productTitle);
  row("Moyen de paiement :", `${d.method ?? "—"} (${d.provider.toLowerCase()})`);
  if (d.providerRef) row("Référence de transaction :", d.providerRef);
  doc.moveDown(0.8);

  doc.rect(56, doc.y, 483, 44).fill("#F5F7FB");
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(15)
    .text(`Total réglé : ${formatAmount(d.amountMinor, d.currency)}`, 72, doc.y - 32);
  doc.moveDown(2);

  doc.font("Helvetica").fontSize(9).fillColor(muted)
    .text("Reçu généré automatiquement par la plateforme K-LMS — il atteste du règlement de la commande référencée ci-dessus. Conservez-le comme justificatif.", 56, doc.y, { width: 483 });

  doc.end();
  return done;
}
