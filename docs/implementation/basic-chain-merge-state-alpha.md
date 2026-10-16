# CHAIN MERGE : variables, lignes et ressources — qualification 0.41.22

**Complément 0.41.23 :** [tests de cas limites et comportements divergents](basic-chain-merge-edge-alpha.md), sans extension des garanties à des programmes arbitraires.


## Périmètre

La 0.41.21 a confirmé sur les ROM CPC 6128 de référence le comportement d'un témoin CHAIN, ainsi que le fait qu'un MERGE ordinaire lancé pendant RUN n'enchaîne pas les instructions suivantes dans le scénario testé. Ce nouveau lot **ne convertit toujours aucun sous-programme utilisateur** : il étend la qualification par des témoins comparatifs exécutés sur le firmware.

## Six témoins contrôlés

Chaque paire construit des DSK AMSDOS réels et compare un programme monolithique à une variante qui emploie **CHAIN MERGE "PART.BAS",numéro**. Le jeu de ROM est fourni comme entrée externe et vérifié par SHA-256 ; aucun contenu ROM n'est publié.

| Paire | Témoin monolithique | Version à deux fichiers | Ce qui est vérifié |
| --- | --- | --- | --- |
| Variables et conflits | Variable entière partagée, routine aux lignes 100–120 | CHAIN MERGE surcharge les mêmes numéros, lit la variable et écrit les marqueurs RAM | Conservation de la valeur et priorité de la routine chargée pour ce témoin |
| DATA / RESTORE | RESTORE 500, READ de deux valeurs | CHAIN MERGE surcharge DATA 500, puis exécute RESTORE 500 et READ | Provenance des valeurs lues après fusion explicite |
| HIMEM | MEMORY &7FFF suivi d'observations de HIMEM | CHAIN MERGE vers une routine qui observe HIMEM | Valeur de limite mémoire observable pour ce témoin |

Le script `scripts/qualify-basic-chain-merge-state.mjs` vérifie les disques, les fichiers source et leurs empreintes, l'écran Ready, l'exécution des cinq instructions/étapes pertinentes et les quatre octets de résultat à partir de l'adresse `&8000`. Il publie uniquement un JSON d'observations et de hashes dans `out/basic-chain-merge-state-qualification.json`. **Les valeurs attendues sont des hypothèses de test jusqu'à leur réussite constatée dans le workflow GitHub** : une divergence doit être analysée et documentée, et ne doit pas être dissimulée pour rendre le workflow vert.

Cette recette est appelée depuis le workflow Linux **Desktop editor**, après les témoins 0.41.21, et bloque la CI en cas d'échec. Elle n'établit pas une équivalence générale : elle vérifie des observations RAM dans un état ROM/emulateur donné. Les effets sur le temps d'exécution, les interruptions, la pile GOSUB, les ressources graphiques ou les tableaux complexes restent non qualifiés.

## Revue dans CPCéleste

L'outil d'agent `language_chain_merge_review` travaille **en lecture seule** sur deux sources déclarées, avec ID et SHA-256 exacts. Il recense :
- les numéros de lignes communs qui pourraient être remplacés lors du chargement ;
- les identifiants observés dans les deux listings, sans les qualifier automatiquement comme variables persistantes ;
- les emplacements DATA et la présence de READ/RESTORE ;
- les directives MEMORY/HIMEM, PEEK/POKE, types implicites et flux chargés ou asynchrones ;
- les diagnostics bloquants éventuels, les limites d'analyse et les risques à contrôler.

Le panneau Agent IA présente les collisions, variables communes et réserves. Une modification après l'analyse marque celle-ci périmée. L'outil ne modifie pas les programmes et ne peut pas autoriser une extraction ; les routines complexes doivent avoir une validation CPC dédiée sur le **code de production réel** avant toute transformation.

## Étapes suivantes

Compléter les tests par les sous-programmes avec tableaux, variables chaîne, pointeur DATA sans RESTORE explicite, collisions de lignes non contiguës, CHAIN MERGE avec option DELETE, les fermetures de fichiers et les limites mémoire proches du maximum. Ensuite concevoir une transaction multifichier atomique avec simulation de chargement, contrôle des références, essais avant/après sur le projet utilisateur, et restauration de tous les fichiers en cas d'échec.
