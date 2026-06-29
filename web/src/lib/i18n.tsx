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
  // course
  "course.state.done": "Terminé", "course.state.locked": "🔒 Verrouillé", "course.state.inProgress": "En cours",
  "course.title": "Le parcours", "course.unavailable": "Parcours indisponible (hors-ligne et non rendu disponible).",
  "course.priorities": "🎯 Vos priorités d'apprentissage",
  "course.ms_s": "micro-session", "course.ms_p": "micro-sessions",
  "course.la_s": "activité longue", "course.la_p": "activités longues",
  "course.mt_s": "micro-tâche", "course.mt_p": "micro-tâches",
  "course.markDone": "Terminé", "course.availOffline": "✓ Disponible hors ligne · {days} j",
  "course.remove": "Retirer", "course.makeOffline": "⤓ Rendre disponible hors ligne",
  "course.availMsg": "« {label} » disponible hors ligne ({cached}/{total}) · 7 jours.",
  "course.availMsgSimple": "« {label} » disponible hors ligne · 7 jours.",
  // onboarding
  "ob.invalidPeer": "Indiquez un nom et un e-mail valides.", "ob.step": "Bloc 0 · Étape {n} sur 3",
  "ob.startingPoint": "Votre point de départ", "ob.pamTag": "🎯 Moment d'Ancrage",
  "ob.pamPlaceholder": "Décrivez votre situation professionnelle réelle…", "ob.saveContinue": "Enregistrer et continuer →",
  "ob.objective": "🎯 Objectif du parcours", "ob.whichProfile": "Quel profil vous correspond le mieux ?", "ob.continue": "Continuer →",
  "ob.peerTitle": "Votre pair de progression", "ob.peerDescPre": "Choisissez une personne qui sera informée de vos réussites. ",
  "ob.peerMandatory": "Étape obligatoire", "ob.peerDescPost": " — la responsabilisation sociale fait partie du parcours.",
  "ob.name": "Nom", "ob.namePh": "Nom du collègue / mentor", "ob.email": "E-mail", "ob.emailPh": "email@exemple.com",
  "ob.validate": "Valider et débloquer le badge d'entrée", "ob.medal": "Entré", "ob.doneTitle": "Bloc 0 terminé",
  "ob.doneDesc": "Votre badge d'entrée est débloqué. Vous pouvez commencer le parcours.", "ob.startCourse": "Commencer le parcours →",
  // session
  "sess.unavailableOffline": "Parcours indisponible hors-ligne.", "sess.triggerVideo": "Vidéo déclencheur",
  "sess.thisSession": "⏱️ Cette micro-session : {dur}", "sess.recall": "↩︎ Rappel — {title}", "sess.keyTakeaway": "À retenir",
  "sess.videoUnavailable": "⚠️ La vidéo n'est pas disponible pour le moment. Vous pouvez tout de même poursuivre la micro-session.",
  "sess.skipExercise": "Passer à l'exercice →", "sess.finishSession": "Terminer la micro-session →",
  // shared
  "nav.backCourse": "← Le parcours", "common.continue": "Continuer →", "home.remaining": "Il reste {dur}",
  "mission": "🎯 Votre mission", "answerPlaceholder": "Votre réponse, ancrée dans votre situation réelle…",
  // quiz
  "qz.diagnostic": "Quiz diagnostique", "qz.interblock": "Quiz interbloc", "qz.final": "Quiz final",
  "qz.unavailable": "Quiz indisponible.", "qz.profileTitle": "Votre profil de compétence",
  "qz.priorities": "Vos 2 priorités d'apprentissage", "qz.score": "Score : {correct}/{total}",
  "qz.finalPassed": "Quiz final réussi !", "qz.finalNotYet": "Pas encore atteint",
  "qz.thresholdPill": "{pct}% · seuil {threshold}%", "qz.finalPassedDesc": "Le bloc de certification est débloqué.",
  "qz.finalFailDesc": "Reprenez les sessions du bloc puis retentez.",
  "qz.consolidationDone": "Consolidation terminée", "qz.correctCount": "{correct}/{total} bonnes réponses",
  // journal
  "jr.eyebrow": "Journal de bord", "jr.title": "Ancrer mes acquis",
  "jr.intro": "Une micro-entrée à des intervalles clés, ancrée dans votre situation réelle (votre Moment d'Ancrage).",
  "jr.day": "Jour J+{n}",
  // badges
  "bd.eyebrow": "Vos badges", "bd.title": "Progression certifiante", "bd.obtained": "Obtenu",
  "bd.entry": "Badge Entrée", "bd.comprehension": "Badge Compréhension", "bd.practice": "Badge Pratique", "bd.anchoring": "Badge Ancrage",
  "bd.addLinkedIn": "Ajouter à LinkedIn", "bd.verify": "Vérifier", "bd.certOf": "Certificat de {level}",
  "bd.publicVerify": "Vérification publique", "bd.submitProject": "Déposer mon projet du Bloc 4 →",
  // deliverable
  "dl.fieldEyebrow": "Application terrain — obligatoire", "dl.fieldTitle": "Application terrain",
  "dl.journalTitle": "Journal — Jour {key}", "dl.unitChars": "caractères", "dl.unitWords": "mots",
  "dl.notFound": "Élément introuvable.", "dl.submit": "Soumettre →",
  // project
  "pj.unavailable": "Projet indisponible.", "pj.eyebrow": "Bloc 4 · Certification", "pj.title": "Projet de certification",
  "pj.st.submitted": "Soumis — en attente d'attribution", "pj.st.assigned": "En cours d'évaluation",
  "pj.st.passed": "Validé 🎓", "pj.st.revision": "Révision demandée",
  "pj.submittedOn": "Soumis le {date}", "pj.evaluator": "Évaluateur : {name}",
  "pj.scoreLine": "Score : {score}/100", "pj.scoreThreshold": "(seuil {threshold})", "pj.evalFeedback": "Retour de l'évaluateur",
  "pj.rubricTitle": "Grille d'évaluation", "pj.rubricNote": "(visible avant de soumettre)",
  "pj.pts": "{n} pts", "pj.passThreshold": "Seuil de réussite : {threshold}/100",
  "pj.submit": "Soumettre mon projet →", "pj.complete5": "Complétez les 5 sections pour soumettre.",
  // exercise
  "ex.eyebrow": "Micro-exercice — obligatoire", "ex.validate": "Valider ma réponse",
  "ex.correct": "✓ Bonne réponse", "ex.review": "À revoir", "ex.feedback": "Feedback immédiat", "ex.next": "Session suivante →",
  // revision
  "rev.eyebrow": "Révision personnalisée", "rev.title": "Vos points faibles",
  "rev.noQuiz": "Passez d'abord le quiz diagnostique pour obtenir une révision personnalisée.",
  "rev.noErrors": "🎉 Aucune erreur au diagnostique — rien à réviser pour l'instant !",
  "rev.intro": "Les questions ratées au diagnostique. Relisez la bonne réponse et l'explication pour renforcer vos acquis (sans note).",
  "rev.goodAnswer": " — bonne réponse", "rev.yourAnswer": " — votre réponse", "rev.why": "Pourquoi", "rev.resume": "Reprendre le parcours →",
  // video player
  "vp.speed": "Vitesse", "vp.speedAria": "Vitesse de lecture", "vp.quality": "Qualité", "vp.auto": "Auto",
  "vp.source": "Source (max)", "vp.720p": "720p (HD)", "vp.480p": "480p", "vp.240p": "240p — éco data", "vp.audio": "Audio seul",
  // course item labels
  "ci.onboarding": "Introduction & point de départ", "ci.case": "Étude de cas", "ci.scenarios": "Mises en situation guidées",
  "ci.self": "Auto-évaluation", "ci.plan": "Plan d'action 30 jours", "ci.journal": "Journal J+{day}",
  // quiz component (one question at a time)
  "quiz.q": "Question {n} / {total}", "quiz.validate": "Valider", "quiz.good": "✓ Bonne réponse", "quiz.review": "À revoir",
  "quiz.seeResult": "Voir mon résultat →", "quiz.nextQuestion": "Question suivante →",
  "quiz.multiHint": "Plusieurs réponses possibles", "quiz.true": "Vrai", "quiz.false": "Faux",
  "quiz.numPlaceholder": "Votre réponse (nombre)", "quiz.expected": "Réponse attendue : {n}",
  "quiz.shortPlaceholder": "Votre réponse", "quiz.accepted": "Réponses acceptées : {list}",
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
  "course.state.done": "Completed", "course.state.locked": "🔒 Locked", "course.state.inProgress": "In progress",
  "course.title": "The course", "course.unavailable": "Course unavailable (offline and not made available).",
  "course.priorities": "🎯 Your learning priorities",
  "course.ms_s": "micro-session", "course.ms_p": "micro-sessions",
  "course.la_s": "long activity", "course.la_p": "long activities",
  "course.mt_s": "micro-task", "course.mt_p": "micro-tasks",
  "course.markDone": "Done", "course.availOffline": "✓ Available offline · {days}d",
  "course.remove": "Remove", "course.makeOffline": "⤓ Make available offline",
  "course.availMsg": "“{label}” available offline ({cached}/{total}) · 7 days.",
  "course.availMsgSimple": "“{label}” available offline · 7 days.",
  "ob.invalidPeer": "Enter a valid name and e-mail.", "ob.step": "Block 0 · Step {n} of 3",
  "ob.startingPoint": "Your starting point", "ob.pamTag": "🎯 Anchor Moment",
  "ob.pamPlaceholder": "Describe your real work situation…", "ob.saveContinue": "Save and continue →",
  "ob.objective": "🎯 Course objective", "ob.whichProfile": "Which profile fits you best?", "ob.continue": "Continue →",
  "ob.peerTitle": "Your progress peer", "ob.peerDescPre": "Choose someone who will be told about your achievements. ",
  "ob.peerMandatory": "Mandatory step", "ob.peerDescPost": " — social accountability is part of the journey.",
  "ob.name": "Name", "ob.namePh": "Colleague / mentor name", "ob.email": "Email", "ob.emailPh": "email@example.com",
  "ob.validate": "Confirm and unlock the entry badge", "ob.medal": "In", "ob.doneTitle": "Block 0 completed",
  "ob.doneDesc": "Your entry badge is unlocked. You can start the course.", "ob.startCourse": "Start the course →",
  "sess.unavailableOffline": "Course unavailable offline.", "sess.triggerVideo": "Trigger video",
  "sess.thisSession": "⏱️ This micro-session: {dur}", "sess.recall": "↩︎ Recap — {title}", "sess.keyTakeaway": "Key takeaway",
  "sess.videoUnavailable": "⚠️ The video isn't available right now. You can still continue the micro-session.",
  "sess.skipExercise": "Skip to the exercise →", "sess.finishSession": "Finish the micro-session →",
  "nav.backCourse": "← The course", "common.continue": "Continue →", "home.remaining": "{dur} left",
  "mission": "🎯 Your mission", "answerPlaceholder": "Your answer, grounded in your real situation…",
  "qz.diagnostic": "Diagnostic quiz", "qz.interblock": "Inter-block quiz", "qz.final": "Final quiz",
  "qz.unavailable": "Quiz unavailable.", "qz.profileTitle": "Your competency profile",
  "qz.priorities": "Your 2 learning priorities", "qz.score": "Score: {correct}/{total}",
  "qz.finalPassed": "Final quiz passed!", "qz.finalNotYet": "Not reached yet",
  "qz.thresholdPill": "{pct}% · threshold {threshold}%", "qz.finalPassedDesc": "The certification block is unlocked.",
  "qz.finalFailDesc": "Revisit the block's sessions then try again.",
  "qz.consolidationDone": "Consolidation complete", "qz.correctCount": "{correct}/{total} correct answers",
  "jr.eyebrow": "Logbook", "jr.title": "Anchor my learning",
  "jr.intro": "A micro-entry at key intervals, grounded in your real situation (your Anchor Moment).",
  "jr.day": "Day D+{n}",
  "bd.eyebrow": "Your badges", "bd.title": "Certification progress", "bd.obtained": "Earned",
  "bd.entry": "Entry badge", "bd.comprehension": "Comprehension badge", "bd.practice": "Practice badge", "bd.anchoring": "Anchoring badge",
  "bd.addLinkedIn": "Add to LinkedIn", "bd.verify": "Verify", "bd.certOf": "Certificate of {level}",
  "bd.publicVerify": "Public verification", "bd.submitProject": "Submit my Block 4 project →",
  "dl.fieldEyebrow": "Field application — mandatory", "dl.fieldTitle": "Field application",
  "dl.journalTitle": "Logbook — Day {key}", "dl.unitChars": "characters", "dl.unitWords": "words",
  "dl.notFound": "Item not found.", "dl.submit": "Submit →",
  "pj.unavailable": "Project unavailable.", "pj.eyebrow": "Block 4 · Certification", "pj.title": "Certification project",
  "pj.st.submitted": "Submitted — awaiting assignment", "pj.st.assigned": "Being evaluated",
  "pj.st.passed": "Passed 🎓", "pj.st.revision": "Revision requested",
  "pj.submittedOn": "Submitted on {date}", "pj.evaluator": "Evaluator: {name}",
  "pj.scoreLine": "Score: {score}/100", "pj.scoreThreshold": "(threshold {threshold})", "pj.evalFeedback": "Evaluator feedback",
  "pj.rubricTitle": "Evaluation rubric", "pj.rubricNote": "(visible before submitting)",
  "pj.pts": "{n} pts", "pj.passThreshold": "Pass threshold: {threshold}/100",
  "pj.submit": "Submit my project →", "pj.complete5": "Complete all 5 sections to submit.",
  "ex.eyebrow": "Micro-exercise — mandatory", "ex.validate": "Submit my answer",
  "ex.correct": "✓ Correct answer", "ex.review": "Needs review", "ex.feedback": "Immediate feedback", "ex.next": "Next session →",
  "rev.eyebrow": "Personalised review", "rev.title": "Your weak areas",
  "rev.noQuiz": "Take the diagnostic quiz first to get a personalised review.",
  "rev.noErrors": "🎉 No mistakes in the diagnostic — nothing to review for now!",
  "rev.intro": "The questions you missed in the diagnostic. Re-read the correct answer and the explanation to reinforce your learning (ungraded).",
  "rev.goodAnswer": " — correct answer", "rev.yourAnswer": " — your answer", "rev.why": "Why", "rev.resume": "Resume the course →",
  "vp.speed": "Speed", "vp.speedAria": "Playback speed", "vp.quality": "Quality", "vp.auto": "Auto",
  "vp.source": "Source (max)", "vp.720p": "720p (HD)", "vp.480p": "480p", "vp.240p": "240p — data saver", "vp.audio": "Audio only",
  "ci.onboarding": "Introduction & starting point", "ci.case": "Case study", "ci.scenarios": "Guided scenarios",
  "ci.self": "Self-assessment", "ci.plan": "30-day action plan", "ci.journal": "Logbook D+{day}",
  "quiz.q": "Question {n} / {total}", "quiz.validate": "Submit", "quiz.good": "✓ Correct", "quiz.review": "Needs review",
  "quiz.seeResult": "See my result →", "quiz.nextQuestion": "Next question →",
  "quiz.multiHint": "Multiple answers possible", "quiz.true": "True", "quiz.false": "False",
  "quiz.numPlaceholder": "Your answer (a number)", "quiz.expected": "Expected answer: {n}",
  "quiz.shortPlaceholder": "Your answer", "quiz.accepted": "Accepted answers: {list}",
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
