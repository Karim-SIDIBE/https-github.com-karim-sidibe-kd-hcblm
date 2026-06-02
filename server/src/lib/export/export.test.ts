import { test } from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { renderCourse } from "./render.js";
import { buildPackage } from "./packagers.js";
import { parseScorm, parseCmi5 } from "../interop/manifest.js";
import { n1Full } from "../../domain/fixtures/n1-full.js";

const meta = { slug: "gestion-du-temps-n1", title: n1Full.title, summary: n1Full.summary, threshold: n1Full.passThreshold };

test("renderCourse yields an index + one page per block + style asset", () => {
  const r = renderCourse(n1Full);
  assert.equal(r.pages.length, 1 + n1Full.blocks.length);
  assert.equal(r.pages[0]!.filename, "index.html");
  assert.ok(r.assets.some((a) => a.filename === "style.css"));
  assert.ok(r.pages.every((p) => p.html.includes("runtime.js")));
});

test("SCORM 1.2 export is a valid package our own parser accepts", () => {
  const { buffer, filename } = buildPackage("scorm12", meta, renderCourse(n1Full));
  assert.match(filename, /scorm12\.zip$/);
  const zip = new AdmZip(buffer);
  const manifest = zip.getEntry("imsmanifest.xml")!.getData().toString("utf8");
  const parsed = parseScorm(manifest);
  assert.equal(parsed.type, "SCORM12");
  assert.equal(parsed.launchHref, "index.html");
  assert.ok(zip.getEntry("runtime.js") && zip.getEntry("style.css"));
});

test("SCORM 2004 export is a valid package our own parser accepts", () => {
  const { buffer, filename } = buildPackage("scorm2004", meta, renderCourse(n1Full));
  assert.match(filename, /scorm2004\.zip$/);
  const zip = new AdmZip(buffer);
  const manifest = zip.getEntry("imsmanifest.xml")!.getData().toString("utf8");
  const parsed = parseScorm(manifest);
  assert.equal(parsed.type, "SCORM2004");
  assert.equal(parsed.launchHref, "index.html");
  assert.match(manifest, /2004 4th Edition/);
  assert.match(manifest, /imsss:sequencing/);
  // 2004 runtime drives the API_1484_11 object.
  assert.match(zip.getEntry("runtime.js")!.getData().toString("utf8"), /API_1484_11/);
});

test("cmi5 export is a valid package (masteryScore from the level threshold)", () => {
  const { buffer } = buildPackage("cmi5", meta, renderCourse(n1Full));
  const zip = new AdmZip(buffer);
  const manifest = zip.getEntry("cmi5.xml")!.getData().toString("utf8");
  assert.equal(parseCmi5(manifest).type, "CMI5");
  assert.match(manifest, /masteryScore="0\.70"/);
});

test("Common Cartridge export carries a CC 1.3 manifest", () => {
  const { buffer, filename } = buildPackage("cc", meta, renderCourse(n1Full));
  assert.match(filename, /\.imscc$/);
  const manifest = new AdmZip(buffer).getEntry("imsmanifest.xml")!.getData().toString("utf8");
  assert.match(manifest, /IMS Common Cartridge/);
  assert.match(manifest, /1\.3\.0/);
});
