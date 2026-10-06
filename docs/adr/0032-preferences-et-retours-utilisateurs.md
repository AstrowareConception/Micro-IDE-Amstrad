# ADR 0032 — Préférences persistantes et retours utilisateurs

Statut : acceptée pour l’alpha 0.25. Date : 2026-10-06.

## Contexte

L’atelier doit s’adapter aux habitudes de chaque utilisateur et recueillir les besoins que son auteur ne peut anticiper. Les réglages de code étaient temporaires et il n’existait pas de parcours de retour produit.

## Décision

Outils → Paramètres, palette et Ctrl/Cmd virgule ouvrent une fenêtre avec application explicite, annulation et restauration des valeurs par défaut. Thèmes sombre/clair/système, police/taille, indentation, espaces, retour visuel, parenthèses, minimap, dimensions des zones et valeurs initiales de renumérotation sont configurables. Les thèmes changent aussi Monaco. Les paramètres validés sont conservés dans le profil local de l’application, sans clé IA ni contenu de projet ; un stockage indisponible conserve la configuration de session et l’indique.

L’auto-save est opt-in, après délai de 1 à 60 secondes. Il concerne les sources des projets ouverts, utilise le même enregistrement par lot avec contrôle des révisions disque, et se suspend lorsque l’atelier est occupé. Une révision en échec n’est pas réessayée en boucle. Les listings isolés restent enregistrés explicitement. La renumérotation reste une opération avec aperçu et contrôle de révision, avec début/pas configurables.

Le dock inférieur ajoute le journal paginé des commits Git aux problèmes, CPC et terminal. Les opérations Git restent dans le port existant. L’explorateur actuel ouvre les sources déclarées et conserve les buffers/undo des vues fermées.

Aide → Proposer une amélioration ou signaler un problème prépare un ticket : titre, usage, difficulté/reproduction et résultat souhaité. La description est consultable et copiable. Le pont main ouvre uniquement une URL HTTPS construite vers les issues du dépôt CPCéleste ; il ne reçoit aucune URL arbitraire et n’utilise pas de token GitHub. L’utilisateur relit et envoie le ticket dans son navigateur avec son compte. Aucun journal, chemin local, document, source ou clé n’est ajouté automatiquement. Les demandes trop longues pour l’URL utilisent la copie de description. Deux modèles de tickets sont fournis dans le dépôt.

## Suite et limites

La disposition conserve les dimensions ; le glisser des séparateurs, l’ancrage réorganisable et les fenêtres détachées restent à construire. L’explorateur intégral doit distinguer sources compilables, documents contextuels, configuration, fichiers binaires et artefacts, avec politiques d’ouverture/enregistrement adaptées ; les fichiers non déclarés ne doivent pas entrer implicitement dans le DSK ou le contexte IA. PTY interactif, console des opérations Git, keymap utilisateur et numérotation automatique pendant la saisie restent ouverts. Cette tranche ne qualifie pas l’ensemble comme IDE 1.0.

## Vérification

Tests de validation/récupération des paramètres et construction bornée/encodée des tickets. Recette navigateur : paramètres appliqués sans perte du buffer, dimensions, thème système, conservation dans une deuxième fenêtre, valeurs par défaut, ticket prérempli, auto-save multi-source et renouvellement du catalogue OpenAI par timer/focus. Recette Electron : ouverture extérieure simulée, refus d’URL arbitraire, auto-save sur fichiers réels et parcours complets existants. Aucun ticket publié pendant les tests.
