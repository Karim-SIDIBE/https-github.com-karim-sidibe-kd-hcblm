/**
 * docx.ts — extract plain text + heading structure from a .docx buffer.
 *
 * A .docx is a ZIP whose `word/document.xml` holds the body. We read it with
 * adm-zip (already a dependency — no new package) and recover paragraphs:
 * each <w:p> becomes one line, with a `heading` flag when it carries a heading
 * paragraph style. No external converter, fully offline.
 */
import AdmZip from "adm-zip";

export type DocParagraph = { text: string; heading: boolean };

/** Élément de document dans l'ordre de lecture : paragraphe (avec style) ou
 *  tableau (lignes × cellules). Les tableaux portent la structure que
 *  l'aplatissement en paragraphes détruit (quiz, journaux, grilles). */
export type DocElement =
  | { kind: "p"; text: string; heading: boolean; bullet: boolean }
  | { kind: "table"; rows: string[][] };

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

/** Pull the visible text of one <w:p>…</w:p> block, joining <w:t> runs. */
function paragraphText(xml: string): string {
  const parts: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) parts.push(unescapeXml(m[1]!));
  // tabs / line breaks become spaces so words don't glue together
  return parts.join("").replace(/<w:tab\/>/g, " ").replace(/\s+/g, " ").trim();
}

/** Heading if the paragraph style id mentions Heading/Titre/Title (Word + LibreOffice). */
function isHeading(xml: string): boolean {
  const m = /<w:pStyle\b[^>]*w:val="([^"]*)"/.exec(xml);
  if (!m) return false;
  return /heading|titre|title/i.test(m[1]!);
}

/** Style de liste (puces/numéros) — Word FR nomme « Listepuces »/« Listenumros ». */
function isBullet(xml: string): boolean {
  const m = /<w:pStyle\b[^>]*w:val="([^"]*)"/.exec(xml);
  if (m && /list|puce|numros|numero/i.test(m[1]!)) return true;
  return /<w:numPr\b/.test(xml); // numérotation directe sans style nommé
}

function documentXml(buf: Buffer): string {
  try {
    const zip = new AdmZip(buf);
    const entry = zip.getEntry("word/document.xml");
    if (!entry) throw new Error("word/document.xml absent — fichier .docx invalide");
    return entry.getData().toString("utf8");
  } catch (e) {
    throw new Error("Document Word illisible : " + (e instanceof Error ? e.message : String(e)));
  }
}

export function docxToParagraphs(buf: Buffer): DocParagraph[] {
  const xml = documentXml(buf);
  const out: DocParagraph[] = [];
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[0];
    const text = paragraphText(block);
    if (text) out.push({ text, heading: isHeading(block) });
  }
  return out;
}

/**
 * Extraction STRUCTURÉE : paragraphes et tableaux de premier niveau, dans
 * l'ordre du document. Les paragraphes situés dans les cellules ne sont pas
 * répétés hors de leur tableau.
 */
export function docxToDocElements(buf: Buffer): DocElement[] {
  const xml = documentXml(buf);
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const out: DocElement[] = [];
  // Éléments de premier niveau : <w:p> ou <w:tbl> (les tableaux imbriqués sont
  // rarissimes dans ces documents ; leurs cellules restent lues comme du texte).
  const re = /<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const block = m[0];
    if (m[1] === "p") {
      const text = paragraphText(block);
      if (text) out.push({ kind: "p", text, heading: isHeading(block), bullet: isBullet(block) });
      continue;
    }
    const rows: string[][] = [];
    const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(block))) {
      const cells: string[] = [];
      const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[0]))) {
        const parts: string[] = [];
        const pRe = /<w:p\b[\s\S]*?<\/w:p>/g;
        let pm: RegExpExecArray | null;
        while ((pm = pRe.exec(cm[0]))) {
          const t = paragraphText(pm[0]);
          if (t) parts.push(t);
        }
        cells.push(parts.join("\n"));
      }
      if (cells.some((c) => c.trim())) rows.push(cells);
    }
    if (rows.length) out.push({ kind: "table", rows });
  }
  return out;
}
