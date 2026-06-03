/**
 * manifest.ts — parse SCORM (imsmanifest.xml) and cmi5 (cmi5.xml) manifests.
 *
 * Pure parsing over the XML text; defensive against single-vs-array shapes.
 */
import { XMLParser } from "fast-xml-parser";

export type ImportType = "SCORM12" | "SCORM2004" | "CMI5";
export type ParsedManifest = {
  type: ImportType;
  title: string;
  launchHref: string;
  structure: unknown;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true });
const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => (typeof v === "string" ? v : typeof v === "object" && v && "#text" in (v as any) ? String((v as any)["#text"]) : "");

/** SCORM imsmanifest.xml → launch href (first item's resource) + title + version. */
export function parseScorm(xml: string): ParsedManifest {
  const m = parser.parse(xml).manifest;
  if (!m) throw new Error("imsmanifest.xml invalide");

  const schemaversion = String(m.metadata?.schemaversion ?? "").toLowerCase();
  const type: ImportType = schemaversion.includes("1.2") ? "SCORM12" : "SCORM2004";

  const orgs = m.organizations;
  const defaultId = orgs?.["@_default"];
  const orgList = arr<any>(orgs?.organization);
  const org = orgList.find((o) => o["@_identifier"] === defaultId) ?? orgList[0];
  const title = text(org?.title) || text(m.metadata?.lom?.general?.title) || "Contenu SCORM importé";

  const resources = arr<any>(m.resources?.resource);
  const firstItem = arr<any>(org?.item)[0];
  const ref = firstItem?.["@_identifierref"];
  const resource = resources.find((r) => r["@_identifier"] === ref) ?? resources[0];
  const launchHref = resource?.["@_href"];
  if (!launchHref) throw new Error("Aucune ressource de lancement trouvée dans le manifeste SCORM");

  const structure = orgList.map((o) => ({
    title: text(o?.title),
    items: arr<any>(o?.item).map((it) => ({ title: text(it?.title), identifierref: it?.["@_identifierref"] })),
  }));
  return { type, title, launchHref, structure };
}

/** cmi5 cmi5.xml → first AU launch url + course title. */
export function parseCmi5(xml: string): ParsedManifest {
  const cs = parser.parse(xml).courseStructure;
  if (!cs) throw new Error("cmi5.xml invalide");
  const course = cs.course;
  const title = text(course?.title?.langstring) || text(course?.title) || "Contenu cmi5 importé";
  const aus = arr<any>(cs.au ?? course?.au);
  const au = aus[0];
  const launchHref = text(au?.url);
  if (!launchHref) throw new Error("Aucune AU (url) trouvée dans le manifeste cmi5");

  const structure = aus.map((a) => ({ id: a?.["@_id"], title: text(a?.title?.langstring) || text(a?.title), url: text(a?.url), moveOn: a?.["@_moveOn"] }));
  return { type: "CMI5", title, launchHref, structure };
}
