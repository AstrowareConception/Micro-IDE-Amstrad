# ADR 0060 — Types possibles des symboles BASIC

- Date : 2026-10-08
- Statut : accepté pour l’alpha 0.41.1
- Périmètre : IDE-015 partiel ; IDE-017 non réalisé

## Problème

L’index 0.41.0 omet toutes les déclarations de type. Il ne peut ni expliquer le type d’un nom ni naviguer vers les plages DEFINT/DEFREAL/DEFSTR. Appliquer ces directives dans l’ordre du texte serait trompeur : branches, retours et appels peuvent changer leur ordre d’exécution.

## Décision

Enrichir l’index existant lors de sa passe à la demande. Les suffixes fournissent un type explicite. Pour les noms sans suffixe, former un ensemble par première lettre à partir du réel initial et de toutes les directives valides de la source. L’hypothèse est un RUN autonome avec les réglages BASIC standards. Un segment omis ou un accès machine (POKE/OUT), CONT ou RUN externe rend les types implicites indéterminés. Aucun ordre lexical ne devient une preuve d’exécution.

Ne fusionner aucun alias et ne produire aucun renommage. Les scalaires/tableaux et sources restent séparés. Les fonctions DEF FN et leurs portées restent exclues ; elles exigent une qualification propre avant la résolution des identités.

## Contrat et bornes

Rapport Symboles version 2 : champ `type` (`basis`, `candidates`) par symbole ; tableau `typeDeclarations` (`command`, `letters`, `type`, `location`) par source. Les coordonnées restent UTF-16 et la navigation sélectionne exactement la déclaration. Les plages sont normalisées en lettres, sans conservation de code, chaînes ni valeurs. Le rapport Qualité reste inchangé.

256 déclarations maximum par source, sinon résultats de cette source retirés. Tous les budgets de la 0.41.0 restent actifs. Une table de 26 ensembles évite de croiser chaque occurrence avec chaque déclaration. Affichage de 200 déclarations maximum avec compteur du surplus ; pas de nouveau worker, de calcul à la frappe ou de dépendance. La liste dérivée des déclarations est mémorisée par snapshot React. Les liens réutilisent les gardes de révision et de session existantes.

## Vérification

Tests de domaine pour directives, exclusions, candidats, budgets, coordonnées et exports ; tests firmware pour plages et changements de types ; parcours navigateur pour affichage et navigation, exports, obsolescence et lifecycle existant. Les essais intégrés ne qualifient ni un CPC physique ni une nouvelle ROM. Résultats détaillés dans le point de reprise et la PR.
