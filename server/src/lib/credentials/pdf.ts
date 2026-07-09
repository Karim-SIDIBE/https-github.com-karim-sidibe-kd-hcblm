/**
 * pdf.ts — verifiable certificate PDF (human-readable + QR to the hosted credential).
 *
 * Two rendering modes:
 * - TEMPLATE: when a branded background exists in assets/certificates/
 *   (niveau-1.png|jpg, niveau-2…, niveau-3…), it is drawn full-bleed (A4
 *   landscape) and the dynamic fields are overlaid at the positions of the
 *   KOMPETENCES design: learner name, formation + domain paragraph, issue
 *   date, licence number (the Open Badge credential id) and a small
 *   verification QR. The blanks must NOT contain the placeholder texts —
 *   see assets/certificates/README.md.
 * - FALLBACK: when no template file is present for the level, a simple
 *   drawn layout is produced (same data), so certificate issuance never
 *   breaks on a missing asset.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { env } from "../../config/env.js";

export type CertificateData = {
  recipientName: string;
  achievementName: string;
  courseTitle: string;
  /** Course domain label, e.g. "Productivité & organisation". */
  domainLabel: string;
  /** Course level 1..3 — selects the branded template. */
  level: 1 | 2 | 3;
  /** Unique licence number shown on the certificate (Open Badge credential id). */
  licenseId: string;
  issuedOn: Date;
  verifyUrl: string;
  /** Test hook: override the template directory (defaults to assets/certificates). */
  templateDir?: string;
};

/** Per-level accents matching the branded templates (N1 blue, N2 green, N3 gold). */
const LEVEL_STYLE: Record<1 | 2 | 3, { name: string; accent: string }> = {
  1: { name: "#1E5AA6", accent: "#2B5EA7" },
  2: { name: "#17513F", accent: "#1E5B4F" },
  3: { name: "#111111", accent: "#B4691E" },
};

function templatePath(level: 1 | 2 | 3, dir?: string): string | null {
  const base = dir ?? resolve("assets/certificates");
  for (const ext of ["png", "jpg", "jpeg"]) {
    const p = resolve(base, `niveau-${level}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

type Run = { text: string; bold?: boolean };

/** Draw one line of mixed regular/bold runs, centered at width/2. */
function centeredRuns(doc: PDFKit.PDFDocument, runs: Run[], y: number, size: number, color: string) {
  const width = runs.reduce(
    (sum, r) => sum + doc.font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).widthOfString(r.text),
    0,
  );
  let x = (doc.page.width - width) / 2;
  for (const r of runs) {
    doc.font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
    doc.text(r.text, x, y, { lineBreak: false });
    x += doc.widthOfString(r.text);
  }
}

/** Largest font size ≤ max where every line of runs fits in maxWidth. */
function fitSize(doc: PDFKit.PDFDocument, lines: Run[][], max: number, min: number, maxWidth: number): number {
  for (let size = max; size >= min; size -= 0.5) {
    const fits = lines.every(
      (runs) =>
        runs.reduce(
          (sum, r) => sum + doc.font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).widthOfString(r.text),
          0,
        ) <= maxWidth,
    );
    if (fits) return size;
  }
  return min;
}

export async function certificatePdf(d: CertificateData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const W = doc.page.width;   // 841.89
  const H = doc.page.height;  // 595.28
  const tpl = templatePath(d.level, d.templateDir);
  const style = LEVEL_STYLE[d.level];
  const dateStr = d.issuedOn.toLocaleDateString("fr-FR"); // 07/07/2026 — matches the template
  const qr = await QRCode.toBuffer(d.verifyUrl, { margin: 0, width: 160 });

  if (tpl) {
    // ----- branded template mode -------------------------------------------
    doc.image(tpl, 0, 0, { width: W, height: H });

    // Learner name — big, centered, level accent color, shrink-to-fit.
    const nameLine: Run[] = [{ text: d.recipientName, bold: true }];
    const nameSize = fitSize(doc, [nameLine], 38, 20, W * 0.82);
    centeredRuns(doc, nameLine, H * 0.40, nameSize, style.name);

    // Attestation paragraph — 4 centered lines, formation + domain in bold.
    const lines: Run[][] = [
      [{ text: "Cette certification atteste que la personne susnommée a complété" }],
      [
        { text: "avec succès la formation « " },
        { text: d.courseTitle, bold: true },
        { text: " » dans le domaine" },
      ],
      [{ text: "« " }, { text: d.domainLabel || "—", bold: true }, { text: " » et confirme son" }],
      [{ text: "expertise pour le niveau formé." }],
    ];
    const pSize = fitSize(doc, lines, 14.5, 10, W * 0.86);
    const lineH = pSize * 1.55;
    lines.forEach((runs, i) => centeredRuns(doc, runs, H * 0.505 + i * lineH, pSize, "#1c1c1c"));

    // Date + licence values, centered over the template's ruled lines.
    doc.font("Helvetica-Bold").fontSize(13.5).fillColor("#111");
    doc.text(dateStr, W * 0.263 - doc.widthOfString(dateStr) / 2, H * 0.765, { lineBreak: false });
    const lic = d.licenseId;
    const licSize = fitSize(doc, [[{ text: lic, bold: true }]], 13.5, 8, W * 0.30);
    doc.font("Helvetica-Bold").fontSize(licSize);
    doc.text(lic, W * 0.5 - doc.widthOfString(lic) / 2, H * 0.765, { lineBreak: false });

    // Discreet verification QR (white pad keeps it scannable on any corner art).
    const qs = 50;
    const qx = W * 0.925 - qs;
    const qy = H * 0.60;
    doc.roundedRect(qx - 4, qy - 4, qs + 8, qs + 8, 4).fill("#ffffff");
    doc.image(qr, qx, qy, { width: qs, height: qs });
    doc.font("Helvetica").fontSize(5.5).fillColor("#555");
    doc.text("Vérifier l'authenticité", qx - 12, qy + qs + 6, { width: qs + 24, align: "center" });
  } else {
    // ----- fallback drawn mode (no asset for this level) ---------------------
    doc.rect(20, 20, W - 40, H - 40).lineWidth(2).stroke(style.accent);
    doc.fillColor(style.accent).fontSize(14).text(env.CREDENTIAL_ISSUER_NAME.toUpperCase(), 50, 60, { width: W - 100, align: "center" });
    doc.moveDown(0.5).fillColor("#111").fontSize(32).text("Certificat de formation", { width: W - 100, align: "center" });
    doc.moveDown(0.2).fontSize(14).fillColor("#444").text("Attestation de Compétences", { width: W - 100, align: "center" });
    doc.moveDown(1).fontSize(13).text("Ce certificat est fièrement décerné à :", { width: W - 100, align: "center" });
    doc.moveDown(0.3).fontSize(28).fillColor(style.name).font("Helvetica-Bold").text(d.recipientName, { width: W - 100, align: "center" });
    doc.moveDown(0.8).font("Helvetica").fontSize(13).fillColor("#333")
      .text(`Formation « ${d.courseTitle} » — domaine « ${d.domainLabel || "—"} » (niveau ${d.level})`, { width: W - 100, align: "center" });
    doc.moveDown(0.3).fontSize(12).fillColor("#555").text(d.achievementName, { width: W - 100, align: "center" });
    doc.moveDown(1).fontSize(11).fillColor("#666").text(`Date de délivrance : ${dateStr}`, { width: W - 100, align: "center" });
    doc.moveDown(0.2).text(`N° de licence : ${d.licenseId}`, { width: W - 100, align: "center" });
    const qy = H - 150;
    doc.image(qr, W / 2 - 60, qy, { width: 120 });
    doc.fontSize(9).fillColor("#666").text(`Vérifier : ${d.verifyUrl}`, 0, qy + 126, { width: W, align: "center" });
  }

  doc.end();
  return done;
}
