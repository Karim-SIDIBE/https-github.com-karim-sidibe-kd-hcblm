# Politique de sécurité

La sécurité des données des apprenants est une priorité de KOMPETENCES DECLICK.

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique pour une faille de sécurité.

- Écrivez à **security@declick.digital** (à configurer ; à défaut, contactez
  directement le mainteneur du dépôt).
- Décrivez la vulnérabilité, son impact et, si possible, une preuve de concept.
- Nous accusons réception sous **72 h** et visons un correctif coordonné.

Merci de nous laisser un délai raisonnable de remédiation avant toute divulgation
publique (divulgation coordonnée).

## Portée

- Le **backend** (`server/`) et les **front-ends** (`web/`, `admin/`, `entreprise/`).
- Le périmètre d'audit prioritaire couvre les couches 1 et 2 (cf.
  `docs/architecture/0001-lms-foundation-build-vs-buy.md`).

## Pratiques en place (extrait)

Hash argon2, JWT ES256 (jose), validation Zod, Prisma (requêtes paramétrées),
RBAC + ownership, rate-limit + lockout, audit log, en-têtes de sécurité (helmet),
CI avec typecheck/tests/audit de dépendances + analyse statique CodeQL.

Voir `docs/architecture/0003-security-audit-vs-moodle.md` (posture & écarts) et
`docs/architecture/0004-modern-lms-security-baseline.md` (référentiel cible).

## Versions supportées

La branche `main` reçoit les correctifs de sécurité.
