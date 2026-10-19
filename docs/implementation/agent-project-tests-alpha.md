# Tests du vrai projet par l’agent — 0.41.30

L’agent peut désormais lancer le vrai DSK du projet avant et après une transformation. MAIN, PART et les ressources déclarées sont embarqués tels que construits, sans concaténation ni copie de routine dans un test. Les suites de listings autonomes restent disponibles séparément.

## Utilisation

1. Préparer à la racine du projet `microide.project-tests.json`, selon le [schéma](../../contracts/project-tests.schema.json). Les attentes sont choisies et relues par la personne qui connaît le résultat attendu ; aucun outil agent ne les écrit.
2. Configurer les trois ROM locales du CPC 6128 anglais identifié, comme pour Tests BASIC. Aucun octet ROM n’est transmis au modèle ni conservé dans les rapports.
3. Demander à l’agent : « Lis les scénarios du projet ; teste avant les modifications, puis reconstruis et teste après avec les mêmes attentes. » La mission de lisibilité prépare déjà cette consigne.
4. Lire « Vrai projet CPC — avant / après » dans le bilan. Une référence initiale manquante est annoncée. Un résultat antérieur n’est pas une validation de la révision finale.

L’[exemple complet](../../examples/project-tests/microide.project.json) charge PART avec CHAIN MERGE, lit INPUT.TXT, attend la saisie `CPC` puis écrit OUT.TXT. Son [scénario](../../examples/project-tests/microide.project-tests.json) attend exactement `BONJOUR CPC\r\n`. Ouvrir ce projet puis demander « Exécute le scénario io et construis le DSK ». Le fichier produit reste dans la disquette isolée du test ; il n’apparaît pas sur le disque hôte.

Le format version 1 contient `scenarios`, chacun avec `id`, `name`, `seconds`, `inputs` et `checks` :

```json
{
  "schemaVersion": 1,
  "scenarios": [{
    "id": "io", "name": "Ressource et clavier", "seconds": 12,
    "inputs": [{"atMs": 4000, "text": "CPC\r"}],
    "checks": [{"kind": "file", "name": "OUT.TXT", "text": "BONJOUR CPC\r\n"}]
  }]
}
```

Une attente `screen` spécifie `name`, `x`, `y`, `width`, `height`, `sha256` du rectangle RGBA (alpha 255, ordre lignes puis colonnes). Les coordonnées sont celles de la trame 768 × 272 du moteur. Éviter le curseur clignotant. Le calcul d’une attente écran à partir d’un résultat indépendant reste une préparation technique externe ; aucun bouton de capture ou apprentissage d’attente n’est ajouté ici. Une attente `file` compare le contenu ASCII exact du fichier CPC fermé, hors marque logique EOF et remplissage CP/M ; binaire ou en-tête AMSDOS refusé.

## Budgets, exécution et provenance

| Élément | Contrat |
| --- | --- |
| Bibliothèque | 16 scénarios, fichier UTF-8 de 128 Kio maximum, liens refusés |
| Durée | 1–15 secondes émulées après relâchement du dernier caractère de `RUN`, 60 secondes réelles maximum par essai |
| Clavier | 8 saisies, 64 touches cumulées, ASCII imprimable/Retour, pas de 20 ms, 120 ms par touche, sans chevauchement |
| Observations | 1–8 par scénario, rectangle ≤ 16 384 pixels ; attente fichier ASCII ≤ 2 048 caractères |
| Mission | 5 essais projet maximum, quota conservé lors des reprises |
| Historique | 10 rapports, 2 Mio maximum, dans `.microide/project-test-reports.json` |

Le démarrage CPC est vérifié par l’empreinte du prompt Ready après cinq secondes émulées. Le DSK exact est monté, l’entrée du manifeste saisie puis les événements clavier appliqués. Une observation après budget ne signifie pas que le programme s’est terminé : il peut encore attendre une saisie ou continuer une boucle.

`project_tests_list` retourne les scénarios, `revision` (SHA des octets de la bibliothèque) et `projectSha256`. `project_tests_run` reçoit `scenarioId`, `expectedRevision` et `expectedProjectSha256`, tous issus de cette lecture. Relire après mutation. Une autre entrée, une source même non atteinte ou une ressource modifiée invalide le résultat ; l’empreinte ne prétend pas déterminer les fichiers effectivement exécutés. Les documents du projet sont exclus de cette identité d’exécution.

Le rapport version 1 contient identifiant/date, scénario et son SHA, révision de bibliothèque, sources/ressources avec chemins et SHA, entrée, SHA projet/DSK, résultats d’observation et SHA des trois ROM. Ni ROM, ni export du DSK modifié, ni chemins hôte du moteur. Un résultat malformé, sans les empreintes attendues ou sans toutes les observations est bloqué. Les résultats sont visibles pendant la mission et les rapports JSON restent sur disque après réouverture ; l’interface de consultation de cet historique n’est pas encore ajoutée.

Le dernier essai de chaque scénario invoqué doit réussir sur la révision finale pour valider la mission. Une modification des attentes invalide durablement les anciens résultats de la mission, même si le fichier est ensuite rétabli. La comparaison avant/après exige un essai initial réussi sur les mêmes attentes et ROM ; un essai seulement final ne produit pas de référence initiale. Un problème d’archivage est signalé sans masquer le résultat visible. Les contrôles de construction et des suites autonomes éventuellement invoquées restent bloquants.

## Preuves et limites

`node scripts/qualify-agent-project-tests.mjs` avec `CPC_TEST_ROM_DIR` exécute le vrai contrôleur et le vrai worker, seul le fournisseur IA étant déterministe. Six références d’affichage littérales indépendantes donnent les attentes des six témoins de lisibilité : expression, condition vraie/fausse, FOR sauté/répété, WHILE décroissant. Les douze essais avant/après réussissent avec les mêmes scénarios ; l’essai final contient MAIN et PART. Un module volontairement altéré échoue. L’exemple ressource/clavier/sortie réussit sans modifier les ressources, attentes ou projet hôte. ROM manquantes et annulation du worker sont aussi contrôlées. Rapport : `out/agent-project-tests-qualification.json`, avec hashes sans ROM.

La recette Electron `tests/multifile-desktop-smoke.mjs --project-tests` configure les ROM par l’interface, prépare la mission, vérifie les deux résultats, restaure toute la mission, relance, ferme/réouvre puis rétablit seulement la dernière mutation. Les quatre rapports restent archivés. Rapport et captures sont collectés dans la CI desktop. Les tests Node contrôlent révisions, quotas, altération d’attentes, fausses empreintes, dernier échec, archivage, annulation et statut final du contrôleur. Le banc historique de listings est rejoué après partage de l’observation écran/fichiers.

Ces petits scénarios ne prouvent ni tous les jeux historiques ni les choix d’un modèle réel. Pas de matériel physique ou d’émulateur indépendant ; aucune qualification 664/Plus/PCW. Pas d’instrumentation, de couverture des chemins, d’inspection de variables ni de vérification du timing. Prochaine étape : rendre la préparation et la consultation des scénarios accessibles dans l’interface, en conservant les attentes sous contrôle humain.

[Décision d’architecture](../adr/0080-tests-vrai-projet-agent.md).
