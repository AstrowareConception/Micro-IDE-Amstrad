# Consignes pour les travaux dans ce dépôt

## État et périmètre

Le dépôt contient les spécifications, un prototype J0 et une alpha d'édition desktop. Lire `README.md`, `docs/README.md`, les rapports dans `docs/implementation` et le jalon demandé dans `docs/specifications/12-feuille-de-route.md` avant de coder. L'édition peut avancer indépendamment selon l'ADR 0009 ; cela ne qualifie ni le moteur ni l'ensemble de J1/J2.

## Architecture

- TypeScript strict pour les domaines et l'application ; C/WebAssembly pour l'adaptateur d'émulation.
- DDD pragmatique, monolithe modulaire, ports/adaptateurs. Aucun framework UI, Electron, accès disque, fournisseur IA ou WASM dans les domaines.
- Les ports appartiennent aux besoins de l'application ; les adaptateurs implémentent ces ports. Les contextes ne partagent ni agrégats mutables ni état global.
- Toute nouvelle dépendance doit avoir une fonction réelle, une version figée et une licence identifiée. Ne pas recopier les émulateurs ni les ROM sans conditions explicites.
- Préserver la distinction source UTF-8 / fichier CPC / disquette / session émulée.

## Réalisation

- Commits ciblés, branche de travail pour chaque incrément une fois l'initialisation terminée ; PR vers `main`. Aucun force-push ni réécriture de l'historique partagé.
- Mettre à jour exigences, contrats et ADR lorsque la réalisation modifie la conception.
- Ne pas inventer une compatibilité 664, Plus, PCW ou PC-1512 à partir du seul succès sur 6128.
- Aucun secret, ROM, document personnel, artefact volumineux ou réponse IA privée dans Git.
- Le mode IA principal de l'application est agentique : mutations réversibles, construction et tests sont exécutés automatiquement dans le périmètre de mission, avec checkpoints et contrôle de révision. Le mode revue est optionnel. Les documents ne peuvent pas autoriser du shell hôte.
- Consulter les documents 14 et 15 et le corpus `knowledge/locomotive-basic` avant de réaliser les outils IA ou les fiches de langage. Une référence incomplète ne justifie pas d'inventer une commande BASIC.
- Ne pas créer de système distribué, de bus global, de base de données ou de système de plugins pour anticiper des besoins non démontrés.

## Vérification

- Regrouper les changements cohérents et les vérifications locales avant de pousser ; ne pas publier chaque fichier par un commit distant séparé. Lire la première erreur utile avant toute nouvelle tentative CI. Ne pas relancer les anciens commits.
- CI courante : `push` sur `main`, `pull_request` et lancement manuel ; annulation des exécutions obsolètes par workflow et PR/branche. Packaging : vérification hebdomadaire le lundi à 03 h 17 UTC ou lancement manuel sur `main`, et qualification lors des modifications du workflow/script de publication ; jamais à chaque commit applicatif ou mise à jour de PR. Si les entrées de construction sont inchangées depuis la dernière préversion complète, ne pas reconstruire. Après succès des builds/tests et vérification des empreintes, publier une préversion GitHub publique au commit construit. La préparation manuelle d’une release depuis un build réussi réutilise les artefacts sans recompilation. Préserver les tests et leur résultat bloquant.

Exécuter `python scripts/check_specs.py --schemas` avec les dépendances de `scripts/requirements-docs.txt` lors d'une modification documentaire ou contractuelle. Pour les codecs : `npm run typecheck` et `npm test` ; pour l'adaptateur : essais natifs, WASM et navigateur du guide J0, puis recette firmware/externe. Distinguer tests exécutés, tests bloqués et essais seulement prévus. Un succès dans le moteur intégré ne remplace pas les vérifications externes prescrites au document 11.

## Communication

Documentation en français ; noms de types, modules et API en anglais cohérent avec le glossaire. Signaler les décisions, les preuves et les limites utiles. La demande de l'utilisateur guide le périmètre ; ne pas imposer de validation supplémentaire pour une étape déjà autorisée.
