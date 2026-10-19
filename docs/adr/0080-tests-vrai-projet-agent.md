# ADR 0080 — Tester le vrai projet CPC dans une mission agent

- Statut : accepté
- Date : 2026-10-19
- Incrément : 0.41.30

## Contexte

Les témoins externes de 0.41.29 exécutent le DSK produit après composition des transformations. Les outils `basic_tests` de l’agent lancent des listings autonomes instrumentés ; ils ne vérifient pas le chargement de PART par MAIN. Copier une routine dans une suite ne prouve pas son comportement dans le projet.

## Décision

Ajouter `project_tests_list` et `project_tests_run`, séparés des suites existantes. Un fichier humain `microide.project-tests.json` contient des saisies et attentes écran/fichier externes au BASIC. Aucun outil d’écriture de ces attentes n’est exposé. Le schéma et le validateur applicatif bornent les scénarios. Les outils exigent lecture préalable, révision des attentes et empreinte exacte du projet.

Construire le vrai DSK depuis le snapshot des sources et ressources, avec l’entrée du manifeste. Un worker local dédié dispose de ROM identifiées et d’un moteur empaqueté choisis par le processus principal. Il monte les octets exacts de ce DSK, sans fixture ajoutée, mailbox ou instrumentation, puis observe après un budget déterministe. Les écritures CPC restent dans cette machine et ne sont jamais réinjectées dans le projet. Un arrêt termine le worker.

Identifier chaque rapport par les empreintes des sources, ressources, DSK, scénario, bibliothèque et ROM. Invalider une preuve après mutation du code, du manifeste d’exécution, des ressources ou des attentes ; les notes documentaires n’affectent pas cette identité. Lier l’avant/après seulement à scénario et ROM identiques. La réussite du dernier essai sur la révision finale est nécessaire pour chaque scénario invoqué ; aucun succès antérieur ne masque un échec final. Les suites autonomes invoquées restent soumises à leurs propres règles.

Archiver dix rapports maximum dans `.microide/project-test-reports.json` ; le format est validé lors de la relecture. Le panneau de mission présente résultats courants, antérieurs et attentes modifiées. L’archivage n’accorde aucun droit de réécrire le projet ni les attentes.

## Conséquences

L’agent peut tester le vrai projet avant/après les transformations. Le contrôle demeure observationnel, limité à un jeu de ROM CPC 6128 anglais identifié : aucune preuve de terminaison, de tous les chemins, de mémoire/temps inchangés ou d’équivalence universelle. La conception humaine des scénarios est encore un fichier JSON externe à l’interface ; aucun enregistrement automatique d’une sortie comme attente. Les jeux longs, aléatoires, binaires et les autres firmwares restent hors qualification.

[Contrat](../../contracts/project-tests.schema.json), [guide et preuves](../implementation/agent-project-tests-alpha.md).
