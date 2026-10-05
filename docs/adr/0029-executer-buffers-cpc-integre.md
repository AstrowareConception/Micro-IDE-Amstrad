# ADR 0029 — Exécuter les buffers dans un CPC intégré

- Statut : accepté pour une intégration expérimentale
- Date : 2026-10-05
- Périmètre : alpha 0.24, priorité produit Exécuter/F5 ; J0/J3 partiels

## Décision

La demande utilisateur rend le lancement intégré prioritaire avant les branches Git. Relier le cœur floooh/chips verrouillé, C/Emscripten 4.0.15, à un worker dédié et à un écran React. Aucune interprétation BASIC JavaScript et aucun lancement d’émulateur externe. Le bouton Exécuter, F5 et la palette construisent un DSK DATA depuis un snapshot des buffers, sans enregistrer les sources. Projet : tous les fichiers déclarés, programme d’entrée ; listing isolé : MAIN.BAS. Les programmes ne sont pas concaténés.

Main valide snapshot/session/projet, construit le DSK avec le codec existant et charge des copies revalidées des trois ROM privées. Le renderer/worker reçoit uniquement ce jeu et les octets construits, pas de chemin utilisateur ni capacité disque hôte. Les ROM ne sont jamais envoyées à l’agent. Le port Emulator.prepare ne donne aucune nouvelle capacité IA.

Le renderer utilise désormais l’origine locale standard et sécurisée cpceleste://app. Le protocole sert uniquement les fichiers statiques réguliers de dist/renderer, sous cette racine et avec types autorisés ; pas de fichiers de projet. La confiance IPC vérifie toujours fenêtre et URL exacte. CSP conserve les restrictions et autorise seulement la compilation WASM (wasm-unsafe-eval). Worker module, génération UUID, arrêt par terminate, expiration d’initialisation 30 s, tranches CPU 10 ms et backlog 40 ms. Une frame transférée au maximum attend un acquittement avant la suivante ; audio borné, muet par défaut, activation explicite, files nettoyées à pause/fermeture.

L’export du disque mutable traverse un port dédié vers le dialogue natif : payload borné à la géométrie DATA, session projet vérifiée et protection des fichiers du projet. Les téléchargements Blob restent propres à la prévisualisation navigateur ; l’application sous protocole sécurisé ne dépend pas de leur prise en charge.

## Prompt et preuves

Une signature SHA-256 d’écran indexé (768 × 108 premiers pixels, hors curseur clignotant) observée avec le jeu 6128 anglais identifié par les trois SHA-256 déclenche RUN. Elle est vérifiée dans la recette firmware WASM, après observation du vrai écran BASIC 1.1/Ready dans le cœur natif. Ce signal n’est pas un délai arbitraire. Aucun autre jeu ne bénéficie de cette reconnaissance ; confirmation manuelle Ready pour lancer son entrée. RUN est injecté par touches espacées de 60 ms émulées, sans hook remplaçant l’interpréteur.

Le test réel construit un DSK, exécute RUN par le clavier et vérifie POKE &8000,165 dans la RAM et les pixels de PRINT dans le panneau. Les ROM de référence proviennent d’un checkout explicitement fixé de floooh/chips-test pour les recettes, ne sont ni commités ni distribués dans les artefacts de l’application. Le produit conserve l’import utilisateur, sans téléchargement automatique. Les messages de copyright restent intacts ; aucune conclusion générale de redistribution des ROM Locomotive n’est tirée de la licence Zlib du cœur.

## Limites

La qualification J0 reste partielle : ce succès ne couvre pas Caprice32 indépendant, matériel, toutes ROM/langues, disque OPENOUT/OPENIN, timing/audio audible ou toutes fonctions BASIC. Aucun go universel moteur. Modifier le projet/source après lancement ne modifie pas la session émulée : F5 prépare une nouvelle machine et détruit la précédente, y compris ses écritures non exportées. Pause/blur relâchent les touches ; une saisie RUN interrompue nécessite une relance. Autres machines, Extended DSK, débogueur et outils d’exécution IA restent ouverts.

[Guide et preuves](../implementation/emulator-run-alpha.md). Cette décision complète les ADR 0003/0009/0012 ; l’absence antérieure de firmware ne retarde plus le parcours expérimental maintenant testable. Branches Git reprennent après ce socle.
