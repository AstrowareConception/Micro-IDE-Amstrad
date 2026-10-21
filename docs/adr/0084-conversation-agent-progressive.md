# ADR 0084 — Conversation agent et découverte progressive des outils

- Statut : accepté
- Version : 0.41.33

## Contexte

Le panneau cumulait objectif, précision, modèles, réglages et nombreux rapports. Il devenait difficile d’identifier où écrire et comment demander une retouche ou joindre un fichier. L’utilisateur demande une interaction familière aux intégrations conversationnelles d’IDE, sans perdre les fonctions existantes.

## Décision

Présenter un fil de conversation et un champ unique toujours accessible. Le même champ démarre, précise ou prolonge la tâche selon son état. Une retouche conserve les messages fournisseur, les outils, les permissions, la consommation cumulée et le checkpoint initial ; les révisions restent vérifiées avant reprise. Les pièces jointes se choisissent avant le premier envoi dans un dialogue dédié. L’import reprend les validations existantes et ne fait aucun appel IA.

Rendre les réglages, modèles de mission, transformations spécialisées, rapports et journal accessibles à la demande. Conserver les comparaisons et la restauration visibles dans le résultat. Proposer un historique borné en lecture seule pour la session ; aucune nouvelle persistance de conversation n’est introduite.

## Conséquences

Le chemin principal devient écrire, joindre, envoyer puis demander une retouche. Les composants de conversation, contexte, changements et rapports sont séparés. Le port agent ajoute la sélection documentaire et la continuation, sans coupler le domaine à React ou Electron. Les protections de mutation et les budgets ne changent pas de portée. La précision tardive est consommée avant de déclarer la boucle terminée.

Le périmètre documentaire reste fixe pendant une conversation ; une nouvelle conversation permet de le changer. Les anciennes conversations sont consultables mais non réactivables. Aucune intégration fournisseur Claude ou Codex n’est impliquée par cette organisation.

## Validation

Tests du contrôleur et de la boucle, recettes existantes conservées, nouvelle recette Electron avec vrais fichiers, précision, retouche et restauration ; captures de l’interface large et étroite en CI. Voir le [guide](../implementation/agent-conversation-alpha.md).
