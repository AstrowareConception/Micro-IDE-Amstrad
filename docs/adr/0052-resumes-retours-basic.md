# ADR 0052 — Résumés structurels des retours BASIC

- Statut : accepté
- Date : 2026-10-08
- Portée : alpha 0.40.3, REQ-EDT-008 / ACC-36, IDE-076 partiel

## Contexte

Le graphe conservait une continuation après chaque GOSUB, y compris vers une routine qui termine par END. Cela gardait des instructions et décisions sans chemin depuis le début et empêchait de distinguer les retours des arrêts.

## Décision

Calculer un plus petit point fixe des chemins finis vers RETURN sur le graphe entièrement construit. RETURN initialise les faits ; les suites et branches propagent une alternative ; un GOSUB dépend conjointement du retour de sa cible et de sa continuation. ON GOSUB garde l’alternative hors liste. END, STOP et la fin du listing ne sont pas des retours. Une file de dépendances traite chaque liaison une seule fois ; aucun déroulement de pile ni itération quadratique sur toutes les entrées.

Retirer la liaison resume d’un GOSUB dont la cible n’a aucun chemin RETURN, puis calculer accessibilité, complexité et cycles sur ce graphe affiné. Les entrées portent returnStatus (possible/absent/unknown) ; le sous-format flow passe en version 2, sans changement du format de projet ni du rapport englobant version 2.

Toute incertitude de construction laisse les retours indéterminés et les continuations intactes. Les limites appliquées ensuite aux parcours locaux/entrées suspendent complexité et inaccessibilité globales, mais ne défont pas les résumés calculés indépendamment sur le graphe complet.

## Conséquences et preuves

La récursion avec cas de base conserve un retour possible, celle sans chemin fini n’en invente pas. Ce modèle reste une surapproximation des conditions et ne prouve ni validité de pile, ni terminaison, ni comportement sous CONT, erreurs ou événements. Les blocs partagés restent autorisés ; pas de somme des complexités des entrées.

Tests de domaine, vrai worker dans Chromium, six assertions positives et trois observations négatives bornées sur firmware CPC 6128 anglais : [qualification et limites](../implementation/basic-control-flow-alpha.md#qualification-0403). Les erreurs/événements et une analyse contextuelle restent à traiter.
