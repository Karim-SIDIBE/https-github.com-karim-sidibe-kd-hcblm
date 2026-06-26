/**
 * xlsx.ts — minimal, dependency-light XLSX (Office Open XML) writer.
 *
 * Builds a real multi-sheet .xlsx workbook from plain row arrays using the
 * already-present `adm-zip` (no heavy spreadsheet library). Text cells use
 * inline strings; numbers are numeric; the header row (row 0) is bold.
 * Validated against LibreOffice.
 */
import AdmZip from "adm-zip";

export type Cell = string | number | null | undefined;
export type Sheet = { name: string; rows: Cell[][] };

const xmlEsc = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

/** 0-based column index → spreadsheet letter (0→A, 26→AA). */
function colLetter(n: number): string {
  let s = ""; let x = n + 1;
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); }
  return s;
}

function cellXml(ref: string, val: Cell, header: boolean): string {
  const style = header ? ' s="1"' : "";
  if (val == null || val === "") return `<c r="${ref}"${style}/>`;
  if (typeof val === "number" && Number.isFinite(val)) return `<c r="${ref}"${style}><v>${val}</v></c>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(String(val))}</t></is></c>`;
}

function sheetXml(rows: Cell[][]): string {
  const body = rows.map((row, ri) =>
    `<row r="${ri + 1}">${row.map((v, ci) => cellXml(colLetter(ci) + (ri + 1), v, ri === 0)).join("")}</row>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const safeSheetName = (n: string, i: number) =>
  (n || `Feuille${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

export function buildXlsx(sheets: Sheet[]): Buffer {
  const zip = new AdmZip();
  const NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types";
  const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
  const NS_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const NS_SS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

  const overrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  zip.addFile("[Content_Types].xml", Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="${NS_CT}">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `${overrides}</Types>`));

  zip.addFile("_rels/.rels", Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_REL}">` +
    `<Relationship Id="rId1" Type="${NS_DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`));

  const sheetsXml = sheets.map((s, i) => `<sheet name="${xmlEsc(safeSheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  zip.addFile("xl/workbook.xml", Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${NS_SS}" xmlns:r="${NS_DOC}"><sheets>${sheetsXml}</sheets></workbook>`));

  const wbRels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_DOC}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="${NS_DOC}/styles" Target="styles.xml"/>`;
  zip.addFile("xl/_rels/workbook.xml.rels", Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_REL}">${wbRels}</Relationships>`));

  // Minimal stylesheet: cellXfs[0] = normal, cellXfs[1] = bold (header row).
  zip.addFile("xl/styles.xml", Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="${NS_SS}">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`));

  sheets.forEach((s, i) => zip.addFile(`xl/worksheets/sheet${i + 1}.xml`, Buffer.from(sheetXml(s.rows))));
  return zip.toBuffer();
}
