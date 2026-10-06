# ADR 0030 — Atelier, menus et diagnostics pendant la saisie

Statut : acceptée pour l’alpha 0.25. Date : 2026-10-06.

## Contexte

La colonne unique mêlait projets, Git, ROM, documentation et IA. Les menus `details` indépendants pouvaient rester ouverts simultanément. L’émulateur repoussait le code hors de la fenêtre. Les diagnostics existants concernaient principalement les numéros, références et contraintes d’export.

## Décision

- Barre d’activité et outil sélectionné à gauche ; Monaco au centre ; assistant IA exclusivement à droite ; problèmes, CPC et terminal dans un dock inférieur borné.
- Registre commun de commandes pour menus, palette et raccourcis d’atelier. Un seul menu actif, fermeture au clic extérieur, perte de focus, Échap, commande ou raccourci ; navigation aux flèches.
- SVG locaux décoratifs et libellés accessibles sur les actions. Aucune nouvelle dépendance d’icônes.
- Analyse syntaxique supplémentaire réservée à l’éditeur : instructions courantes, expressions via Pratt, parenthèses, IF/FOR et arguments obligatoires. Les domaines d’export et de renumérotation conservent leurs politiques existantes.
- Diagnostics indexés par ligne physique, soulignement, marge, aperçu dans la règle et navigation F8/Maj F8. Commentaire de lignes avec apostrophe après le numéro BASIC, en une opération undo.
- Masquer un panneau conserve sa session. Fermer une vue de source conserve son buffer, son état modifié et son modèle undo ; l’explorateur permet de la rouvrir.

## Conséquences et limites

L’analyse est partielle : aucune validation complète des types, de la grammaire ou des comportements ROM. Les formes compactes ambiguës, DATA, commentaires, RSX et formes spéciales restent opaques. Les expressions de plus de 1024 tokens et les formes stream/adresse/FN séparé ne sont pas validées par Pratt. L’absence de diagnostic ne garantit pas l’exécution.

Les panneaux restent montés lorsqu’ils sont masqués afin de conserver les tâches et sessions ; leurs défilements sont indépendants. Les dispositions et raccourcis personnalisés persistants ainsi que les branches/réseau Git ne sont pas livrés par cette tranche. La qualification matérielle de l’émulateur reste distincte de la recette de l’atelier.

## Vérification

Tests de domaine dédiés aux diagnostics et formes natives opaques ; recette navigateur des menus, raccourcis, marqueurs, commentaire BASIC et surface de code ; recettes Electron existantes adaptées à la sélection explicite des outils. Build Windows depuis un chemin avec espaces, recette navigateur Windows et recettes Linux dans le workflow Desktop editor.
