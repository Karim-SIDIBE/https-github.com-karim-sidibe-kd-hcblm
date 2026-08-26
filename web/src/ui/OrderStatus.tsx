/**
 * OrderStatus.tsx — suivi d'une commande (spec paiement, lot PAY-2).
 * C'est aussi la page de RETOUR navigateur après un paiement hébergé — elle
 * n'accorde jamais l'accès elle-même : elle interroge le serveur (polling) et
 * ne débloque l'inscription que lorsque la commande est réellement PAID
 * (webhook vérifié, ou constat staff pour un virement).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/app";
import type { CheckoutInfo, PayOrder } from "../lib/api";
import { rememberEnrollment } from "../lib/autosync";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

export function OrderStatus({ orderId }: { orderId: string }) {
  const t = useT();
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function refresh() {
    try {
      const o = await api.payGetOrder(orderId);
      setOrder(o);
      if (o.status !== "PENDING" && pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      // En attente : (re)demander le checkout — idempotent — pour afficher les
      // références de virement ou le lien de paiement de l'agrégateur.
      if (o.status === "PENDING" && !checkout) setCheckout(await api.payCheckout(orderId).catch(() => null));
    } catch (e) { setError(e instanceof Error ? e.message : t("pay.loadError")); }
  }

  useEffect(() => {
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
      const blob = await api.payReceipt(orderId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError(t("pay.receiptFail")); }
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
            <button className="block" disabled={enrolling} onClick={() => void enterCourse()}>
              {enrolling ? t("enr.enrolling") : t("pay.enterCourse")}
            </button>
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
      <button className="block secondary" onClick={() => navigate(routes.enrollments())}>{t("pay.back")}</button>
    </div>
  );
}
