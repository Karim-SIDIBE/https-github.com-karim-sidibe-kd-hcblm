/**
 * Tarifs.tsx — écran « Tarifs & accès » (spec paiement, lot PAY-2).
 * Produits vendables (cours B2C, lots de sièges B2B) avec un prix rédigé PAR
 * devise (XOF/XAF/EUR, saisie en unités majeures — jamais de conversion
 * automatique), constat des virements en attente (fournisseur manual), et
 * bloc « Offrir l'accès » réservé au Super Admin (droits GIFT, révocables).
 */
import { useEffect, useRef, useState } from "react";
import { api, auth, ApiError, type CourseSummary, type Org, type PayGift, type PayOrderRow, type PayProduct } from "../lib/api";
import { modal } from "../lib/modal";

const CURRENCIES = ["XOF", "XAF", "EUR"] as const;
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--border, #d7dbe3)", borderRadius: 8, fontSize: 13.5 };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, margin: "10px 0 4px", color: "#5a6577" };

export function Tarifs() {
  const isSuper = auth.user()?.role === "SUPER_ADMIN";
  const [products, setProducts] = useState<PayProduct[] | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [pending, setPending] = useState<PayOrderRow[]>([]);
  const [gifts, setGifts] = useState<PayGift[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [p, o] = await Promise.all([api.payProducts(), api.payOrders("PENDING")]);
      setProducts(p); setPending(o);
      if (isSuper) setGifts(await api.payGifts());
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Chargement impossible"}`); setProducts([]); }
    try { setCourses(await api.courses()); } catch { /* facultatif */ }
    try { setOrgs(await api.organizations()); } catch { /* facultatif */ }
  }
  useEffect(() => { void load(); }, []);

  // --- création de produit ---
  const [nType, setNType] = useState<"COURSE" | "SEATS">("COURSE");
  const [nTitle, setNTitle] = useState("");
  const [nCourse, setNCourse] = useState("");
  const [nSeats, setNSeats] = useState("10");
  async function createProduct() {
    setBusy(true); setNote(null);
    try {
      await api.payCreateProduct(nType === "COURSE"
        ? { type: "COURSE", title: nTitle, courseId: nCourse }
        : { type: "SEATS", title: nTitle, seatCount: Number(nSeats) });
      setNote("✓ Produit créé — rédigez maintenant ses prix par devise.");
      setNTitle(""); await load();
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Création impossible"}`); }
    finally { setBusy(false); }
  }

  // --- prix par devise (saisie en unités majeures) ---
  const priceRefs = useRef<Record<string, string>>({});
  async function savePrice(p: PayProduct, currency: string) {
    const raw = priceRefs.current[`${p.id}:${currency}`];
    if (!raw?.trim()) return;
    setBusy(true); setNote(null);
    try {
      await api.paySetPrice(p.id, currency, raw.trim());
      setNote(`✓ Prix ${currency} de « ${p.title} » enregistré.`);
      await load();
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Prix invalide"}`); }
    finally { setBusy(false); }
  }

  // --- constat de virement ---
  async function markPaid(o: PayOrderRow) {
    const reference = await modal.prompt({ title: "Constater le règlement", body: `Commande « ${o.product?.title} » — ${o.display}. Référence du virement reçue (obligatoire, journalisée) :`, okLabel: "Constater" });
    if (!reference) return;
    setBusy(true); setNote(null);
    try { await api.payMarkPaid(o.id, reference); setNote("✓ Règlement constaté — droit d'accès émis."); await load(); }
    catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Constat impossible"}`); }
    finally { setBusy(false); }
  }

  // --- « Offrir l'accès » (Super Admin) ---
  const [gProduct, setGProduct] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gOrg, setGOrg] = useState("");
  async function gift() {
    const prod = products?.find((p) => p.id === gProduct);
    if (!prod) return;
    setBusy(true); setNote(null);
    try {
      await api.payGift(prod.type === "COURSE" ? { productId: prod.id, email: gEmail.trim() } : { productId: prod.id, organizationId: gOrg });
      setNote("✓ Accès offert (journalisé dans l'audit)."); setGEmail(""); await load();
    } catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Cadeau impossible"}`); }
    finally { setBusy(false); }
  }
  async function revoke(g: PayGift) {
    const who = g.holderUser?.email ?? g.holderOrg?.name ?? g.id;
    if (!(await modal.confirm({ title: `Révoquer ce cadeau ?`, body: `Le droit de « ${who} » sera retiré (sièges décrémentés sans passer sous l'occupation réelle).`, danger: true, okLabel: "Révoquer" }))) return;
    try { const r = await api.payRevoke(g.id); setNote(r.seatsClamped ? "✓ Révoqué — sièges plafonnés à l'occupation réelle (à suivre)." : "✓ Cadeau révoqué."); await load(); }
    catch (e) { setNote(`✗ ${e instanceof ApiError ? e.message : "Révocation impossible"}`); }
  }

  if (!products) return <div className="content"><div className="card"><div className="card-b">Chargement…</div></div></div>;
  const courseOptions = courses.filter((c) => !products.some((p) => p.courseId === c.id));

  return (
    <div className="content">
      {note && <div className="card"><div className="card-b">{note}</div></div>}

      <div className="card">
        <div className="card-b">
          <div className="row between"><h3 style={{ margin: 0 }}>💳 Produits & prix par devise</h3></div>
          <p className="muted" style={{ fontSize: 12.5 }}>Un cours sans produit (ou sans prix) reste <b>gratuit</b> pour les apprenants. Les prix se rédigent par devise — aucune conversion automatique.</p>
          {products.length === 0 && <p className="muted">Aucun produit — la plateforme est entièrement gratuite.</p>}
          {products.map((p) => (
            <div key={p.id} style={{ borderTop: "1px solid var(--border, #e3e6ec)", padding: "10px 0" }}>
              <div className="row between">
                <b>{p.type === "COURSE" ? "🎓" : "🏢"} {p.title}</b>
                <span className="pill pill--info">{p.type === "COURSE" ? "Cours" : `Lot de ${p.seatCount} sièges`}</span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                {CURRENCIES.map((cur) => {
                  const price = p.prices.find((x) => x.currency === cur);
                  return (
                    <div key={cur} style={{ minWidth: 170 }}>
                      <span style={lbl}>{cur}{price ? ` — actuel : ${price.display ?? price.amountMinor}` : " — non vendu"}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={inp} placeholder={cur === "EUR" ? "ex. 25,00" : "ex. 15000"} defaultValue="" onChange={(e) => { priceRefs.current[`${p.id}:${cur}`] = e.target.value; }} />
                        <button className="btn btn--sm" disabled={busy} onClick={() => void savePrice(p, cur)}>OK</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border, #e3e6ec)", marginTop: 10, paddingTop: 10 }}>
            <b>➕ Nouveau produit</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div><span style={lbl}>Type</span>
                <select style={inp} value={nType} onChange={(e) => setNType(e.target.value as "COURSE" | "SEATS")}>
                  <option value="COURSE">Cours (B2C)</option><option value="SEATS">Lot de sièges (B2B)</option>
                </select></div>
              <div style={{ flex: 1, minWidth: 200 }}><span style={lbl}>Titre affiché</span>
                <input style={inp} value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="ex. Gestion du Temps — Niveau 1" /></div>
              {nType === "COURSE" ? (
                <div style={{ minWidth: 220 }}><span style={lbl}>Cours</span>
                  <select style={inp} value={nCourse} onChange={(e) => setNCourse(e.target.value)}>
                    <option value="">— choisir —</option>
                    {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.versions[0]?.title ?? c.slug}</option>)}
                  </select></div>
              ) : (
                <div><span style={lbl}>Sièges par lot</span>
                  <input style={inp} type="number" min={1} value={nSeats} onChange={(e) => setNSeats(e.target.value)} /></div>
              )}
              <button className="btn btn--sm btn--primary" disabled={busy || !nTitle || (nType === "COURSE" && !nCourse)} onClick={() => void createProduct()}>Créer</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          <h3 style={{ margin: 0 }}>🏦 Virements en attente de constat</h3>
          <p className="muted" style={{ fontSize: 12.5 }}>Commandes en attente (fournisseur « manual ») : à la réception du virement, constatez le règlement — le droit d'accès est émis immédiatement, action journalisée.</p>
          {pending.length === 0 ? <p className="muted">Aucune commande en attente.</p> : pending.map((o) => (
            <div key={o.id} className="row between" style={{ borderTop: "1px solid var(--border, #e3e6ec)", padding: "8px 0" }}>
              <span>{o.product?.title} · <b>{o.display}</b> · {o.buyerUser?.email ?? o.buyerOrg?.name ?? "—"} <span className="muted">({new Date(o.createdAt).toLocaleDateString("fr-FR")})</span></span>
              <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => void markPaid(o)}>✓ Constater le règlement</button>
            </div>
          ))}
        </div>
      </div>

      {isSuper && (
        <div className="card">
          <div className="card-b">
            <h3 style={{ margin: 0 }}>🎁 Offrir l'accès (Super Admin)</h3>
            <p className="muted" style={{ fontSize: 12.5 }}>Crée un droit d'accès « offert » (GIFT), journalisé et révocable — l'outil commercial pour les cas particuliers.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div style={{ minWidth: 220 }}><span style={lbl}>Produit</span>
                <select style={inp} value={gProduct} onChange={(e) => setGProduct(e.target.value)}>
                  <option value="">— choisir —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select></div>
              {products.find((p) => p.id === gProduct)?.type === "SEATS" ? (
                <div style={{ minWidth: 220 }}><span style={lbl}>Organisation</span>
                  <select style={inp} value={gOrg} onChange={(e) => setGOrg(e.target.value)}>
                    <option value="">— choisir —</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select></div>
              ) : (
                <div style={{ flex: 1, minWidth: 220 }}><span style={lbl}>E-mail de l'apprenant</span>
                  <input style={inp} value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="apprenant@exemple.com" /></div>
              )}
              <button className="btn btn--sm btn--primary" disabled={busy || !gProduct} onClick={() => void gift()}>Offrir</button>
            </div>
            {gifts.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {gifts.map((g) => (
                  <div key={g.id} className="row between" style={{ borderTop: "1px solid var(--border, #e3e6ec)", padding: "6px 0", fontSize: 13 }}>
                    <span>{g.scope === "SEATS" ? `🏢 ${g.holderOrg?.name} (+${g.seats} sièges)` : `🎓 ${g.holderUser?.email}`}
                      {g.course?.slug ? ` · ${g.course.slug}` : ""} · {new Date(g.grantedAt).toLocaleDateString("fr-FR")}
                      {g.revokedAt && <span className="pill pill--red" style={{ marginLeft: 6 }}>révoqué</span>}</span>
                    {!g.revokedAt && <button className="btn btn--sm" onClick={() => void revoke(g)}>✕ Révoquer</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
