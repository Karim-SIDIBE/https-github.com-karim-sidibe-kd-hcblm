/**
 * OrderStatus.tsx — suivi d'une commande (spec paiement, PAY-2 + PAY-2bis).
 * C'est aussi la page de RETOUR navigateur après un paiement hébergé — elle
 * n'accorde jamais l'accès elle-même : elle interroge le serveur (polling) et
 * ne débloque l'inscription que lorsque la commande est réellement PAID
 * (webhook vérifié, ou constat staff pour un virement).
 * Mode invité (PAY-2bis) : sans session, le suivi passe par le jeton de
 * commande scellé conservé sur l'appareil au checkout ; une fois payée, la
 * connexion se fait par le lien magique envoyé par e-mail.
 */
import { useEffect, useRef, useState } from "react";
import { api, isLoggedIn } from "../lib/app";
import type { CheckoutInfo, PayOrder } from "../lib/api";
import { orderTokenOf } from "../lib/guestOrder";
import { rememberEnrollment } from "../lib/autosync";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

export function OrderStatus({ orderId }: { orderId: string }) {
  const t = useT();
  const guest = !isLoggedIn();
  const gtoken = guest ? orderTokenOf(orderId) : null;
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function refresh() {
    try {
      const o = guest ? await api.guestOrder(orderId, gtoken!) : await api.payGetOrder(orderId);
      setOrder(o);
      if (o.status !== "PENDING" && pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      // En attente : (re)demander le checkout — idempotent — pour afficher les
      // références de virement ou le lien de paiement de l'agrégateur.
      if (o.status === "PENDING" && !checkout) {
        setCheckout(await (guest ? api.guestOrderCheckout(orderId, gtoken!) : api.payCheckout(orderId)).catch(() => null));
      }
    } catch (e) { setError(e instanceof Error ? e.message : t("pay.loadError")); }
  }

  useEffect(() => {
    if (guest && !gtoken) return; // pas de jeton sur cet appareil : rien à interroger
    void refresh();
    pollRef.current = window.setInterval(() => { void refresh(); }, 6000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [orderId]);

  async function enterCourse() {
    const courseId = order?.product?.courseId;
    if (!courseId) { navigate(routes.enrollments()); return; }
    setEnrolling(true);
    try { const e = await api.selfEnroll(courseId); rememberEnrollment(e.id); navigate(routes.course(e.id)); }
    catch (err) {
      // Déjà inscrit (revisite de la page) → retour au catalogue, le cours y est.
      if ((err as { code?: string }).code === "already_enrolled") navigate(routes.enrollments());
      else setError(err instanceof Error ? err.message : t("pay.enrollFail"));
    }
    finally { setEnrolling(false); }
  }

  async function openReceipt() {
    try {
      const blob = guest ? await api.guestReceipt(orderId, gtoken!) : await api.payReceipt(orderId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError(t("pay.receiptFail")); }
  }

  // Invité sans jeton local (lien perdu, autre appareil) : on n'expose rien —
  // l'e-mail reçu (reçu + lien de connexion) reste la voie d'accès.
  if (guest && !gtoken) {
    return (
      <div className="stack">
        <h1>{t("pay.orderTitle")}</h1>
        <p className="banner offline">⚠️ {t("pay.orderLost")}</p>
        <button className="block secondary" onClick={() => navigate(routes.enrollments())}>{t("pay.goLogin")}</button>
      </div>
    );
  }

  if (error && !order) return <div><h1>{t("pay.orderTitle")}</h1><p className="banner offline">⚠️ {error}</p></div>;
  if (!order) return <div><h1>{t("pay.orderTitle")}</h1><div className="skeleton card" /></div>;

  return (
    <div className="stack">
      <h1>{t("pay.orderTitle")}</h1>
      <article className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>{order.product?.title ?? t("pay.orderTitle")}</h2>
          <span className={`chip ${order.status === "PAID" ? "ok" : ""}`}>
            {order.status === "PAID" ? t("pay.statusPaid") : order.status === "PENDING" ? t("pay.statusPending") : t("pay.statusFailed")}
          </span>
        </div>
        {error && <p className="banner offline">⚠️ {error}</p>}

        {order.status === "PENDING" && (
          <div style={{ marginTop: 10 }}>
            <p className="muted">{t("pay.pendingHint")}</p>
            {checkout?.instructions && <p className="banner" style={{ whiteSpace: "pre-wrap" }}>🏦 {checkout.instructions}</p>}
            {checkout?.paymentUrl && (
              <button className="block" onClick={() => { location.href = checkout.paymentUrl!; }}>{t("pay.payNow")}</button>
            )}
          </div>
        )}

        {order.status === "PAID" && (
          <div style={{ marginTop: 10 }}>
            <p className="banner" style={{ background: "var(--ok-bg, #E7F4EA)" }}>✅ {t("pay.paidHint")}</p>
            {guest ? (
              // Sans session : la connexion passe par le lien magique de l'e-mail.
              <p className="banner">📧 {t("pay.checkEmail")}</p>
            ) : (
              <button className="block" disabled={enrolling} onClick={() => void enterCourse()}>
                {enrolling ? t("enr.enrolling") : t("pay.enterCourse")}
              </button>
            )}
            <button className="block secondary" style={{ marginTop: 8 }} onClick={() => void openReceipt()}>{t("pay.receipt")}</button>
          </div>
        )}

        {(order.status === "FAILED" || order.status === "CANCELLED" || order.status === "REFUNDED") && (
          <div style={{ marginTop: 10 }}>
            <p className="banner offline">⚠️ {t("pay.failedHint")}</p>
            {order.product?.courseId && (
              <button className="block" onClick={() => navigate(routes.purchase(order.product!.courseId!))}>{t("pay.retry")}</button>
            )}
          </div>
        )}
      </article>
      <button className="block secondary" onClick={() => navigate(routes.enrollments())}>{guest ? t("pay.goLogin") : t("pay.back")}</button>
    </div>
  );
}
