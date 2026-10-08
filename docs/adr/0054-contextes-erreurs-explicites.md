# ADR 0054 — Contextes bornés des erreurs BASIC explicites

- Statut : accepté
- Date : 2026-10-08
- Portée : alpha 0.40.5, REQ-EDT-008 / ACC-36, IDE-076 partiel

## Contexte

La cartographie 0.40.4 identifie les gestionnaires sans suivre leur état ni relier RESUME à l’instruction interrompue. Un même gestionnaire peut servir plusieurs erreurs ; fusionner les continuations indépendamment de leur contexte inventerait des chemins.

## Décision

Ajouter un parcours fini des triplets (instruction, gestionnaire, ERROR interrompu), distinct du graphe principal. Initialiser le piège désactivé ; suivre ON ERROR, les erreurs explicites et les reprises sans évaluer les conditions. Conserver les corrélations jusqu’au transfert. Ne pas convertir ces résultats en complexité ou inaccessibilité globale.

Limiter le modèle aux ERROR décimaux littéraux de 1 à 255 hors IF, sans appels/RETURN, FOR/NEXT, événements asynchrones ni construction incertaine. Une reprise sans ERROR explicite actif est hors périmètre. Les erreurs implicites sont exclues, y compris celles que les expressions pourraient produire.

8192 états, 131072 transitions et 4096 transferts par source ; 65536 états pour le rapport. Les états déjà vus assurent la convergence des reprises. Les dépassements retirent intégralement les résultats contextuels incomplets ; la carte structurelle reste disponible. Les limites d’affichage sont explicites.

Le sous-format flow passe en version 4, avec errorFlow version 1, scope explicit-error et statuts not-needed/covered/unsupported/limited. Aucun changement du projet ni du rapport englobant version 2. Les données exportées sont des identifiants, emplacements, états et types de transfert, sans code source ni arguments.

## Qualification et conséquences

[Sept assertions firmware et trois observations négatives bornées](../implementation/basic-control-flow-alpha.md#qualification-0405), tests des quotas et vrai worker navigateur. La recette ELSE ne suit pas la continuation lexicale attendue après RESUME NEXT : tout ERROR conditionnel reste donc exclu, sans inventer sa sémantique. Les changements de gestionnaire dans un traitement, la relance par désactivation et l’erreur imbriquée sont qualifiés sur le jeu CPC 6128 anglais identifié.

Le statut Calculés désigne seulement ce modèle explicitement limité. Erreurs implicites, piles, événements et reprises conditionnelles nécessitent les incréments suivants ; aucune qualification indépendante ou matérielle supplémentaire.
