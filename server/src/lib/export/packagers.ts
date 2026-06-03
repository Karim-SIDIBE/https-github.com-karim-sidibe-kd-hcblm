/**
 * packagers.ts — wrap rendered pages into standard, importable packages.
 *
 * Each packager adds a format-specific `runtime.js` (implementing window.KLMS)
 * and a manifest, then zips. The resulting archive imports into any modern LMS
 * (SCORM 1.2 → universal; cmi5 → xAPI; Common Cartridge → Canvas/Moodle/D2L/…).
 */
import AdmZip from "adm-zip";
import type { RenderedCourse } from "./render.js";

export type ExportFormat = "scorm12" | "scorm2004" | "cmi5" | "cc";
export type CourseMeta = { slug: string; title: string; summary: string; threshold: number };

const xmlEsc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const idOf = (slug: string) => `KLMS-${slug.replace(/[^a-zA-Z0-9_-]/g, "")}`;

// --- runtime.js per format --------------------------------------------------

const SCORM_RUNTIME = `(function(){var API=null;
function find(w){var n=0;while(w&&!w.API&&w.parent&&w.parent!==w&&n++<12)w=w.parent;return w?w.API:null;}
function get(){var a=find(window);if(!a&&window.opener)a=find(window.opener);return a;}
window.KLMS={init:function(){API=get();if(API)API.LMSInitialize("");},
complete:function(score){if(!API)return;if(score!=null){API.LMSSetValue("cmi.core.score.raw",String(score));API.LMSSetValue("cmi.core.score.min","0");API.LMSSetValue("cmi.core.score.max","100");API.LMSSetValue("cmi.core.lesson_status",score>=70?"passed":"completed");}else{API.LMSSetValue("cmi.core.lesson_status","completed");}API.LMSCommit("");},
finish:function(){if(API){API.LMSFinish("");API=null;}}};
window.addEventListener("unload",function(){if(window.KLMS)KLMS.finish();});})();`;

// SCORM 2004 uses the API_1484_11 object and completion/success status verbs.
const SCORM2004_RUNTIME = `(function(){var API=null;
function find(w){var n=0;while(w&&!w.API_1484_11&&w.parent&&w.parent!==w&&n++<12)w=w.parent;return w?w.API_1484_11:null;}
function get(){var a=find(window);if(!a&&window.opener)a=find(window.opener);return a;}
window.KLMS={init:function(){API=get();if(API)API.Initialize("");},
complete:function(score){if(!API)return;if(score!=null){API.SetValue("cmi.score.raw",String(score));API.SetValue("cmi.score.min","0");API.SetValue("cmi.score.max","100");API.SetValue("cmi.score.scaled",String(score/100));API.SetValue("cmi.success_status",score>=70?"passed":"failed");}API.SetValue("cmi.completion_status","completed");API.Commit("");},
finish:function(){if(API){API.Terminate("");API=null;}}};
window.addEventListener("unload",function(){if(window.KLMS)KLMS.finish();});})();`;

const CMI5_RUNTIME = `(function(){var q=new URLSearchParams(location.search);
var endpoint=q.get("endpoint"),fetchUrl=q.get("fetch"),reg=q.get("registration"),actor=q.get("actor"),activityId=q.get("activityId"),auth=null;
function send(verb,result){if(!endpoint||!auth)return;var st={actor:JSON.parse(actor||"{}"),verb:{id:verb},object:{id:activityId,objectType:"Activity"},context:{registration:reg}};if(result)st.result=result;
fetch(endpoint.replace(/\\/$/,"")+"/statements",{method:"POST",headers:{"content-type":"application/json","authorization":auth,"X-Experience-API-Version":"1.0.3"},body:JSON.stringify(st)});}
window.KLMS={init:function(){if(!fetchUrl)return;fetch(fetchUrl,{method:"POST"}).then(function(r){return r.json();}).then(function(j){auth="Bearer "+(j["auth-token"]||"");send("http://adlnet.gov/expapi/verbs/initialized");}).catch(function(){});},
complete:function(score){var result={completion:true};if(score!=null){result.score={scaled:score/100};result.success=score>=70;send("http://adlnet.gov/expapi/verbs/"+(score>=70?"passed":"completed"),result);}else{send("http://adlnet.gov/expapi/verbs/completed",result);}},
finish:function(){}};})();`;

const NOOP_RUNTIME = `window.KLMS={init:function(){},complete:function(){},finish:function(){}};`;

// --- manifests --------------------------------------------------------------

function scorm12Manifest(meta: CourseMeta, course: RenderedCourse): string {
  const items = course.pages.map((p, i) => `      <item identifier="ITEM-${i}" identifierref="RES-${i}" isvisible="true"><title>${xmlEsc(p.title)}</title></item>`).join("\n");
  const resources = course.pages.map((p, i) =>
    `    <resource identifier="RES-${i}" type="webcontent" adlcp:scormtype="sco" href="${p.filename}">\n      <file href="${p.filename}"/>\n      <file href="runtime.js"/>\n      <file href="style.css"/>\n    </resource>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${idOf(meta.slug)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG"><title>${xmlEsc(meta.title)}</title>
${items}
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>`;
}

function scorm2004Manifest(meta: CourseMeta, course: RenderedCourse): string {
  const items = course.pages.map((p, i) => `      <item identifier="ITEM-${i}" identifierref="RES-${i}"><title>${xmlEsc(p.title)}</title></item>`).join("\n");
  const resources = course.pages.map((p, i) =>
    `    <resource identifier="RES-${i}" type="webcontent" adlcp:scormType="sco" href="${p.filename}">\n      <file href="${p.filename}"/>\n      <file href="runtime.js"/>\n      <file href="style.css"/>\n    </resource>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${idOf(meta.slug)}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG"><title>${xmlEsc(meta.title)}</title>
${items}
      <imsss:sequencing>
        <imsss:controlMode choice="true" flow="true"/>
      </imsss:sequencing>
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>`;
}

function cmi5Manifest(meta: CourseMeta): string {
  const courseId = `https://declick.kompetences.net/xapi/course/${encodeURIComponent(meta.slug)}`;
  const auId = `https://declick.kompetences.net/xapi/au/${encodeURIComponent(meta.slug)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="${courseId}">
    <title><langstring lang="fr">${xmlEsc(meta.title)}</langstring></title>
    <description><langstring lang="fr">${xmlEsc(meta.summary)}</langstring></description>
  </course>
  <au id="${auId}" moveOn="Completed" masteryScore="${(meta.threshold / 100).toFixed(2)}">
    <title><langstring lang="fr">${xmlEsc(meta.title)}</langstring></title>
    <description><langstring lang="fr">${xmlEsc(meta.summary)}</langstring></description>
    <url>index.html</url>
  </au>
</courseStructure>`;
}

function ccManifest(meta: CourseMeta, course: RenderedCourse): string {
  const items = course.pages.map((p, i) => `        <item identifier="ITEM-${i}" identifierref="RES-${i}"><title>${xmlEsc(p.title)}</title></item>`).join("\n");
  const resources = course.pages.map((p, i) => `    <resource identifier="RES-${i}" type="webcontent" href="${p.filename}"><file href="${p.filename}"/></resource>`).join("\n")
    + `\n    <resource identifier="RES-CSS" type="webcontent" href="style.css"><file href="style.css"/></resource>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${idOf(meta.slug)}"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p3/imscp_v1p1"
  xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p3/LOM/manifest"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>IMS Common Cartridge</schema><schemaversion>1.3.0</schemaversion>
    <lomimscc:lom><lomimscc:general><lomimscc:title><lomimscc:string>${xmlEsc(meta.title)}</lomimscc:string></lomimscc:title></lomimscc:general></lomimscc:lom>
  </metadata>
  <organizations>
    <organization identifier="ORG" structure="rooted-hierarchy">
      <item identifier="ROOT">
${items}
      </item>
    </organization>
  </organizations>
  <resources>
${resources}
  </resources>
</manifest>`;
}

// --- packaging --------------------------------------------------------------

export function buildPackage(format: ExportFormat, meta: CourseMeta, course: RenderedCourse): { filename: string; buffer: Buffer } {
  const zip = new AdmZip();
  for (const p of course.pages) zip.addFile(p.filename, Buffer.from(p.html, "utf8"));
  for (const a of course.assets) zip.addFile(a.filename, Buffer.from(a.content, "utf8"));

  if (format === "scorm12") {
    zip.addFile("runtime.js", Buffer.from(SCORM_RUNTIME, "utf8"));
    zip.addFile("imsmanifest.xml", Buffer.from(scorm12Manifest(meta, course), "utf8"));
    return { filename: `${meta.slug}-scorm12.zip`, buffer: zip.toBuffer() };
  }
  if (format === "scorm2004") {
    zip.addFile("runtime.js", Buffer.from(SCORM2004_RUNTIME, "utf8"));
    zip.addFile("imsmanifest.xml", Buffer.from(scorm2004Manifest(meta, course), "utf8"));
    return { filename: `${meta.slug}-scorm2004.zip`, buffer: zip.toBuffer() };
  }
  if (format === "cmi5") {
    zip.addFile("runtime.js", Buffer.from(CMI5_RUNTIME, "utf8"));
    zip.addFile("cmi5.xml", Buffer.from(cmi5Manifest(meta), "utf8"));
    return { filename: `${meta.slug}-cmi5.zip`, buffer: zip.toBuffer() };
  }
  zip.addFile("runtime.js", Buffer.from(NOOP_RUNTIME, "utf8"));
  zip.addFile("imsmanifest.xml", Buffer.from(ccManifest(meta, course), "utf8"));
  return { filename: `${meta.slug}-commoncartridge.imscc`, buffer: zip.toBuffer() };
}
