/**
 * i18n.tsx — tiny, dependency-free internationalisation for the learner PWA.
 *
 * Matches the app's lean philosophy (no heavy i18n library, like the hand-rolled
 * router). A flat dictionary per language, a `t(key, vars?)` lookup with `{var}`
 * interpolation, the choice persisted in localStorage and detected from the
 * browser on first run. Missing keys fall back to French, then to the key.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";
const LS_KEY = "klms_lang";

type Dict = Record<string, string>;

const fr: Dict = {
  // shell / navigation
  "nav.home": "Accueil", "nav.cours": "Cours", "nav.journal": "Journal", "nav.badges": "Badges",
  "nav.account": "Mon compte", "nav.logout": "Déconnexion",
  "brand.operatedBy": "Opéré par {operator}", "brand.myCourses": "Mes parcours",
  "banner.offline": "⚠️ Hors-ligne — votre progression est enregistrée et se synchronisera automatiquement.",
  "banner.syncing": "⟳ Synchronisation…", "a11y.notifications": "Notifications",
  // common
  "common.back": "Retour", "common.optional": "(optionnel)", "ph.email": "vous@exemple.com",
  // login
  "login.subtitle": "Connexion apprenant · opéré par {operator}",
  "login.email": "Email", "login.password": "Mot de passe", "login.signIn": "Se connecter",
  "login.forgot": "Mot de passe oublié ?", "login.noAccount": "Pas encore de compte ?",
  "login.create": "Créer un compte", "login.invalid": "Identifiants invalides",
  "login.unverified": "Votre e-mail n'est pas encore vérifié. Saisissez le code reçu (ou renvoyez-en un).",
  // signup
  "signup.subtitle": "Créer un compte · opéré par {operator}",
  "signup.fullName": "Nom complet", "signup.phone": "Téléphone",
  "signup.passwordMin": "10 caractères minimum",
  "signup.acceptPre": "J'accepte les ", "signup.terms": "conditions d'utilisation",
  "signup.and": " et la ", "signup.privacy": "politique de confidentialité",
  "signup.marketing": "J'accepte de recevoir des informations sur les offres et nouveautés",
  "signup.create": "Créer mon compte", "signup.already": "Déjà inscrit ?",
  "signup.mustAccept": "Vous devez accepter les conditions d'utilisation et la politique de confidentialité.",
  "signup.codeSent": "Un code de vérification a été envoyé à {email}.",
  "signup.fail": "Inscription impossible",
  // verify
  "verify.title": "Vérification", "verify.code": "Code de vérification", "verify.codePh": "6 chiffres",
  "verify.submit": "Vérifier et se connecter", "verify.resend": "Renvoyer le code",
  "verify.resent": "Nouveau code envoyé. Vérifiez votre boîte mail (et les indésirables).",
  "verify.invalid": "Code invalide",
  // forgot / reset
  "forgot.title": "Mot de passe oublié",
  "forgot.intro": "Saisissez votre e-mail : nous vous enverrons un code pour définir un nouveau mot de passe.",
  "forgot.send": "Envoyer le code",
  "forgot.sent": "Si un compte existe pour {email}, un code de réinitialisation a été envoyé.",
  "reset.title": "Nouveau mot de passe", "reset.codeReceived": "Code reçu",
  "reset.submit": "Réinitialiser et se connecter", "reset.resent": "Nouveau code envoyé.",
  "reset.fail": "Réinitialisation impossible",
  // install prompt
  "install.title": "Installer l'app", "install.sub": "Accès rapide, plein écran, hors-ligne.",
  "install.ios": "Appuyez sur Partager ⬆️ puis « Sur l'écran d'accueil ».",
  "install.cta": "Installer", "install.close": "Fermer", "install.aria": "Installer l'application",
};

const en: Dict = {
  "nav.home": "Home", "nav.cours": "Course", "nav.journal": "Journal", "nav.badges": "Badges",
  "nav.account": "My account", "nav.logout": "Log out",
  "brand.operatedBy": "Operated by {operator}", "brand.myCourses": "My courses",
  "banner.offline": "⚠️ Offline — your progress is saved and will sync automatically.",
  "banner.syncing": "⟳ Syncing…", "a11y.notifications": "Notifications",
  "common.back": "Back", "common.optional": "(optional)", "ph.email": "you@example.com",
  "login.subtitle": "Learner sign-in · operated by {operator}",
  "login.email": "Email", "login.password": "Password", "login.signIn": "Sign in",
  "login.forgot": "Forgot password?", "login.noAccount": "No account yet?",
  "login.create": "Create an account", "login.invalid": "Invalid credentials",
  "login.unverified": "Your e-mail is not verified yet. Enter the code you received (or request a new one).",
  "signup.subtitle": "Create an account · operated by {operator}",
  "signup.fullName": "Full name", "signup.phone": "Phone",
  "signup.passwordMin": "10 characters minimum",
  "signup.acceptPre": "I accept the ", "signup.terms": "terms of use",
  "signup.and": " and the ", "signup.privacy": "privacy policy",
  "signup.marketing": "I agree to receive information about offers and news",
  "signup.create": "Create my account", "signup.already": "Already registered?",
  "signup.mustAccept": "You must accept the terms of use and the privacy policy.",
  "signup.codeSent": "A verification code was sent to {email}.",
  "signup.fail": "Sign-up failed",
  "verify.title": "Verification", "verify.code": "Verification code", "verify.codePh": "6 digits",
  "verify.submit": "Verify and sign in", "verify.resend": "Resend code",
  "verify.resent": "New code sent. Check your inbox (and spam folder).",
  "verify.invalid": "Invalid code",
  "forgot.title": "Forgot password",
  "forgot.intro": "Enter your e-mail: we'll send you a code to set a new password.",
  "forgot.send": "Send code",
  "forgot.sent": "If an account exists for {email}, a reset code has been sent.",
  "reset.title": "New password", "reset.codeReceived": "Code received",
  "reset.submit": "Reset and sign in", "reset.resent": "New code sent.",
  "reset.fail": "Reset failed",
  "install.title": "Install the app", "install.sub": "Quick access, full screen, offline.",
  "install.ios": "Tap Share ⬆️ then “Add to Home Screen”.",
  "install.cta": "Install", "install.close": "Close", "install.aria": "Install the application",
};

const DICTS: Record<Lang, Dict> = { fr, en };

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch { /* no storage */ }
  return (navigator.language || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: TFn }>({
  lang: "fr", setLang: () => {}, t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { try { localStorage.setItem(LS_KEY, l); } catch { /* quota */ } setLangState(l); };
  const t: TFn = (key, vars) => {
    let s = DICTS[lang][key] ?? fr[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    return s;
  };
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
export function useT(): TFn { return useContext(I18nContext).t; }
