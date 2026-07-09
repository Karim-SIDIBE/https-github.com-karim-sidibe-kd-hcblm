import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { certificatePdf } from "./pdf.js";

const data = {
  recipientName: "Awa Traoré",
  achievementName: "Certification finale",
  courseTitle: "Gestion du temps et productivité — Niveau 1",
  domainLabel: "Productivité & organisation",
  level: 1 as const,
  licenseId: "cmql0000000000000000000000",
  issuedOn: new Date("2026-07-07T12:00:00Z"),
  verifyUrl: "https://api.declick.digital/api/v1/credentials/cmql0000000000000000000000",
};

test("certificatePdf renders the fallback layout when no template exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cert-empty-"));
  const buf = await certificatePdf({ ...data, templateDir: dir });
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buf.length > 2000);
});

test("certificatePdf renders the branded template when the level asset exists", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cert-tpl-"));
  // Any valid PNG works as a stand-in background; a QR buffer is a PNG.
  await writeFile(join(dir, "niveau-2.png"), await QRCode.toBuffer("bg", { width: 200 }));
  const buf = await certificatePdf({ ...data, level: 2, templateDir: dir });
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buf.length > 2000);
});

test("certificatePdf shrinks long names and formation titles to fit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cert-long-"));
  await writeFile(join(dir, "niveau-3.png"), await QRCode.toBuffer("bg", { width: 200 }));
  const buf = await certificatePdf({
    ...data,
    level: 3,
    templateDir: dir,
    recipientName: "Jean-Baptiste Alexandre de la Fontaine-Kouyaté du Plessis-Bellière",
    courseTitle: "Management interculturel des équipes distribuées multi-fuseaux — perfectionnement avancé Niveau 3",
  });
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
});
