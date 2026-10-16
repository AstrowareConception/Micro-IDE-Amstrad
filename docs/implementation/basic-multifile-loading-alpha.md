# Contrat de chargement CPC multifichier — qualification alpha 0.41.21

## Portée

La 0.41.20 repérait les sous-programmes GOSUB et les limites d'un éventuel découpage. La 0.41.21 étudie **comment plusieurs fichiers BASIC se chargent réellement depuis une disquette AMSDOS**, sans encore déplacer de code historique.

Le moteur `inspectLoadContract` inventorie, en lecture seule, CHAIN, CHAIN MERGE, MERGE, RUN avec nom de fichier et LOAD. Il identifie les cibles littérales CPC 8.3, résout uniquement les noms de fichiers BASIC déjà déclarés dans le projet, signale les cibles dynamiques, externes ou ambiguës et repère les cycles CHAIN. Les chargements conditionnels et les effets disque/mémoire ne sont jamais qualifiés comme sûrs. L'outil agent `language_loading_contract` exige l'ID et le SHA-256 d'une source existante, inspecte le projet complet et publie une vue bornée, devenue périmée si les fichiers changent.

**Aucun outil de la 0.41.21 n'effectue une extraction automatique**, aucune commande CHAIN/MERGE du projet utilisateur n'est réécrite. Un lien statique identifié n'est pas une preuve de conservation de l'état.

## Qualification sur le véritable firmware CPC 6128

Le script `scripts/qualify-basic-multifile-loading.mjs` construit via `buildProjectDisk` quatre disquettes de référence puis démarre le moteur CPC WASM avec les ROM réelles OS/BASIC 1.1/AMSDOS validées par empreintes SHA-256. Les ROM sont des entrées externes : elles ne sont jamais intégrées au dépôt, au rapport ni aux artefacts publiés.

| Scénario | Configuration | Assertion |
| --- | --- | --- |
| CHAIN monolithique | MAIN.BAS seul | Marqueurs mémoire 11, 23, 24 |
| CHAIN multifichier | MAIN.BAS et LEVEL.BAS, CHAIN du second | Marqueurs 11, 23, 24 ; comparaison avec le témoin |
| MERGE monolithique | MAIN.BAS avec une routine GOSUB 100 | Marqueurs 11, 24, 23 |
| MERGE multifichier | MAIN.BAS et PART.BAS, MERGE puis GOSUB 100 | Marqueurs 11, 24, 23 ; comparaison avec le témoin |

Le script vérifie l'identité du firmware et de l'écran de démarrage, l'inventaire AMSDOS des fichiers de chaque disque et les valeurs réellement écrites en RAM par la machine après RUN. Il compare les scénarios monolithiques et multifichiers **uniquement pour ces témoins**. Les résultats comprenant les empreintes des disques, du moteur et des sources, et les observations mémoire, sont enregistrés dans `out/basic-multifile-loading-qualification.json`.

Cette recette est **bloquante dans la CI Linux Desktop** ; un échec CHAIN ou MERGE empêche la validation de la PR. Elle ne repose pas sur une simulation abstraite des commandes BASIC. Toute différence ou limitation doit être conservée dans les logs/rapports, et ne doit pas être masquée en modifiant le résultat attendu.

## Limites de preuve

Les quatre fixtures ne démontrent pas la préservation générale des variables implicites, de la pile de GOSUB, des DATA/RESTORE, des adresses mémoire, des interruptions, des ressources graphiques, du timing ou des scripts binaires. CHAIN MERGE est inventorié par le contrat statique, mais **ne fait pas encore partie des cas dynamiques qualifiés**. La cible et le résultat sur ces autres profils doivent être établis par des témoins firmware supplémentaires. La machine émulée et son jeu de ROM sont spécifiques au CPC 6128 de référence : aucune qualification matérielle physique ou émulateur indépendant n'est revendiquée.

## Prochaine tranche

Construire des témoins ciblés de CHAIN MERGE, de persistance d'état, de remplacement/conflit de lignes lors d'un MERGE et de ressources mémoire, puis étendre les contrats de restauration atomique. Un découpage automatique d'un sous-programme ne pourra être proposé qu'après une vérification des chargements réels **du projet modifié** et de ses dépendances.
