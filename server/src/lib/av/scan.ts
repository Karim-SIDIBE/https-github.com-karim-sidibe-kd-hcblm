/**
 * scan.ts — upload malware scanning. Pluggable with graceful fallback (project
 * convention): always a dependency-free heuristic (EICAR test signature + reject
 * executables masquerading as media/docs); plus a real ClamAV engine over TCP
 * (INSTREAM) when CLAMAV_HOST is set. Document/package uploads are scanned in
 * full; large media is scanned by streaming head (memory-safe on the API box).
 */
import net from "node:net";
import { Readable } from "node:stream";
import { env } from "../../config/env.js";

export type ScanResult = { ok: boolean; reason?: string; engine: string };

// The EICAR anti-malware test file — harmless, every scanner flags it. Lets ops
// verify the pipeline end-to-end without a real virus.
const EICAR = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");

/** Pure heuristic over the bytes (or a file's head). No I/O — unit-tested. */
export function scanBytes(buf: Buffer, _opts: { filename?: string; mime?: string } = {}): ScanResult {
  if (buf.includes(EICAR)) return { ok: false, reason: "Signature de test EICAR détectée", engine: "heuristic" };
  const h = buf.subarray(0, 4);
  const isExecutable =
    (h[0] === 0x4d && h[1] === 0x5a) ||                                   // MZ — Windows PE/.exe/.dll
    (h[0] === 0x7f && h[1] === 0x45 && h[2] === 0x4c && h[3] === 0x46) || // ELF — Linux binary
    (h[0] === 0x23 && h[1] === 0x21) ||                                   // #! — script shebang
    (h[0] === 0xca && h[1] === 0xfe && h[2] === 0xba && h[3] === 0xbe) || // Mach-O fat / Java class
    (h[0] === 0xfe && h[1] === 0xed && h[2] === 0xfa);                    // Mach-O
  if (isExecutable) return { ok: false, reason: "Fichier exécutable refusé", engine: "heuristic" };
  return { ok: true, engine: "heuristic" };
}

/** Stream the buffer to clamd (INSTREAM) and interpret the verdict. */
function clamavScan(buf: Buffer): Promise<ScanResult> {
  const failOpen = !env.AV_FAIL_CLOSED; // if clamd is unreachable, allow (heuristic already passed) unless told otherwise
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: env.CLAMAV_HOST!, port: env.CLAMAV_PORT });
    let reply = "";
    const settle = (r: ScanResult) => { sock.destroy(); resolve(r); };
    sock.setTimeout(env.AV_TIMEOUT_MS);
    sock.on("connect", () => {
      sock.write("zINSTREAM\0");
      const len = Buffer.alloc(4); len.writeUInt32BE(buf.length, 0);
      sock.write(Buffer.concat([len, buf, Buffer.from([0, 0, 0, 0])])); // chunk + zero-length terminator
    });
    sock.on("data", (d) => { reply += d.toString(); });
    sock.on("timeout", () => settle({ ok: failOpen, reason: "ClamAV: délai dépassé", engine: "clamav" }));
    sock.on("error", () => settle({ ok: failOpen, reason: "ClamAV: indisponible", engine: "clamav" }));
    sock.on("end", () => {
      if (/FOUND/.test(reply)) resolve({ ok: false, reason: reply.replace(/\0/g, "").trim(), engine: "clamav" });
      else if (/OK/.test(reply)) resolve({ ok: true, engine: "clamav" });
      else resolve({ ok: failOpen, reason: reply.trim() || "ClamAV: réponse inconnue", engine: "clamav" });
    });
  });
}

/** Full scan of an in-memory upload (documents/packages). */
export async function scanUpload(buf: Buffer, opts: { filename?: string; mime?: string } = {}): Promise<ScanResult> {
  const h = scanBytes(buf, opts);
  if (!h.ok) return h;
  if (env.CLAMAV_HOST) return clamavScan(buf);
  return h;
}

/** Read a readable stream fully into a single Buffer. */
export function readAll(src: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    src.on("data", (c: Buffer) => chunks.push(c));
    src.on("end", () => resolve(Buffer.concat(chunks)));
    src.on("error", reject);
  });
}

function readHead(src: Readable, n: number): Promise<{ head: Buffer; ended: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let read = 0; let settled = false;
    const cleanup = () => { src.off("readable", onReadable); src.off("end", onEnd); src.off("error", onError); };
    const done = (ended: boolean) => { if (settled) return; settled = true; cleanup(); resolve({ head: Buffer.concat(chunks), ended }); };
    const onReadable = () => { let c: Buffer | null; while ((c = src.read() as Buffer | null) !== null) { chunks.push(c); read += c.length; if (read >= n) return done(false); } };
    const onEnd = () => done(true);
    const onError = (e: Error) => { if (settled) return; settled = true; cleanup(); reject(e); };
    src.on("readable", onReadable); src.on("end", onEnd); src.on("error", onError);
  });
}

/**
 * Memory-safe scan for large streamed uploads (media): inspect the head, then
 * hand back a body to persist — the whole buffer if the file was small, else the
 * original stream with the head put back. Heuristic only (no full ClamAV here).
 */
export async function scanStreamHead(src: Readable, opts: { filename?: string; mime?: string } = {}, headBytes = 262_144): Promise<{ result: ScanResult; body: Readable | Buffer }> {
  const { head, ended } = await readHead(src, headBytes);
  const result = scanBytes(head, opts);
  if (ended) return { result, body: head };
  src.unshift(head);
  return { result, body: src };
}
