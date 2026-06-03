/**
 * pdf.ts — verifiable certificate PDF (human-readable + QR to the hosted credential).
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { env } from "../../config/env.js";

export type CertificateData = {
  recipientName: string;
  achievementName: string;
  courseTitle: string;
  issuedOn: Date;
  verifyUrl: string;
};

export async function certificatePdf(d: CertificateData): Promise<Buffer> {
  const qr = await QRCode.toBuffer(d.verifyUrl, { margin: 1, width: 140 });
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const W = doc.page.width;
  doc.rect(20, 20, W - 40, doc.page.height - 40).lineWidth(2).stroke("#1d4ed8");

  doc.fillColor("#1d4ed8").fontSize(14).text(env.CREDENTIAL_ISSUER_NAME.toUpperCase(), { align: "center" });
  doc.moveDown(0.5).fillColor("#111").fontSize(34).text("Certificat de réussite", { align: "center" });
  doc.moveDown(1).fontSize(13).fillColor("#444").text("Décerné à", { align: "center" });
  doc.moveDown(0.3).fontSize(28).fillColor("#111").text(d.recipientName, { align: "center" });
  doc.moveDown(1).fontSize(13).fillColor("#444").text("pour l'obtention de", { align: "center" });
  doc.moveDown(0.3).fontSize(20).fillColor("#1d4ed8").text(d.achievementName, { align: "center" });
  doc.moveDown(0.3).fontSize(13).fillColor("#444").text(d.courseTitle, { align: "center" });
  doc.moveDown(1).fontSize(11).fillColor("#666")
    .text(`Délivré le ${d.issuedOn.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });

  // Verification QR + URL (bottom)
  const qy = doc.page.height - 150;
  doc.image(qr, W / 2 - 70, qy, { width: 140 });
  doc.fontSize(9).fillColor("#666").text(`Vérifier : ${d.verifyUrl}`, 0, qy + 145, { align: "center" });

  doc.end();
  return done;
}
