/**
 * page.ts — human-readable certificate verification page.
 *
 * The QR on every issued certificate points to the hosted-assertion URL
 * (`/api/v1/credentials/:id`). Machines must receive Open Badge JSON there
 * (spec requirement), but a person scanning the QR lands in a browser — this
 * renderer gives that visitor a verdict they can read. Pure function, no I/O:
 * the route fetches, this formats.
 */

/** Platform branding shown in the page header (mirrors the PWA appbar:
 *  logo icon + two-tone wordmark + "Opéré par …" attribution). */
export type PageBrand = {
  /** Public platform name, e.g. "DECLICK DIGITAL" (BRAND_NAME). */
  name: string;
  /** Operating department shown as attribution, e.g. "KOMPETENCES DECLICK". */
  operator: string;
  /** Logo icon as a data: URI (page must stay self-contained), or null. */
  logoDataUri: string | null;
};

export type CredentialPageData = {
  id: string;
  brand: PageBrand;
  /** Certificate issuer (CREDENTIAL_ISSUER_NAME — same name as in the Open
   *  Badge issuer document, e.g. "KOMPETENCES SOFT SKILLS"). The certification
   *  is issued by KOMPETENCES; DECLICK DIGITAL is the verifying platform. */
  issuerName: string;
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
// PWA appbar palette (web/src/styles.css): navy wordmark, green second word,
// muted attribution — the header must look like the app the learner knows.
const NAVY = "#0B2455";
const GREEN = "#2DAA4F";
const MUTED = "#7C8AA3";

/** Header identical in spirit to the PWA appbar: logo + "DECLICK DIGITAL"
 *  (second word green) + "Opéré par KOMPETENCES DECLICK". Falls back to a
 *  text-only wordmark when no logo is available. */
function brandHeader(b: PageBrand, subtitle: string): string {
  const words = b.name.trim().split(/\s+/);
  const head = esc(words[0] ?? b.name);
  const accent = esc(words.slice(1).join(" "));
  const wordmark =
    `<div style="font-weight:800;font-size:19px;letter-spacing:.3px;color:${NAVY};text-transform:uppercase;line-height:1">` +
    `${head}${accent ? ` <span style="color:${GREEN}">${accent}</span>` : ""}</div>` +
    `<div style="font-size:11px;color:${MUTED};font-weight:700;margin-top:3px">Opéré par ${esc(b.operator)}</div>`;
  const logo = b.logoDataUri
    ? `<img src="${b.logoDataUri}" alt="${esc(b.operator)}" style="width:44px;height:44px;object-fit:contain;flex:0 0 auto">`
    : "";
  return `<div style="padding:18px 0 14px">
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;text-align:left">${logo}<div>${wordmark}</div></div>
    <div style="font-size:12px;color:#888;margin-top:8px;text-align:center">${esc(subtitle)}</div>
  </div>`;
}

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
    note: `Ce certificat a été émis par ${d.issuerName} et sa signature électronique a été vérifiée à l'instant.`,
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
<title>Vérification de certificat — ${esc(d.brand.name)}</title>
</head>
<body style="margin:0;background:#f4f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1b1b1b">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
  ${brandHeader(d.brand, "Vérification de certificat")}
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
export function renderNotFoundPage(brand: PageBrand): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Certificat introuvable — ${esc(brand.name)}</title></head>
<body style="margin:0;background:#f4f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1b1b1b">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
  ${brandHeader(brand, "Vérification de certificat")}
  <div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(20,40,80,.08);padding:32px 24px;text-align:center">
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
