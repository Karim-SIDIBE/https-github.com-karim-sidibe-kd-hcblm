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

// --- clamavScan contre un FAUX clamd TCP local (verdicts réels du protocole) ---
import net from "node:net";
import { clamavScan } from "./scan.js";

/** Démarre un faux clamd qui répond `reply` puis `end` (ou détruit la socket). */
function fakeClamd(reply: string, destroy = false): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const srv = net.createServer((sock) => {
      sock.on("data", () => { /* avale le flux INSTREAM */ });
      setTimeout(() => { sock.write(reply); destroy ? sock.destroy() : sock.end(); }, 30);
    });
    srv.listen(0, "127.0.0.1", () => resolve({ port: (srv.address() as net.AddressInfo).port, close: () => srv.close() }));
  });
}

test("clamavScan : verdict OK du démon → fichier accepté", async () => {
  const { port, close } = await fakeClamd("stream: OK\0");
  const r = await clamavScan(Buffer.from("contenu sain"), { host: "127.0.0.1", port, failOpen: false });
  close();
  assert.equal(r.ok, true);
  assert.equal(r.engine, "clamav");
});

test("clamavScan : dépassement de StreamMaxLength (annonce puis coupure) → message actionnable, pas « indisponible »", async () => {
  // Comportement réel de clamd : « INSTREAM size limit exceeded. ERROR » puis reset.
  const { port, close } = await fakeClamd("INSTREAM size limit exceeded. ERROR\0", true);
  const r = await clamavScan(Buffer.from("gros média"), { host: "127.0.0.1", port, failOpen: false });
  close();
  assert.equal(r.ok, false);
  assert.match(r.reason!, /limite de scan/);
  assert.match(r.reason!, /clamd\.conf/);
  assert.doesNotMatch(r.reason!, /indisponible/);
});

test("clamavScan : démon injoignable → « indisponible », bloqué en mode strict, accepté en mode disponibilité", async () => {
  // Port fermé : connexion refusée immédiatement.
  const closedPort = await new Promise<number>((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); });
  const strict = await clamavScan(Buffer.from("x"), { host: "127.0.0.1", port: closedPort, failOpen: false });
  assert.equal(strict.ok, false);
  assert.match(strict.reason!, /indisponible/);
  const open = await clamavScan(Buffer.from("x"), { host: "127.0.0.1", port: closedPort, failOpen: true });
  assert.equal(open.ok, true);
});
