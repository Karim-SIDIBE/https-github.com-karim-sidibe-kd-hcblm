# Checklist de test mobile — App apprenant (PWA)

**KOMPETENCES DECLICK** — _v1.1 — 7 juillet 2026 · complétée après : CSP en mode bloquant, sélecteur de qualité vidéo, hors‑ligne 7 jours, filigrane, révocation de sessions_

À dérouler sur 2 appareils réels : un Android (Chrome) et un iPhone (Safari)

**Pourquoi 2 appareils ?** Android Chrome et iOS Safari utilisent des moteurs différents (Blink vs WebKit). Tester les deux couvre l'essentiel du parc. Pour chaque ligne, coche la 1ʳᵉ case = Android, la 2ᵉ = iOS.

URL : https://app.declick.digital  —  utilise un compte apprenant de test.

_Les lignes 🆕 sont nouvelles en v1.1 (livraisons de juillet : CSP bloquante, qualité vidéo, hors‑ligne 7 j, filigrane, révocation de sessions)._


## 1. Installation & plein écran (PWA)

| Vérification | Attendu | Android / iOS |
|---|---|---|
| Ouvrir le site ; une bannière « Installer l'app » apparaît. | Bannière visible (Android : bouton Installer ; iOS : « Partager → Sur l'écran d'accueil »). | ☐ / ☐ |
| Installer l'app et l'ouvrir depuis l'écran d'accueil. | S'ouvre en plein écran, sans barre d'adresse du navigateur. | ☐ / ☐ |
| Fermer la bannière (✕) puis recharger. | La bannière ne réapparaît pas (mémorisée). | ☐ / ☐ |

## 2. Mise en page & lisibilité

| Vérification | Attendu | Android / iOS |
|---|---|---|
| Affichage général (accueil, cours, journal, badges). | Tout tient dans l'écran, pas de défilement horizontal. | ☐ / ☐ |
| Encoche / barre d'accueil (iPhone récent). | Le contenu n'est pas masqué par l'encoche ni la barre du bas. | ☐ / ☐ |
| Barre d'onglets en bas (Accueil/Cours/Journal/Badges). | Toujours visible, atteignable au pouce. | ☐ / ☐ |
| Taille du texte. | Lisible sans zoomer ; toucher un champ ne provoque pas de zoom. | ☐ / ☐ |
| 🆕 Bascule de langue FR → EN (en‑tête) puis retour FR. | Toute l'interface change de langue, sans écran cassé ; le choix est mémorisé. | ☐ / ☐ |

## 3. Cibles tactiles

| Vérification | Attendu | Android / iOS |
|---|---|---|
| Boutons (Reprendre, Continuer, vitesses vidéo, ✕, liens retour). | Faciles à toucher (≥ 44px), pas de clic à côté. | ☐ / ☐ |
| Cartes de micro-session (toucher pour ouvrir). | Réagissent au toucher, pas de flash gris disgracieux. | ☐ / ☐ |

## 4. Parcours & vidéo

| Vérification | Attendu | Android / iOS |
|---|---|---|
| Bloc 0 : Moment d'Ancrage → profil → pair → Badge d'entrée. | Saisie fluide ; objectif affiché APRÈS l'ancrage. | ☐ / ☐ |
| Bloc 0 : « Vidéo déclencheur » apparaît comme 2ᵉ item. | Visible et ouvrable. | ☐ / ☐ |
| Lecture d'une micro-session vidéo (liée + publiée). | La vidéo DÉMARRE et se lit ; sous-titres + vitesse OK. | ☐ / ☐ |
| 🆕 Sélecteur de qualité : forcer 720p, puis 480p, puis 240p‑éco, puis audio. | CHAQUE qualité démarre (pas seulement l'auto) ; la position de lecture est conservée au changement. | ☐ / ☐ |
| 🆕 Filigrane nominatif (nom / e‑mail) en surimpression sur la vidéo. | Visible, se déplace périodiquement, ne gêne pas la lecture. | ☐ / ☐ |
| Vidéo en plein écran (bouton ⛶) puis retour. | Plein écran OK, pas de bug d'affichage au retour. | ☐ / ☐ |
| Quitter une micro-session puis « Reprendre ». | Reprend au bon endroit. | ☐ / ☐ |

## 5. Hors-ligne & réseau faible

| Vérification | Attendu | Android / iOS |
|---|---|---|
| Activer le mode avion pendant une micro-session ouverte. | Bandeau « hors-ligne » ; la progression est gardée. | ☐ / ☐ |
| Réactiver le réseau. | Synchronisation automatique (bandeau « Synchronisation… »). | ☐ / ☐ |
| 🆕 « Rendre disponible hors‑ligne » (⤓) une micro‑session vidéo, PUIS mode avion. | La vidéo (version légère) se lit sans réseau ; l'échéance de disponibilité (7 jours) est affichée. | ☐ / ☐ |
| Connexion lente (3G / économiseur de données). | La vidéo se charge en version plus légère, sans bloquer. | ☐ / ☐ |

## 6. Compte & confidentialité

| Vérification | Attendu | Android / iOS |
|---|---|---|
| « Mon compte » → consentements, export, suppression. | Écran lisible ; actions fonctionnent. | ☐ / ☐ |
| Déconnexion puis reconnexion. | Progression conservée. | ☐ / ☐ |
| 🆕 Réinitialiser le mot de passe depuis l'appareil A, puis toucher l'app sur l'appareil B. | L'appareil B est déconnecté et redemande le nouveau mot de passe (révocation de sessions). | ☐ / ☐ |

## 7. Après la CSP bloquante (07/07)

| Vérification | Attendu | Android / iOS |
|---|---|---|
| 🆕 Balayage visuel complet : polices, icônes, images, vignettes, badges, certificats. | Rien de manquant ni de « muet » au toucher — un élément absent peut signaler un blocage CSP ; en cas de doute, brancher l'inspecteur distant (chrome://inspect / Safari) et chercher « Content Security Policy » en console. | ☐ / ☐ |

**Bilan : ____ / 25 vérifications OK.** Anomalies à signaler :

- …
- …
- …

_Astuce : si une vidéo ne démarre pas, vérifie côté admin que son aperçu (▶) dit « Prêt », qu'elle est liée à la micro-session et que le cours est publié, puis réinitialise l'apprenant. Si elle démarre dans UNE qualité mais pas dans une autre (ex. 480p OK, 720p muet), la rendition est probablement corrompue : contrôle-la avec ffprobe sur le serveur et régénère-la depuis la source (incident du 7 juillet, vidéos 1 et 2)._
