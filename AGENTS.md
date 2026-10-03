# Consignes pour les travaux dans ce dépôt

## État et périmètre

Le dépôt est initialisé avec des spécifications. Ne pas supposer que l'application existe. Lire `README.md`, `docs/README.md` et le jalon demandé dans `docs/specifications/12-feuille-de-route.md` avant de coder. Réaliser l'incrément demandé ; ne pas lancer tous les jalons à la fois.

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
- Les suggestions IA de l'application passent par revue du diff et contrôle de révision ; elles ne peuvent pas autoriser du shell.
- Ne pas créer de système distribué, de bus global, de base de données ou de système de plugins pour anticiper des besoins non démontrés.

## Vérification

Exécuter `python scripts/check_specs.py --schemas` avec les dépendances de `scripts/requirements-docs.txt` lors d'une modification documentaire ou contractuelle. Pour le code futur, appliquer le plan de recette du jalon. Distinguer tests exécutés, tests bloqués et essais seulement prévus. Un succès dans le moteur intégré ne remplace pas les vérifications externes prescrites au document 11.

## Communication

Documentation en français ; noms de types, modules et API en anglais cohérent avec le glossaire. Signaler les décisions, les preuves et les limites utiles. La demande de l'utilisateur guide le périmètre ; ne pas imposer de validation supplémentaire pour une étape déjà autorisée.
