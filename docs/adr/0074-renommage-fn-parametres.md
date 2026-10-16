# ADR 0074 — Renommage FN et paramètres dans un profil stable

- Date : 2026-10-16
- Statut : accepté pour 0.41.15
- Périmètre : IDE-017 partiel

## Décision

Étendre le point d’entrée F2 aux fonctions FN et à leurs paramètres avec un résolveur dédié. Conserver le renommage scalaire/tableau antérieur sur les sources sans FN. Ne pas autoriser les mutations à partir des seuls candidats de navigation : contrôler le listing entier par le codec, les exclusions communes et une couverture FN complète.

Le profil impose un bloc initial de définitions, une par ligne, avant toute instruction exécutable. Les commentaires/lignes vides sont admis. Les radicaux de fonctions sont uniques ; les appels ont une cible unique, une orthographe suffixée identique et une arité correcte. Les graphes récursifs sont refusés. Paramètres dupliqués, alias suffixés et liaisons ambiguës sont refusés ; DEFINT/DEFREAL/DEFSTR et les effets opaques du profil 0.41.14 restent exclus.

L’index général conserve son statut partiel et son contrat d’export 3. Seules ses omissions FN reconnues sont admissibles pour ce résolveur ; toute autre omission, limite ou troncature de raisons bloque. Chaque lexème FN est rapproché d’une position de déclaration/appel, y compris les écritures accolées ou espacées. Le libellé commun d’omission est partagé, sans changer les exports. Les identifiants du listing servent au refus conservateur des collisions de destination, dans toutes les portées.

Une fonction sélectionne sa déclaration et tous ses appels couverts. Un paramètre sélectionne sa déclaration et ses lectures liées dans son seul corps. Les lectures libres, globales et tableaux homonymes, paramètres d’autres fonctions, préfixes FN, suffixes, chaînes, DATA, commentaires et autres fichiers sont conservés. Le nouveau radical doit être entièrement neuf dans le fichier ; cette règle évite une capture d’identité à la destination.

Le plan est revalidé par le codec et par le résolveur après transformation. Les budgets communs restent ceux de l’ADR 0073 ; les limites des collecteurs restent actives. Les fichiers FN ne permettent pas encore de renommer une globale : leurs instructions d’appel sont exclues du recensement global actuel.

## Interface et cycle de vie

Le worker existant route explicitement vers le profil approprié. Le panneau devient « Renommer un symbole », précise nature et portée, conserve l’aperçu exact et toutes les gardes de version/document/projet. Il reçoit le focus à l’ouverture pour rendre Échap utilisable même après un refus. Aucun calcul à la frappe, nouvelle dépendance, écriture implicite ou outil agent supplémentaire.

## Qualification et suite

Quinze couples avant/après indépendants sur le firmware identifié couvrent fonctions, suffixes, paramètres, globals/tableaux homonymes, imbrication, arguments et paramètres inutilisés. Avec les huit couples précédents, la recette commune comporte 46 verdicts bloquants. Le rapport inclut l’empreinte des nouvelles fixtures. Le test navigateur couvre les portées affichées et les effets exacts dans le buffer ; les tests de domaine couvrent notamment les refus d’identité et de couverture.

[Guide, exemple et limites](../implementation/basic-fn-rename-alpha.md). La mémoire et le timing peuvent changer ; aucune preuve universelle ou matérielle n’est déduite des témoins. Suite : tests liés aux sources réelles, intégration des transformations déterministes au parcours IA ; extensions des types/alias seulement sur de nouvelles preuves.
