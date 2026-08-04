/**
 * modal.tsx — in-app replacement for window.confirm / prompt / alert.
 *
 * Imperative API (awaitable, drop-in for the native calls):
 *   if (await modal.confirm({ title: "Supprimer ?", danger: true })) …
 *   const name = await modal.prompt({ title: "Nom de la vue" });
 *   await modal.alert({ title: "Export impossible", body: msg });
 *
 * <ModalHost/> must be mounted once (App). If it is not, the native dialogs
 * are used as a fallback so nothing ever blocks.
 */
import { useEffect, useRef, useState } from "react";

type ConfirmOpts = { title: string; body?: string; danger?: boolean; okLabel?: string };
type PromptOpts = { title: string; body?: string; label?: string; initial?: string; placeholder?: string; okLabel?: string };
type AlertOpts = { title: string; body?: string };

type Spec =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOpts)
  | ({ kind: "alert"; resolve: () => void } & AlertOpts);

let push: ((s: Spec) => void) | null = null;

export const modal = {
  confirm: (o: ConfirmOpts) =>
    new Promise<boolean>((resolve) => (push ? push({ kind: "confirm", ...o, resolve }) : resolve(window.confirm(o.body ? `${o.title}\n${o.body}` : o.title)))),
  prompt: (o: PromptOpts) =>
    new Promise<string | null>((resolve) => (push ? push({ kind: "prompt", ...o, resolve }) : resolve(window.prompt(o.title, o.initial ?? "")))),
  alert: (o: AlertOpts) =>
    new Promise<void>((resolve) => (push ? push({ kind: "alert", ...o, resolve }) : (window.alert(o.body ? `${o.title}\n${o.body}` : o.title), resolve()))),
};

export function ModalHost() {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    push = (s) => { setSpec(s); setValue(s.kind === "prompt" ? (s.initial ?? "") : ""); };
    return () => { push = null; };
  }, []);
  useEffect(() => { if (spec?.kind === "prompt") inputRef.current?.focus(); }, [spec]);

  if (!spec) return null;

  const close = () => setSpec(null);
  const cancel = () => { if (spec.kind === "confirm") spec.resolve(false); else if (spec.kind === "prompt") spec.resolve(null); else spec.resolve(); close(); };
  const ok = () => { if (spec.kind === "confirm") spec.resolve(true); else if (spec.kind === "prompt") spec.resolve(value); else spec.resolve(); close(); };
  const danger = spec.kind === "confirm" && spec.danger;

  return (
    <>
      <div className="scrim" style={{ zIndex: 60 }} onClick={cancel} />
      <div role="dialog" aria-modal="true" aria-label={spec.title}
        style={{ position: "fixed", zIndex: 61, top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(440px, calc(100vw - 32px))", background: "var(--card, #fff)", borderRadius: 14, boxShadow: "0 18px 60px rgba(10,20,40,.28)", padding: "20px 22px" }}
        onKeyDown={(e) => { if (e.key === "Escape") cancel(); if (e.key === "Enter" && spec.kind !== "alert") ok(); }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{spec.title}</h3>
        {spec.body && <p className="muted" style={{ margin: "0 0 12px", fontSize: 13, whiteSpace: "pre-wrap" }}>{spec.body}</p>}
        {spec.kind === "prompt" && (
          <label style={{ display: "block", margin: "10px 0 4px" }}>
            {spec.label && <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{spec.label}</span>}
            <input ref={inputRef} value={value} placeholder={spec.placeholder} onChange={(e) => setValue(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "9px 11px", fontFamily: "inherit", fontSize: 13.5 }} />
          </label>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          {spec.kind !== "alert" && <button className="btn" onClick={cancel}>Annuler</button>}
          <button className="btn btn--primary" autoFocus={spec.kind !== "prompt"}
            style={danger ? { background: "var(--danger)", borderColor: "var(--danger)" } : undefined} onClick={ok}>
            {(spec.kind !== "alert" && spec.okLabel) || (spec.kind === "confirm" ? (danger ? "Confirmer" : "OK") : spec.kind === "prompt" ? "Valider" : "Fermer")}
          </button>
        </div>
      </div>
    </>
  );
}
