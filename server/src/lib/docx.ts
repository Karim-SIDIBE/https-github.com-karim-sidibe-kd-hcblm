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

export function docxToParagraphs(buf: Buffer): DocParagraph[] {
  let xml: string;
  try {
    const zip = new AdmZip(buf);
    const entry = zip.getEntry("word/document.xml");
    if (!entry) throw new Error("word/document.xml absent — fichier .docx invalide");
    xml = entry.getData().toString("utf8");
  } catch (e) {
    throw new Error("Document Word illisible : " + (e instanceof Error ? e.message : String(e)));
  }
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
