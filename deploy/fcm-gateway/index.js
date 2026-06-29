/**
 * fcm-gateway — minimal EXAMPLE relay between the KD-HCBLM API and Firebase
 * Cloud Messaging (which also delivers to APNs for iOS tokens).
 *
 * The API's notification dispatcher POSTs the PUSH payload to PUSH_WEBHOOK_URL:
 *   { id, to, kind, channel, subject, body, tokens: ["<device-token>", ...] }
 * This service turns that into an FCM multicast message.
 *
 * Wiring (in the API's deploy/.env):
 *   PUSH_WEBHOOK_URL=https://<gateway-host>/push?key=<GATEWAY_SECRET>
 *   (or, on the same compose network: http://fcm-gateway:8088/push?key=<secret>)
 *
 * Credentials: a Firebase service-account key, provided either as
 *   FIREBASE_SERVICE_ACCOUNT='<the JSON, inline>'  or
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
import http from "node:http";
import admin from "firebase-admin";

const PORT = Number(process.env.PORT || 8088);
const SECRET = process.env.GATEWAY_SECRET || "";
const BRAND = process.env.BRAND_NAME || "DECLICK DIGITAL";

if (!admin.apps.length) {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  admin.initializeApp({
    credential: inline ? admin.credential.cert(JSON.parse(inline)) : admin.credential.applicationDefault(),
  });
}

const readBody = (req) =>
  new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });

const json = (res, code, obj) =>
  res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(obj));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });
  if (req.method !== "POST" || url.pathname !== "/push") return json(res, 404, { error: "not_found" });
  if (SECRET && url.searchParams.get("key") !== SECRET) return json(res, 401, { error: "unauthorized" });

  let payload;
  try { payload = JSON.parse((await readBody(req)) || "{}"); } catch { return json(res, 400, { error: "bad_json" }); }

  const tokens = Array.isArray(payload.tokens) ? payload.tokens.filter(Boolean) : [];
  if (tokens.length === 0) return json(res, 200, { sent: 0, note: "no registered devices for recipient" });

  const route = payload.route || payload.data?.route;
  const message = {
    tokens,
    notification: { title: payload.subject || BRAND, body: String(payload.body || "") },
    ...(route ? { data: { route: String(route) } } : {}),
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  };

  try {
    // sendEachForMulticast handles up to 500 tokens and reports per-token results.
    const r = await admin.messaging().sendEachForMulticast(message);
    r.responses.forEach((resp, i) => {
      if (!resp.success) console.warn(`[fcm] token ${String(tokens[i]).slice(0, 12)}… failed: ${resp.error?.code}`);
    });
    return json(res, 200, { sent: r.successCount, failed: r.failureCount });
  } catch (e) {
    console.error("[fcm] send error:", e?.message || e);
    return json(res, 502, { error: "fcm_send_failed" });
  }
});

server.listen(PORT, () => console.log(`fcm-gateway listening on :${PORT}`));
