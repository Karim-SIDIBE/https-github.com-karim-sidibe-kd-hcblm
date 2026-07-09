# Gabarits de certificats (fonds de page)

Déposer ici les fonds de certificat **vierges**, un par niveau :

```
niveau-1.png   (Fondamentaux certifiés — bleu)
niveau-2.png   (Avancé certifié — vert)
niveau-3.png   (Expert certifié — or)
```

(`.jpg` accepté aussi ; le `.png` est préféré. Sans fichier pour un niveau, le
serveur produit un certificat dessiné simple — l'émission ne casse jamais.)

## Spécification des fichiers

- **Format** : A4 paysage (ratio √2 ≈ 1,414), **≥ 2000 × 1414 px** (300 dpi ≈ 3508 × 2480 idéal).
- Le gabarit doit **contenir** : le titre, le badge du niveau, les libellés
  « Date de délivrance » / « N° de Licence » / « CEO and Founder » avec leurs
  filets, la signature, les logos et l'URL du pied de page.
- Le gabarit ne doit **PAS contenir** (le serveur les écrit par-dessus) :
  - le nom de l'apprenant (« Prénom et NOM de l'apprenant ») ;
  - le paragraphe d'attestation complet (« Cette certification atteste… ») —
    le nom de la formation et le domaine y sont insérés en gras au fil du texte ;
  - la valeur de la date (ex. « 11/07/2024 ») ;
  - la valeur du n° de licence (ex. « CPSA… »).

## Champs écrits par le serveur

| Champ | Source | Position (fraction de page) |
|---|---|---|
| Nom de l'apprenant | compte apprenant | centré, y ≈ 0,40 (couleur du niveau) |
| Paragraphe (formation + domaine en gras) | contenu du cours | centré, y ≈ 0,50–0,62 |
| Date de délivrance | date d'émission du credential | x ≈ 0,263 · y ≈ 0,765 |
| N° de licence | id unique du credential Open Badge | x ≈ 0,50 · y ≈ 0,765 |
| QR de vérification | URL du credential hébergé | coin droit, y ≈ 0,60 |

Les positions se calibrent dans `src/lib/credentials/pdf.ts` (constantes en
fractions de page) — ajuster après un premier rendu réel si besoin.
