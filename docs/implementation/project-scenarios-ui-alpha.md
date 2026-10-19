# Préparation et consultation des scénarios projet — 0.41.31

Le panneau **Tests projet**, également accessible par le menu BASIC ou la palette, permet de préparer les scénarios, lancer un essai sans agent et consulter les dix derniers rapports du projet. Les [tests du vrai projet par l’agent](agent-project-tests-alpha.md) utilisent les mêmes attentes enregistrées ; aucun outil agent ne permet de les modifier.

## Parcours humain

1. Ouvrir un projet BASIC desktop et **Tests projet**. **Nouveau scénario** crée un brouillon avec un nom, un budget de 1 à 15 secondes émulées et une attente fichier.
2. Renseigner les saisies clavier et les attentes. Le formulaire gère les mêmes limites que le [contrat version 1](../../contracts/project-tests.schema.json) : huit saisies, 64 touches cumulées, huit observations et seize scénarios.
3. **Enregistrer les scénarios** conserve la bibliothèque complète dans `microide.project-tests.json`. Le bouton d’exécution reste indisponible tant qu’un brouillon existe. Supprimer un scénario prépare une suppression à enregistrer ; une demande de confirmation protège cette action dans l’application.
4. Configurer les trois ROM locales du profil CPC 6128 anglais qualifié, puis **Exécuter le scénario**. Aucune clé API ni mission IA n’est nécessaire. Le DSK contient les buffers BASIC ouverts, même non enregistrés, et les ressources déclarées. Les sorties restent dans le CPC isolé.
5. Lire le résultat et ses observations ; consulter ou exporter le rapport JSON. **Rapport** sélectionne aussi les rapports des missions agent, sans les réexécuter. Fermer puis rouvrir le projet conserve la bibliothèque et les rapports archivés.

Pour l’[exemple ressource/clavier/sortie](../../examples/project-tests/microide.project.json), employer un budget de 12 secondes, la saisie `CPC\r` à 4 000 ms et l’attente fichier OUT.TXT `BONJOUR CPC\r\n`.

Les caractères de contrôle sont visibles dans le formulaire : `\r` représente Entrée, `\r\n` une fin de ligne CPC, `\t` une tabulation et `\\` une barre oblique inverse. Cette notation préserve les octets malgré la normalisation des zones de texte HTML. Le clavier n’accepte que l’ASCII imprimable et Retour ; les attentes fichier autorisent aussi tabulation et saut de ligne. Les délais sont des multiples de 20 ms, sans chevauchement, avec 120 ms par touche.

Une attente écran propose nom, rectangle et SHA-256 RGBA de la référence, dans le cadre 768 × 272 et jusqu’à 16 384 pixels. Cette tranche ne capture pas une nouvelle référence et ne propose pas de transformer automatiquement un échec en attente. L’empreinte doit provenir d’une référence vérifiée par la personne qui prépare le scénario. La capture avec validation visuelle explicite est la suite proposée.

## Cohérence, historique et responsabilités

Le processus principal construit le DSK et les rapports à partir du projet courant. Le renderer ne fournit ni chemin de destination, ni rapport à archiver ou exporter, ni résultat CPC. L’export reçoit un identifiant : le processus principal retrouve le rapport dans sa mémoire ou dans l’historique validé, puis propose un dialogue natif de sauvegarde hors du dossier projet. Les canaux humains `project-tests:inspect/save/start/status/cancel/export` sont distincts des outils agent `project_tests_list/run`.

Enregistrer contrôle deux fois la révision exacte de la bibliothèque ; une modification concurrente, un fichier invalide, excessif ou lié est refusé sans remplacement. **Actualiser les scénarios et rapports** relit le disque et demande d’abord l’abandon d’un éventuel brouillon. Changer de projet ou fermer la fenêtre protège aussi les attentes non enregistrées. Les protections existantes des sources restent actives.

Un seul essai natif peut être actif ; les opérations disque, le terminal et l’agent sont alors bloqués. **Arrêter l’essai** annule le worker ; la fenêtre ne se ferme pas avant sa fin. Le budget réel de 60 secondes est conservé. Les lancements humains explicites n’utilisent pas le quota de cinq essais d’une mission agent.

Chaque rapport garde son résultat original et les empreintes projet, sources, ressources, DSK, bibliothèque, scénario et ROM. Le panneau compare ce rapport au dernier état relu et aux buffers affichés : correspondant, historique ou révision non vérifiée. Un brouillon d’attentes interdit de présenter le rapport comme courant. Les changements externes des attentes sont détectés à l’actualisation, à l’enregistrement et au lancement ; l’affichage n’est pas un observateur permanent du fichier JSON. Un ancien succès consulté dans l’historique ne valide pas une mission agent : celle-ci conserve son propre contrôle du dernier essai et de sa référence avant/après.

Un historique illisible reste intact. L’essai reste possible ; son rapport est visible et exportable pendant la session si l’archivage échoue. Seuls les dix derniers rapports sont conservés, avec une limite totale de 2 Mio. Les résultats « bloqué » et « arrêté » restent distincts des observations réussies ou en échec.

## Vérifications et limites

- Tests Node : aller-retour des échappements, budgets invalides, création/édition/suppression, réouverture, révisions périmées, conservation des fichiers corrompus ou liés, provenance des buffers non enregistrés, appartenance à une session, annulation, concurrence et défaut d’archivage.
- `scripts/qualify-project-scenarios.mjs` : trois exécutions avec le vrai worker CPC et les ROM externes identifiées. L’exemple passe, une altération du buffer PART échoue avec les mêmes attentes, puis le projet restauré passe. Sources hôte, attentes et ressource restent intactes ; les rapports sont relus après réouverture. Preuve : `out/project-scenarios-qualification.json`.
- `tests/project-scenarios-desktop-smoke.mjs` : recette Electron bloquante en CI, formulaire clavier/fichier/écran, fermeture protégée, ROM manquantes, import ROM, succès et échec réels, export, réouverture, modification externe refusée, suppression et annulation. Capture : `out/project-scenarios-desktop.png`.

L’exécution observe la fin du budget ; elle ne prouve ni terminaison, ni couverture de chaque fichier ou chemin, ni équivalence universelle. Pas de nouvelle qualification matérielle ou d’émulateur indépendant, ni de référence écran capturée par l’interface. Les tests de listings autonomes restent accessibles dans **Tests BASIC**.

[Décision d’architecture](../adr/0081-interface-scenarios-projet.md).
