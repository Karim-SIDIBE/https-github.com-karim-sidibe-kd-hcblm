import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScorm, parseCmi5 } from "./manifest.js";

const scorm12 = `<?xml version="1.0"?>
<manifest identifier="M1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1"><title>Sécurité au travail</title>
      <item identifier="I1" identifierref="R1"><title>Module 1</title></item>
    </organization>
  </organizations>
  <resources><resource identifier="R1" type="webcontent" href="index.html"/></resources>
</manifest>`;

const scorm2004 = scorm12.replace("<schemaversion>1.2</schemaversion>", "<schemaversion>2004 4th Edition</schemaversion>");

const cmi5 = `<?xml version="1.0"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="https://ex.org/course"><title><langstring lang="fr">Conformité RGPD</langstring></title></course>
  <au id="https://ex.org/au1" moveOn="Completed"><title><langstring lang="fr">Unité 1</langstring></title><url>au1/index.html</url></au>
</courseStructure>`;

test("parses SCORM 1.2 manifest", () => {
  const m = parseScorm(scorm12);
  assert.equal(m.type, "SCORM12");
  assert.equal(m.title, "Sécurité au travail");
  assert.equal(m.launchHref, "index.html");
});

test("detects SCORM 2004 version", () => {
  assert.equal(parseScorm(scorm2004).type, "SCORM2004");
});

test("parses cmi5 manifest (title + AU url)", () => {
  const m = parseCmi5(cmi5);
  assert.equal(m.type, "CMI5");
  assert.equal(m.title, "Conformité RGPD");
  assert.equal(m.launchHref, "au1/index.html");
});
