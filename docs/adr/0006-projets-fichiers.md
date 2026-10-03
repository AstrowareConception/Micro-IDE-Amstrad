# ADR 0006 — Projets en dossiers ouverts

Statut : acceptée. Date : 2026-10-03.

## Contexte

Les programmes doivent être faciles à reprendre, partager et versionner. L'émulateur possède un état de session, l'assistant une conversation et l'application des préférences locales ; les réunir dans un fichier opaque rendrait la sauvegarde et l'interopérabilité difficiles.

## Décision

Un manifeste JSON versionné décrit sources, ressources, documents et build. Les sources restent UTF-8 ; les originaux importés sont copiés et identifiés par empreinte. Les caches et récupération sont locaux et reconstructibles. Les ROM, secrets et préférences hôte ne sont pas dans le projet. Pas de base de données au démarrage.

## Options considérées

Une archive propriétaire unique simplifie le transport mais complique Git et la résolution des conflits. SQLite apporte des transactions mais pas la lisibilité des sources et dépendances pour ce petit modèle. Un compte cloud contredit le parcours offline et n'est pas demandé.

## Conséquences

Chemins relatifs, schémas et migrations explicites. Watchers et contrôles de concurrence nécessaires. Les transactions multifichiers sont journalisées, car un renommage atomique ne garantit pas une transaction sur tout un dossier. Le partage exclut conversations et documents privés non sélectionnés. Les empreintes distinguent révision de travail et entrée de build.

Révision : indexation ou historique volumineux peuvent utiliser un stockage local annexe, sans faire de la base l'unique détenteur du code. Une archive de partage serait un export du dossier avec contrôles de contenu et d'extraction.
