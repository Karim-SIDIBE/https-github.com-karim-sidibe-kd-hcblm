/**
 * tcp.ts — tiny TCP reachability probe (readiness checks).
 */
import net from "node:net";

/** Resolve true if a TCP connection to host:port succeeds within `timeoutMs`. */
export function pingTcp(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (ok: boolean) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(port, host);
  });
}
