# ADR 0071 — Index FN et portées textuelles bornées

- Date : 2026-10-15
- Statut : accepté pour l’alpha 0.41.12
- Périmètre : IDE-015 partiel ; IDE-017 non réalisé

## Décision

Prolonger l’index à la demande par une vue FN séparée des variables globales. Chaque définition possède une identité de position dans sa source, ses paramètres et les lectures de son expression. Un appel porte son nom, son arité textuelle, son éventuelle définition englobante et des liens vers les déclarations compatibles. Aucune définition active n’est déduite de l’ordre lexical, de l’arité ou d’un lien unique.

La [matrice firmware](../implementation/basic-fn-qualification.md) justifie la séparation des paramètres des fonctions appelantes/appelées, des variables libres et des tableaux. Les suffixes explicites sont distingués ; sans contexte incomplet ni directive visant la lettre, le modèle de RUN autonome rapproche le nom implicite et son alias réel. Une directive pertinente rend le type implicite inconnu sur toute la source, y compris DEFREAL : la séquence observée 6/102/103 interdit une simple simulation de la dernière directive. Les paramètres compatibles multiples et aliases non résolus restent ambigus.

## Contrat et budgets

Le rapport Symboles passe à la version 3 : `functions` par source contient `definitions`, `calls` et `inspectedOccurrences`. Les définitions portent `key`, `name`, `location`, `parameters` et `reads`. Les lectures portent `kind`, `binding` (parameter/free/ambiguous) et `parameterKeys`. Les appels portent `arity`, `ownerKey`, `definitionKeys` et `resolution` (candidate/ambiguous/missing). Missing signifie absence de déclaration couverte, pas preuve d’une erreur firmware. Aucune expression, valeur ou chaîne littérale exportée.

Le collecteur utilise les lignes et tokens déjà bornés du worker existant. Par source : 256 définitions, 32 paramètres par définition, 4096 occurrences FN et 8192 liens ; les occurrences débitent aussi le budget commun de 20 000/source et 50 000/projet. Tout dépassement retire les résultats de la source. Les omissions inconnues restent visibles. Les segments FN restent exclus de la liste des variables globales : l’index complet reste partiel.

## Interface et validation

Deux vues explicites dans Symboles : variables/tableaux et fonctions/paramètres. Recherche FN, déclarations, lectures, appels et liens possibles ; coordonnées exactes et même garde d’obsolescence que la navigation existante. Affichage limité à 200 éléments par liste, 20 liens par appel. Calcul manuel, annulation, worker jetable et délai de 15 secondes conservés.

Tests de domaine liés aux témoins firmware, bornes, confidentialité, aliases et absence de liens intersources ; recette navigateur avec worker réel, navigation, exports et modification de source. Les missions IA conservent leur restriction de renommage FN ; aucun nouvel outil mutatif. L’outil agent `language_symbols` retourne toujours les variables/types, pas les détails FN de cette vue. Prochaine étape : accès depuis le curseur, puis résolution supplémentaire et renommage avec aperçu/révision/undo.
