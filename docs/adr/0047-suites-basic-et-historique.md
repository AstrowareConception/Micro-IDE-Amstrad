# ADR 0047 — Suites BASIC persistantes et historique borné

## Statut

Accepté pour le premier lot de l’alpha 0.39, le 7 octobre 2026.

## Contexte

Le banc 0.37 exécute des listings autonomes. Il faut retrouver leur sélection après fermeture et comparer un rapport à l’état courant des sources, sans transformer ce banc en ordonnanceur de scénarios ou ajouter une base de données.

## Décision

Les suites vivent dans `microide.tests.json`, fichier facultatif version 1 à la racine du projet, distinct du manifeste. Une suite nommée référence 1 à 8 identifiants de sources déclarées et mémorise le budget émulé (1 à 15 secondes par listing). Maximum : 16 suites et 32 Kio. Le [contrat](../../contracts/basic-test-suites.schema.json) est complété par la validation métier des identifiants de suites uniques et des références. Le panneau Git autorise ce fichier portable au même titre que le manifeste.

La sélection est explicitement exécutée, entièrement ou listing par listing, depuis les buffers capturés au lancement. Les machines, disques, assertions et limites restent ceux de l’ADR 0044. Aucun lancement au chargement, à la saisie ou au retour dans le panneau.

Les dix derniers rapports finaux, y compris blocages et annulations, sont conservés dans `.microide/test-reports/history.json` (2 Mio maximum), lié au `projectId`. Métadonnées, déclarations, empreintes et résultats uniquement : ni texte des listings, ni octets ROM. Un rapport peut décrire un buffer non sauvegardé. À sa consultation, les SHA-256 sont comparés aux buffers courants ; une différence ou une source absente rend le rapport obsolète et désactive la navigation vers ses assertions. Aucun verdict n’est recalculé.

Le domaine valide les structures sans accès au disque. L’adaptateur main utilise des destinations fixes, vérifie la session et le projet, refuse liens et fichiers anormaux, puis remplace les JSON avec écriture durable. L’enregistrement des suites exige la révision SHA-256 lue précédemment. Les formats inconnus ou corrompus ne sont pas écrasés. Une référence devenue absente reste visible et peut être retirée. Une erreur d’archivage laisse le rapport courant exportable.

## Conséquences et limites

La sérialisation IPC protège les opérations de cette instance ; aucun verrou entre plusieurs processus CPCéleste n’est introduit. Le contrôle de révision détecte les changements déjà présents au moment de la sauvegarde, sans promettre une transaction avec un éditeur externe concurrent. L’historique local n’est ni une attestation signée d’exécution ni un journal d’audit inviolable.

Pas de concaténation, fixtures de disque partagées, clavier scénarisé, assertion écran/fichier, couverture, lecteur de variables ou outil IA de tests dans ce lot. Les exemples reproduisent de petites règles de jeu dans des programmes de test autonomes.
