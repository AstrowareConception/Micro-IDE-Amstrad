# ADR 0020 — Recherche des sources et remplacement dans les buffers

Date : 2026-10-04. Statut : acceptée pour l’alpha 0.15.

## Décision

Le domaine Workspace fournit une recherche textuelle littérale pure sur les sources chargées, indépendamment du disque, de Git et de l’analyse BASIC. Le renderer propose recherche, navigation, aperçu puis sélection des fichiers. Les documents privés et ressources binaires ne font pas partie de ce périmètre. Aucun accès disque ni nouvel outil agent n’est ajouté.

Le snapshot capture identité, nom et texte de toutes les sources ; un changement du périmètre ou de son contenu invalide résultats et aperçu. Avant l’application, l’adaptateur Monaco vérifie tous les modèles sélectionnés puis ajoute une opération entourée d’arrêts d’annulation à chacun. Il conserve les piles existantes ; aucun `setValue` n’est utilisé pour remplacer. L’annulation est individuelle par fichier, pas une transaction durable de projet. Une édition puis annulation ramenant au texte initial rend le snapshot à nouveau applicable : ce contrôle porte sur le contenu, contrairement au contrôle de révision de la renumérotation.

## Limites

1–64 sources, 1 Mio UTF-8 par source, 4 Mio par recherche, 1 000 occurrences maximum sans résultats tronqués. Recherche de 1–256 caractères et remplacement de 0–4 096 caractères, littéraux sur une ligne ; occurrences non chevauchantes. L’insensibilité à la casse concerne ASCII et préserve les offsets UTF-16 Monaco. Les limites de mot incluent lettres/chiffres Unicode, underscore, point et suffixes BASIC `$%!`. Les chaînes et commentaires sont recherchés également : ce n’est pas un renommage sémantique.

Le remplacement reste un brouillon ; « Enregistrer » écrit seulement la source active selon les préconditions existantes. Aucun journal de crash, sauvegarde coordonnée ni historique local durable n’est revendiqué. Ces capacités constituent le lot R2 de la roadmap qualifiée. Regex, filtres de chemin et navigation sémantique restent des incréments distincts.

## Validation

Tests du domaine : offsets/positions, casse/mots, substitutions littérales, absence de mutation, bornes et snapshots périmés. Recette navigateur : raccourci, navigation, aperçu, application, undo/redo et invalidation. Recette Electron : plusieurs sources dont un brouillon, sélection de fichiers, annulation indépendante, disque et manifeste inchangés. Les recettes d’exécution CPC restent séparées.
