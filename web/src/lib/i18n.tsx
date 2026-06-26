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
  // levels / common
  "common.loading": "Chargement…", "common.error": "Erreur",
  "level.1": "Niveau 1", "level.2": "Niveau 2", "level.3": "Niveau 3",
  // enrolments list
  "enr.myCourses": "Mes parcours",
  "enr.loadError": "Impossible de charger vos parcours (hors-ligne ?).",
  "enr.offlineAvailable": "Parcours disponibles hors-ligne :",
  "enr.open": "Ouvrir {id}…",
  "enr.none": "Vous n'êtes encore inscrit·e à aucun parcours. Choisissez-en un ci-dessous 👇",
  "enr.certified": "Certifié 🎓", "enr.blocks": "{done}/{total} blocs · {pct}%",
  "enr.available": "Parcours disponibles", "enr.enrollOneClick": "Inscrivez-vous en un clic.",
  "enr.enrolling": "Inscription…", "enr.enroll": "S'inscrire →", "enr.enrollFail": "Inscription impossible",
  // account
  "acc.title": "Mon compte & confidentialité", "acc.consents": "Mes consentements", "acc.required": " (requis)",
  "acc.accepted": "Accepté", "acc.acceptedOn": " le {date}", "acc.notAccepted": "Non accepté",
  "acc.consentsNote": "Les consentements requis ne peuvent être retirés ici : cela reviendrait à supprimer le compte.",
  "acc.myData": "Mes données",
  "acc.myDataDesc": "Téléchargez une copie de toutes vos données (profil, progression, journal…) au format JSON — droit d'accès et portabilité.",
  "acc.export": "⬇ Exporter mes données",
  "acc.exported": "Vos données ont été téléchargées (mes-donnees.json).",
  "acc.deleteTitle": "Supprimer mon compte",
  "acc.deleteDesc": "Votre compte sera bloqué immédiatement puis effacé après 30 jours. Réversible pendant ce délai via le support.",
  "acc.deleteConfirm": "Supprimer votre compte ?\n\nIl sera bloqué immédiatement, puis effacé après un délai de grâce de 30 jours. Contactez le support avant cette date pour annuler.",
  "acc.deleteScheduled": "Votre compte a été programmé pour suppression. Vous êtes maintenant déconnecté.",
  // home
  "home.hello": "Bonjour {name}", "home.resume": "Reprendre", "home.block": "Bloc {n}",
  "home.exactResume": "↺ Reprise exacte", "home.video": "vidéo {time}", "home.resumeBtn": "Reprendre →",
  "home.courseDone": "Parcours terminé 🎓",
  "home.priorities": "🎯 Vos axes prioritaires", "home.prioritiesDesc": "D'après votre diagnostic, concentrez-vous sur :",
  "home.review": "Réviser mes points faibles →", "home.goToCourse": "Aller au cours",
  "home.progress": "Progression", "home.blocksCount": "{done} / {total} blocs",
  "home.prodScore": "Score de productivité", "home.prodDesc": "Monte à chaque exercice complété",
  "home.yourPath": "Votre parcours", "home.peer": "Pair de progression", "home.notified": "✓ Notifié",
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
  "common.loading": "Loading…", "common.error": "Error",
  "level.1": "Level 1", "level.2": "Level 2", "level.3": "Level 3",
  "enr.myCourses": "My courses",
  "enr.loadError": "Couldn't load your courses (offline?).",
  "enr.offlineAvailable": "Courses available offline:",
  "enr.open": "Open {id}…",
  "enr.none": "You're not enrolled in any course yet. Pick one below 👇",
  "enr.certified": "Certified 🎓", "enr.blocks": "{done}/{total} blocks · {pct}%",
  "enr.available": "Available courses", "enr.enrollOneClick": "Enrol in one click.",
  "enr.enrolling": "Enrolling…", "enr.enroll": "Enrol →", "enr.enrollFail": "Enrolment failed",
  "acc.title": "My account & privacy", "acc.consents": "My consents", "acc.required": " (required)",
  "acc.accepted": "Accepted", "acc.acceptedOn": " on {date}", "acc.notAccepted": "Not accepted",
  "acc.consentsNote": "Required consents can't be withdrawn here: that would amount to deleting the account.",
  "acc.myData": "My data",
  "acc.myDataDesc": "Download a copy of all your data (profile, progress, journal…) as JSON — right of access and portability.",
  "acc.export": "⬇ Export my data",
  "acc.exported": "Your data has been downloaded (mes-donnees.json).",
  "acc.deleteTitle": "Delete my account",
  "acc.deleteDesc": "Your account will be blocked immediately, then erased after 30 days. Reversible during that period via support.",
  "acc.deleteConfirm": "Delete your account?\n\nIt will be blocked immediately, then erased after a 30-day grace period. Contact support before that date to cancel.",
  "acc.deleteScheduled": "Your account has been scheduled for deletion. You are now logged out.",
  "home.hello": "Hello {name}", "home.resume": "Resume", "home.block": "Block {n}",
  "home.exactResume": "↺ Exact resume", "home.video": "video {time}", "home.resumeBtn": "Resume →",
  "home.courseDone": "Course completed 🎓",
  "home.priorities": "🎯 Your priority areas", "home.prioritiesDesc": "Based on your diagnostic, focus on:",
  "home.review": "Review my weak areas →", "home.goToCourse": "Go to the course",
  "home.progress": "Progress", "home.blocksCount": "{done} / {total} blocks",
  "home.prodScore": "Productivity score", "home.prodDesc": "Rises with each completed exercise",
  "home.yourPath": "Your path", "home.peer": "Progress peer", "home.notified": "✓ Notified",
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
