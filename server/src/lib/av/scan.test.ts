import { test } from "node:test";
import assert from "node:assert/strict";
import { scanBytes } from "./scan.js";

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

test("EICAR test signature is flagged", () => {
  const r = scanBytes(Buffer.from(`prefix ${EICAR} suffix`));
  assert.equal(r.ok, false);
  assert.match(r.reason!, /EICAR/);
});

test("Windows PE / ELF / shebang executables are refused", () => {
  assert.equal(scanBytes(Buffer.from([0x4d, 0x5a, 0x90, 0x00])).ok, false);             // MZ
  assert.equal(scanBytes(Buffer.from([0x7f, 0x45, 0x4c, 0x46])).ok, false);             // ELF
  assert.equal(scanBytes(Buffer.from("#!/bin/sh\nrm -rf /")).ok, false);                // shebang
});

test("legitimate media/document headers pass", () => {
  assert.equal(scanBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).ok, true);              // JPEG
  assert.equal(scanBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47])).ok, true);              // PNG
  assert.equal(scanBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04])).ok, true);              // ZIP (.docx/SCORM)
  assert.equal(scanBytes(Buffer.from("WEBVTT\n\n00:00")).ok, true);                     // VTT captions
});
