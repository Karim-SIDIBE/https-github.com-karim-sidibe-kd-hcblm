#!/usr/bin/env bash
# release-pi.sh — fige une version du code pour le dépôt de propriété
# intellectuelle (e-Soleau INPI, APP, BURIDA…) : tag → archive → empreinte.
#
#   bash deploy/release-pi.sh v1.0.0            # tag + archives dans ./releases-pi/
#   bash deploy/release-pi.sh v1.0.0 /chemin    # idem, vers un autre dossier
#
# Produit, pour la version demandée :
#   K-LMS-source-<version>-<date>.tar.gz        le code source complet au tag
#   corpus-K-HCBLM-<version>-<date>.tar.gz      les référentiels (docs/referentiels)
#   SHA256SUMS-<version>.txt                    les empreintes des deux archives
#   FICHE-<version>.txt                         la fiche d'identification (dates, commit, volumes)
#
# Le tag est créé s'il n'existe pas (annoté, sur HEAD). Rien n'est poussé :
# penser à `git push origin <version>` pour publier le tag.
set -euo pipefail

VERSION="${1:?usage : bash deploy/release-pi.sh vX.Y.Z [dossier de sortie]}"
case "$VERSION" in
  v[0-9]*) ;;
  *) echo "Erreur : la version doit être de la forme vX.Y.Z (reçu : $VERSION)" >&2; exit 1 ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
OUT="${2:-$ROOT/releases-pi}"
DATE="$(date +%Y%m%d)"
mkdir -p "$OUT"

cd "$ROOT"
if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
  echo "Tag $VERSION existant — archivage de ce tag."
else
  git tag -a "$VERSION" -m "Version $VERSION (dépôt PI du $DATE)"
  echo "Tag $VERSION créé sur HEAD ($(git rev-parse --short HEAD)). Ne pas oublier : git push origin $VERSION"
fi

COMMIT="$(git rev-parse "$VERSION^{commit}")"
SRC="$OUT/K-LMS-source-$VERSION-$DATE.tar.gz"
CORPUS="$OUT/corpus-K-HCBLM-$VERSION-$DATE.tar.gz"

git archive --format=tar.gz -o "$SRC" "$VERSION"
git archive --format=tar.gz -o "$CORPUS" "$VERSION" -- docs/referentiels

( cd "$OUT" && sha256sum "$(basename "$SRC")" "$(basename "$CORPUS")" > "SHA256SUMS-$VERSION.txt" )

# Fiche d'identification : les faits qu'un dépôt probant doit mentionner.
FILES=$(git ls-tree -r --name-only "$VERSION" | grep -cE '\.(ts|tsx)$' || true)
LINES=$(git ls-tree -r --name-only "$VERSION" | grep -E '\.(ts|tsx)$' | while read -r f; do git show "$VERSION:$f"; done | wc -l)
# tail (et non head) : head fermerait le tuyau et, avec pipefail, tuerait le script (SIGPIPE).
FIRST=$(git log --format=%as "$VERSION" | tail -1)
COUNT=$(git rev-list --count "$VERSION")
cat > "$OUT/FICHE-$VERSION.txt" <<EOF
FICHE D'IDENTIFICATION — K-LMS $VERSION (dépôt PI du $DATE)
Logiciel        : K-LMS — plateforme d'apprentissage certifiante (instance publique : DECLICK DIGITAL)
Titulaire visé  : KOMPETENCES SOFT SKILLS SAS
Version / tag   : $VERSION
Commit          : $COMMIT
Date du commit  : $(git log -1 --format=%ai "$VERSION")
Historique      : $COUNT commits depuis le $FIRST
Volume          : $FILES fichiers TypeScript, $LINES lignes (hors dépendances)
Archives        :
$(sed 's/^/  /' "$OUT/SHA256SUMS-$VERSION.txt")
Procédure       : déposer les archives TELLES QUELLES (sans les renommer) en
                  e-Soleau (inpi.fr) en citant les empreintes ci-dessus, et
                  conserver cette fiche avec l'accusé de dépôt.
EOF

echo
cat "$OUT/FICHE-$VERSION.txt"
echo
echo "Pièces prêtes dans : $OUT"
