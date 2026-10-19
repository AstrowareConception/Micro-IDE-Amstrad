# ADR 0081 — Préparation humaine et consultation des scénarios projet

- Statut : accepté
- Date : 2026-10-19
- Incrément : 0.41.31

## Contexte

L’ADR 0080 a permis à l’agent de tester le vrai projet avec des attentes externes. Leur préparation en JSON et l’absence de consultation des rapports archivés empêchaient un parcours entièrement utilisable depuis l’atelier.

## Décision

Ajouter un panneau Tests projet et un port humain `ProjectTestsPort` pour préparer, enregistrer, exécuter, arrêter et consulter. Conserver le contrat de scénarios version 1 et l’historique existant ; les missions agent et les essais humains lisent la même bibliothèque.

La sauvegarde humaine vérifie la révision et les limites avant remplacement durable. Les entrées de contrôle du formulaire utilisent une notation explicite et réversible pour conserver Retour et CRLF. Les brouillons participent à la protection de fermeture et de changement de projet.

Un contrôleur desktop lance le worker existant via le service de tests projet, sans fournisseur IA. Le processus principal construit l’identité et le rapport ; aucun canal ne reçoit un rapport du renderer à archiver. L’exécution bloque les autres opérations disque/agent et possède une annulation liée à la session et à l’identifiant d’essai. Le service de mission garde ses propres quotas et ses critères avant/après.

La consultation conserve le résultat historique et indique sa correspondance avec les révisions relues. Un défaut d’archivage n’efface ni le fichier précédent ni le résultat exportable. Ne pas ajouter d’outil agent de sauvegarde, d’apprentissage automatique des attentes ou de capture écran dans cette tranche.

## Conséquences

L’utilisateur prépare des attentes clavier/fichier/écran sans éditer la structure JSON et teste sans clé API. La référence écran demeure une empreinte fournie par l’utilisateur ; une future capture devra exiger une inspection et une adoption humaines explicites. L’historique partagé n’est pas une validation rétroactive de mission.

Les tests couvrent sauvegarde concurrente, liens, brouillons, provenance, annulation et rapports. Un témoin multifichier réel détecte une régression dans un buffer non enregistré ; le parcours Electron est vérifié en CI. Les limites d’observation de l’ADR 0080 restent applicables.
