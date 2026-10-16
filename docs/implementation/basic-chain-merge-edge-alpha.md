# CHAIN MERGE — profils limites et divergences sur firmware CPC (0.41.23)

Cette version étend les témoins sur ROM CPC 6128 : **tableaux et chaînes**, **READ sans RESTORE**, **DELETE d'une plage de lignes** et **allocation d'un tableau entier important sous MEMORY &7FFF**. Le moteur et les ROM sont identifiés par SHA-256 ; aucun fichier ROM n'est publié.

Le script `scripts/qualify-basic-chain-merge-edge.mjs` fabrique huit DSK témoins et relève quatre octets mémoire après exécution. Les quatre paires servent à distinguer une équivalence locale d'une **divergence attendue**. Les hypothèses de test sont : tableaux/chaînes conservés ; pointeur DATA repositionné si un CHAIN MERGE survient entre deux READ sans RESTORE ; suppression d'une plage via DELETE ; tableau fortement alloué toujours accessible dans la configuration testée. Seule la CI sur les véritables ROM peut transformer ces hypothèses en observations qualifiées.

L'agent conserve un contrat en lecture seule : `inspectChainMergeOverlay` ajoute des alertes explicites pour tableaux, chaînes, `READ` sans `RESTORE` et clause `DELETE`. Il ne simule ni allocations dynamiques, ni collisions sémantiques, ni durée des traitements. Le modèle peut proposer une stratégie ; il ne peut pas déduire une équivalence d'une correspondance de noms.

## Portée et limites

- Les résultats concernent **uniquement** la ROM émularisée épinglée et ces DSK contrôlés, sans émulateur indépendant ni machine physique.
- Le comportement d'une commande au sein d'un jeu dépend aussi de l'exécution conditionnelle, des interruptions, des fichiers ouverts, de la pile et des ressources graphiques : hors de portée de cette tranche.
- Le tableau de grande dimension étudie une pression mémoire **délimitée** ; il ne qualifie pas les seuils de pénurie complète ni toutes les combinaisons MEMORY/HIMEM.
- Le paramètre DELETE est testé contre son absence avec un saut calculé vers une ligne qui doit être supprimée : la différence attendue doit être constatée en RAM et non présumée.
- Le pointeur DATA est observé sans RESTORE après chargement, avec témoin monolithique : la différence est **attendue** et utile pour refuser une extraction naïve.

**Aucune extraction multifichier automatique** n'est autorisée par ce lot. Prochaine étape : conception du plan transactionnel avec duplication de fichiers, aperçu global, contrôle de révision et restauration atomique, avant essais de modification de programmes historiques.
