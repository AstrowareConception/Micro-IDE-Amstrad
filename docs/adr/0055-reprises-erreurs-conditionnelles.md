# ADR 0055 — Reprises d’erreur dans les branches conditionnelles

- Statut : accepté
- Date : 2026-10-08
- Portée : alpha 0.40.6, REQ-EDT-008 / ACC-36, IDE-076 partiel

## Contexte

La 0.40.5 exclut les ERROR conditionnels : RESUME NEXT dans ELSE ne suit pas nécessairement l’instruction ERROR. Les essais supplémentaires montrent que le firmware mémorise parfois le IF englobant. Utiliser le seul successeur lexical d’ERROR donnerait une destination incorrecte.

## Décision

Conserver, pendant la construction, le début d’instruction hérité par la première instruction de chaque branche. Seul un deux-points exécuté le renouvelle ; les séparateurs d’une branche ignorée ne le changent pas. Résoudre RESUME vers ce début et RESUME NEXT par recherche du premier séparateur depuis ce début. ELSE/fin de ligne rejoignent la ligne suivante ; deux-points rejoint l’instruction suivante, même dans une autre branche. Protéger chaînes, DATA et commentaires. Une destination non reconnue suspend les conclusions contextuelles.

Ce calcul reste interne au domaine. Le parcours des contextes conserve l’ERROR déclencheur, le gestionnaire et les destinations corrélées ; il n’évalue aucune condition ni expression. RESUME ligne conserve sa cible. Les libellés mentionnent l’instruction mémorisée. Les formats flow 4 / errorFlow 1 et les quotas ne changent pas.

## Preuves et limites

[51 nouvelles assertions sur le firmware identifié](../implementation/basic-control-flow-alpha.md#qualification-0406), comparaison des destinations dans les tests de domaine, navigation/exports/obsolescence dans le vrai worker Chromium. L’exemple affiche 1, 0, 98 et expose une reprise vers une branche ignorée.

Lève uniquement l’exclusion des ERROR conditionnels de l’[ADR 0054](0054-contextes-erreurs-explicites.md). Codes ERROR décimaux littéraux 1 à 255, IF jusqu’à 16 niveaux ; erreurs implicites, appels/RETURN, FOR/NEXT, événements asynchrones et formes opaques restent exclus. Conclusions globales suspendues ; aucune qualification matérielle ou indépendante supplémentaire.
