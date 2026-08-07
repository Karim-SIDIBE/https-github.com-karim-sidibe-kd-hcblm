/**
 * page.ts — human-readable certificate verification page.
 *
 * The QR on every issued certificate points to the hosted-assertion URL
 * (`/api/v1/credentials/:id`). Machines must receive Open Badge JSON there
 * (spec requirement), but a person scanning the QR lands in a browser — this
 * renderer gives that visitor a verdict they can read. Pure function, no I/O:
 * the route fetches, this formats.
 */

export type CredentialPageData = {
  id: string;
  holderName: string;
  courseTitle: string;
  achievementName: string;
  level: 1 | 2 | 3;
  issuedOn: Date;
  revoked: boolean;
  revocationReason: string | null;
  /** VC-JWT signature verified against the platform's public keys. */
  signatureValid: boolean;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const BLUE = "#1E5AA6";
const ORANGE = "#F36F21";

type Status = { badge: string; color: string; bg: string; note: string };

function status(d: CredentialPageData): Status {
  if (d.revoked) {
    return {
      badge: "❌ Certificat révoqué",
      color: "#b3261e", bg: "#fdecea",
      note: d.revocationReason && d.revocationReason !== "revoked"
        ? `Ce certificat a été révoqué par l'émetteur. Motif : ${d.revocationReason}.`
        : "Ce certificat a été révoqué par l'émetteur et n'est plus valable.",
    };
  }
  if (!d.signatureValid) {
    return {
      badge: "⚠️ Signature non vérifiable",
      color: "#8a6d00", bg: "#fff8e1",
      note: "L'authenticité de ce certificat n'a pas pu être confirmée cryptographiquement. Contactez l'émetteur avant de vous y fier.",
    };
  }
  return {
    badge: "✅ Certificat valide",
    color: "#1e7e34", bg: "#e8f5e9",
    note: "Ce certificat a été émis par DECLICK DIGITAL et sa signature électronique a été vérifiée à l'instant.",
  };
}

/** Full HTML page (self-contained: inline styles, no assets). */
export function renderCredentialPage(d: CredentialPageData): string {
  const s = status(d);
  const date = d.issuedOn.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 12px 8px 0;color:#666;white-space:nowrap;vertical-align:top">${k}</td>` +
    `<td style="padding:8px 0;font-weight:600">${v}</td></tr>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Vérification de certificat — DECLICK DIGITAL</title>
</head>
<body style="margin:0;background:#f4f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1b1b1b">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;padding:18px 0 14px">
    <div style="font-size:20px;font-weight:800;letter-spacing:.4px;color:${BLUE}">DECLICK <span style="color:${ORANGE}">DIGITAL</span></div>
    <div style="font-size:12px;color:#888;margin-top:2px">Vérification de certificat</div>
  </div>
  <div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(20,40,80,.08);overflow:hidden">
    <div style="background:${s.bg};padding:18px 22px;border-bottom:1px solid rgba(0,0,0,.05)">
      <div style="font-size:19px;font-weight:800;color:${s.color}">${s.badge}</div>
      <div style="font-size:13.5px;color:#444;margin-top:6px;line-height:1.5">${esc(s.note)}</div>
    </div>
    <div style="padding:20px 22px">
      <table style="border-collapse:collapse;width:100%;font-size:15px">
        ${row("Titulaire", esc(d.holderName))}
        ${row("Certification", esc(d.achievementName))}
        ${row("Parcours", esc(d.courseTitle))}
        ${row("Niveau", `Niveau ${d.level}`)}
        ${row("Délivré le", esc(date))}
        ${row("N° de licence", `<code style="font-size:13px;background:#f4f6f9;padding:2px 6px;border-radius:4px">${esc(d.id)}</code>`)}
      </table>
    </div>
    <div style="padding:14px 22px;border-top:1px solid #eee;font-size:12.5px;color:#777;line-height:1.6">
      Vérification technique : <a style="color:${BLUE}" href="?format=json">assertion Open Badge (JSON)</a> ·
      <a style="color:${BLUE}" href="${esc(`/api/v1/credentials/${d.id}/vc`)}">Verifiable Credential signé (JWT)</a><br>
      L'authenticité est vérifiable par quiconque via la signature ES256 publiée par l'émetteur (JWKS).
    </div>
  </div>
  <div style="text-align:center;font-size:11.5px;color:#9aa3ad;padding:16px 0">
    Cette page reflète le statut du certificat en temps réel — une révocation y apparaît immédiatement.
  </div>
</div>
</body>
</html>`;
}

/** Browser-facing 404 (unknown or deleted credential id). */
export function renderNotFoundPage(): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Certificat introuvable — DECLICK DIGITAL</title></head>
<body style="margin:0;background:#f4f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1b1b1b">
<div style="max-width:640px;margin:0 auto;padding:48px 16px;text-align:center">
  <div style="font-size:20px;font-weight:800;color:${BLUE}">DECLICK <span style="color:${ORANGE}">DIGITAL</span></div>
  <div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(20,40,80,.08);padding:32px 24px;margin-top:20px">
    <div style="font-size:19px;font-weight:800;color:#b3261e">❌ Certificat introuvable</div>
    <div style="font-size:14px;color:#444;margin-top:10px;line-height:1.6">
      Aucun certificat ne correspond à cet identifiant. Vérifiez le lien ou le QR code,
      ou contactez l'émetteur du document qui vous a été présenté.
    </div>
  </div>
</div>
</body>
</html>`;
}
