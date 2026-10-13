# Atelier Z80 et projets binaires — alpha 0.41.5

## Utiliser l’atelier

Dans **Fichier → Importer une disquette DSK…** ou **Récupérer un fichier CPC…**, cocher **Créer un projet binaire**. Ce mode est proposé automatiquement si aucun BASIC convertible n'est reconnu. Tous les fichiers deviennent des ressources préservées ; choisir explicitement le fichier à lancer. L'import ne prétend pas que tous les binaires soient des programmes.

Le projet s'ouvre dans l'atelier Z80 et se retrouve ensuite par **Ouvrir un projet** ou les projets récents. Aucune source BASIC artificielle n'est créée. Pour lancer avec F5, l'entrée doit avoir un en-tête AMSDOS binaire valide et une adresse d'exécution située dans la charge utile. Sinon, conserver le projet pour l'étude ; le lancement automatique est refusé.

1. Choisir un fichier et examiner les métadonnées et les 256 premiers octets hexadécimaux de sa charge utile.
2. Définir décalage, longueur (1–16 384 octets), adresse logique explicite et interprétation **code présumé** ou **données**. Les valeurs de l'en-tête sont des propositions, pas une preuve de cartographie.
3. **Créer une zone et vérifier l'aller-retour** produit une copie assembleur et vérifie immédiatement qu'elle restitue les octets originaux. Les instructions non qualifiées et les encodages ambigus restent en DEFB. Les zones non classées restent inchangées.
4. Ajouter notes/hypothèses et modifier le listing. **Enregistrer l'analyse**, Ctrl S ou Ctrl Maj S conserve les zones dans `binary-z80.json`. On peut conserver un brouillon assembleur invalide pour le reprendre ; il ne pourra pas être exporté ou exécuté.
5. **Vérifier le réassemblage** affiche le nombre d'octets différents. L'origine et la taille de chaque zone doivent rester identiques. Aucun déplacement automatique des routines, adresses publiques ou tables.
6. **Tester la copie modifiée** ouvre une nouvelle session CPC depuis la révision enregistrée et vérifiée. **Exporter le DSK modifié…** produit une copie avec les binaires modifiés, en-têtes et autres ressources préservés. Les deux actions refusent les annotations périmées et les ressources modifiées extérieurement.

F5 et l'export DSK général utilisent toujours les ressources originales reconstruites. Les commandes spécifiques de l'atelier appliquent les modifications assembleur. Les programmes qui dépendent des secteurs physiques peuvent ne pas fonctionner sur une disquette reconstruite.

## Conservation et contrat

Le manifeste v1 ajoute le discriminant facultatif `kind: "binary"` : aucune source BASIC, au moins une ressource et une entrée référant à cette ressource. Les projets BASIC existants ne changent pas. Une ancienne version qui ne connaît pas ce mode le refuse explicitement. [Contrat projet](../../contracts/project.schema.json).

Chaque zone conserve identifiant, ressource, SHA-256 original, offset de charge utile, taille, origine, type d'interprétation, notes et listing. Maximum 128 zones, pas de chevauchement, fichier de 1 Mio maximum. [Contrat des annotations](../../contracts/binary-analysis.schema.json). La sauvegarde compare la révision de disque avant remplacement atomique ; rouvrir après une modification externe. Les fichiers et métadonnées AMSDOS d'origine ne sont jamais modifiés par les patches : seules les plages de charge utile sont appliquées à des copies.

Une annotation représente le choix de l'utilisateur. L'atelier ne déduit pas automatiquement la séparation code/données, ne retrouve pas les noms historiques et ne relocalise pas les liens quand une origine ou un fichier change. Les brouillons non enregistrés déclenchent le même avertissement de fermeture/changement de projet que les sources BASIC. La récupération après crash avant sauvegarde et l'historique propre aux analyses restent à réaliser ; le JSON enregistré peut être versionné avec le projet.

## Dialecte et limites de l’assembleur

Dialecte local CPCéleste : ORG unique, labels insensibles à la casse, entiers décimaux/hexadécimaux (`$` ou `0x`), instructions Z80 documentées prises en charge et DEFB. Pas d'expressions, macros, includes, fichiers externes ou shell. Déplacements relatifs/indexés signés contrôlés, limite 16 Kio par zone, pas de dépassement 16 bits. Les labels servent aux branches et opérandes du listing ; aucun suivi de flot n'est annoncé.

La table des formes sans opérande immédiat est dérivée du décodeur existant ; les opérandes, sauts et formes indexées sont encodés localement. Un aller-retour identique est une preuve de conservation, pas une preuve indépendante d'interprétation du code. Les alias qui ne permettent pas de retrouver exactement l'encodage original restent en DEFB. La génération vérifie chaque instruction puis la zone complète. La comparaison externe du décodeur 0.41.3 reste distincte ; cet assembleur ne revendique pas une qualification exhaustive indépendante.

L'agent BASIC ne modifie pas encore les projets binaires. L'intégration IA, les graphes/entrées multiples, les annotations des ressources dans un projet BASIC mixte, les cartes RAM/bancs, les sources assembleur multifichiers, la relocalisation et la décompilation de haut niveau restent au backlog.

## Preuves de cette tranche

- 415 tests unitaires : vecteurs d'encodage connus, labels avant/arrière, limites et refus ; 1 792 séquences couvrant les préfixes, alias, octets inconnus et troncatures en aller-retour ; projet sans BASIC, réouverture, conservation des ressources, copie modifiée, révisions obsolètes, symlinks et empreintes invalides.
- Parcours Chromium avec vrai worker/stockage : import binaire, création d'une zone, annotations, sauvegarde clavier, réassemblage identique puis un octet modifié, export et réouverture. Préparation du lancement modifié raccordée et vérifiée ; ROM volontairement absentes de cette recette UI.
- Recette native `CPC_TEST_ROM_DIR=… node scripts/qualify-binary-workbench.mjs` : import d'un programme original de sept octets, désassemblage/réassemblage, modification de LD A,77 en LD A,78 puis RUN du binaire. La RAM à &9000 contient respectivement 77 et 78 ; originaux inchangés. Profil CPC6128 anglais et empreintes ROM contrôlées comme les recettes précédentes. Script ajouté au job existant ; aucun workflow supplémentaire.
- Deflektor fourni localement : projet binaire de trois ressources, chargeur DISC.BIN de 190 octets réassemblé à l'identique, tous les enregistrements du DSK conservés. Disques initial et reconstruit exécutés jusqu'au menu, capturé et inspecté. Aucun jeu ni capture commerciale dans Git ; partie complète et émulateur indépendant non qualifiés.
- Recette IPC Electron ajoutée à la suite habituelle : création binaire, lecture parallèle du catalogue/analyse, génération, sauvegarde, révision périmée et export. Vérifier le résultat CI de la tête de PR avant d'annoncer la validation native desktop.

La [recette de disquette réelle](recovery-protection-alpha.md#compatibilité-historique-et-essais-réels--0414) accepte maintenant également une entrée binaire, par exemple `DISC.BIN`. Le premier objectif de la suite est d'étendre l'atelier aux projets mixtes et de qualifier les encodages avec un assembleur indépendant, puis les interventions assistées par IA sur des routines comprises.
