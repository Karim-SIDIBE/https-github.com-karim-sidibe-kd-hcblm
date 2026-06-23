import { useEffect, useState } from "react";

/**
 * "Add to home screen" prompt. Chrome/Android expose `beforeinstallprompt` (we
 * defer it and trigger on tap). iOS Safari has no such event, so we show a short
 * manual hint. Dismissal is remembered; never shown once already installed.
 */
type BipEvent = Event & { prompt: () => void; userChoice: Promise<unknown> };
const DISMISS_KEY = "kd_a2hs_dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BipEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return; // already installed → nothing to do

    const onBip = (e: Event) => { e.preventDefault(); setDeferred(e as BipEvent); setShow(true); };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS Safari: no install event → manual instructions (Share → Add to Home Screen).
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isSafari) { setIosHint(true); setShow(true); }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* quota */ } setShow(false); };
  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* dismissed */ }
    dismiss();
  }

  return (
    <div className="a2hs" role="dialog" aria-label="Installer l'application">
      <span aria-hidden style={{ fontSize: 20 }}>📲</span>
      <div className="a2hs-txt">
        <strong>Installer l'app</strong>
        <span>{iosHint ? "Appuyez sur Partager ⬆️ puis « Sur l'écran d'accueil »." : "Accès rapide, plein écran, hors-ligne."}</span>
      </div>
      {!iosHint && <button className="hf-btn hf-btn--primary hf-btn--sm" onClick={install}>Installer</button>}
      <button className="hf-btn hf-btn--ghost hf-btn--sm" onClick={dismiss} aria-label="Fermer">✕</button>
    </div>
  );
}
