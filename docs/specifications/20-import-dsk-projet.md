# 20 — Retrouver un projet éditable depuis une disquette DSK

Demande produit du 13 octobre 2026. **Statut : partiel — BASIC ASCII/tokenisé/protégé et ressources réalisés en 0.41.3 ; profils ordinaires DATA/SYSTEM standard/Extended ; variante standard à en-têtes remplis d’espaces qualifiée en 0.41.4 ; projets binaires sans source BASIC ajoutés en 0.41.5.** [Guide et limites actuels](../implementation/recovery-protection-alpha.md). Cette fonctionnalité relie IDE-006, IDE-046 et IDE-047 ; elle ne crée pas un second système de projets. L'objectif est de reprendre ses programmes CPC d'époque, de les modifier dans l'éditeur et avec l'agent IA, puis de les tester et d'en produire une nouvelle disquette.

## Résultat attendu

Depuis **Fichier → Importer une disquette DSK…**, l'utilisateur choisit une image, consulte son catalogue, sélectionne les fichiers utiles et crée un projet dans un nouveau dossier. Les programmes BASIC reconnus deviennent des sources éditables. Les données, écrans et binaires associés sont conservés avec leurs noms CPC et métadonnées. Le DSK fourni reste intact.

Exemple de parcours de recette : une disquette contient `MENU.BAS`, `JEU.BAS`, `IMAGE.SCR` et `SCORES.DAT`. L'utilisateur importe les quatre fichiers, choisit `MENU.BAS` comme entrée, ouvre `JEU.BAS`, demande à l'IA d'expliquer puis d'améliorer le calcul des scores, examine les changements, exécute le projet et exporte une nouvelle disquette. La réussite exige de conserver les dépendances, pas seulement de pouvoir afficher le premier `.BAS`.

## État réel du socle

Au commit `50949c2` de `main`, version 0.41.1 :

- `packages/cpc-disk/src/data-disk.ts` construit et relit un DSK **standard DATA, 40 pistes, une face, utilisateur 0**, avec des contrôles stricts. Il reconstitue les fichiers par extents et blocs, et tient compte des identifiants de secteurs. Ce lecteur ne prend pas en charge Extended, SYSTEM ni toutes les conventions de noms CP/M.
- `basic-ascii.ts` encode un listing ASCII strict vers le CPC. Ce n'est pas un détokeniseur ni un convertisseur complet de caractères CPC.
- `amsdos-binary.ts` sait encoder/décoder un binaire AMSDOS de type 2 dans son périmètre contrôlé. Ce n'est pas une détection universelle des types de fichiers.
- Les projets, l'éditeur, les outils IA et les mécanismes de reprise existent. L'assistant DSK, la conversion BASIC tokenisée et leur raccordement durable restent à réaliser.

Les ambitions d'import du [document 07](07-construction-dsk.md) ne constituent donc pas une preuve de compatibilité actuelle.

## Parcours utilisateur

1. **Analyser.** Dialogue natif, puis lecture locale bornée et annulable. Aucun lancement de programme ni appel IA. Distinguer format du conteneur, format logique reconnu et état du catalogue.
2. **Prévisualiser.** Tableau nom CPC, utilisateur/face si applicables, taille, type détecté, destination et résultat prévu : « BASIC éditable », « ressource conservée », « extraction brute », « non pris en charge » ou « endommagé ». Montrer les raisons d'une classification incertaine ; l'extension `.BAS` seule ne suffit pas.
3. **Sélectionner.** Aperçu du listing avant import. Proposer la conservation des ressources voisines ; repérer les noms littéraux utilisés par `RUN`, `CHAIN`, `MERGE`, `LOAD` et `OPENIN`, tout en indiquant que les noms calculés peuvent masquer des dépendances. Ne rien renommer silencieusement.
4. **Créer.** Choisir un dossier vide et un point d'entrée parmi les BASIC convertibles. Présenter les fichiers et avertissements. Créer le projet en une opération récupérable, puis l'ouvrir. Aucun écrasement d'un projet existant. L'ajout à un projet existant suivra avec aperçu des conflits et protection des buffers.
5. **Reprendre.** Sources dans les onglets habituels, ressources dans l'explorateur, rapport d'import accessible. Utiliser les mêmes analyses, historique et missions IA que pour les programmes créés dans l'IDE.
6. **Tester et exporter.** F5 reconstruit une copie de travail avec les ressources explicitement incluses. Export vers un nouveau DSK ; distinguer cette reconstruction de la disquette originale et du disque modifié pendant une session.

Une disquette sans BASIC convertible reste inspectable et extractible. Ne pas inventer un programme d'entrée pour satisfaire le manifeste courant : un projet sans entrée nécessite une évolution contractuelle distincte.

## Compatibilité et conversion

| Contenu | Comportement cible | Limite à annoncer |
| --- | --- | --- |
| DSK standard, format DATA pris en charge | Catalogue, extraction, création de projet | Étendre et tester les noms historiques au-delà du validateur actuel |
| Extended DSK contenant un format DATA ordinaire | Même parcours après qualification du lecteur | Reconnaître Extended ne garantit pas la lecture de toutes les protections |
| SYSTEM, autres géométries, plusieurs faces/utilisateurs | Détection explicite ; extension par profils qualifiés | Pas d'assimilation automatique à DATA ; collisions de noms à résoudre |
| BASIC ASCII | Convertir fins de ligne/EOF vers la source UTF-8 et LF | Ne pas appliquer la coupure au premier CTRL-Z aux binaires |
| BASIC tokenisé non protégé | Décodage local déterministe vers listing numéroté | Tokens, valeurs numériques, variables, RSX et limites de lignes à qualifier |
| BASIC protégé enregistré avec `SAVE ...,P` | Identifier et conserver l'original ; conversion dans un lot dédié | Ne pas présenter un contenu illisible comme source valide |
| Binaires, écrans et données | Conserver octets et métadonnées ; inclure au build si compatible | Un binaire Z80 n'est pas transformé en source BASIC |
| Protection disque, format inconnu, image tronquée | Rapport explicite ; original conservé | Aucune reconstruction dite fidèle sans preuve |

La détokenisation doit préserver les numéros de ligne, les chaînes, `DATA`, commentaires, références et constantes avec leur précision. Elle ne doit ni reformater arbitrairement ni demander au modèle IA de deviner les instructions. Un token inconnu ou une structure invalide produit un diagnostic avec position ; une conversion partielle n'est pas présentée comme un programme fiable.

Le rendu des caractères CPC doit préserver leur valeur lors d'un retour vers le CPC, notamment dans les chaînes et données. Tant qu'un caractère ou une constante n'est pas représentable sans perte par le build, le fichier porte une limite visible et son exécution reconstruite est bloquée avec une raison. Une correspondance Unicode approximative ne suffit pas.

La première sortie peut utiliser le codec ASCII existant **uniquement pour les listings entièrement représentables et qualifiés**. La retokenisation native est un chantier distinct. Un listing ASCII plus volumineux peut dépasser la capacité DATA alors que le fichier tokenisé d'origine tenait sur disque : le rapport doit calculer la capacité réelle et ne perdre aucun fichier.

## Conservation, données et architecture

Conserver trois niveaux séparés : copie intégrale du DSK d'origine, fichiers CPC extraits sans transformation, sources et ressources de travail. Le rapport versionné associe empreinte du disque, profil détecté, identité du fichier (nom/utilisateur/face), empreinte brute, type/en-tête/longueur, destination, version du convertisseur et avertissements. Les enregistrements CP/M bruts ne donnent pas toujours une longueur logique exacte : ne pas supprimer arbitrairement leur remplissage. Ne pas publier de chemins personnels absolus dans les rapports portables.

Les originaux ne sont pas ajoutés automatiquement au build, à Git ou au contexte de l'IA. Ils sont préservés indépendamment des changements de l'agent et des vingt versions de l'historique local. Le choix des chemins persistants, du schéma de rapport et des métadonnées de ressources doit être fixé avec contrats, exemples et ADR avant la réalisation ; ce document ne prétend pas que le manifeste actuel les supporte déjà.

Responsabilités : lecture du conteneur et catalogue dans le domaine disque ; conversion BASIC dans un codec pur ; plan d'import et provenance dans l'application ; dialogues, I/O et journal dans les adaptateurs ; assistant dans l'interface. Réutiliser le journal et les contrôles de révision existants. Aucun besoin d'IA, de ROM ou de réseau pour importer.

Contrôler les bornes d'offsets/tailles, les secteurs absents ou dupliqués, les extents incomplets, les allocations croisées et les checksums AMSDOS. Garder le traitement hors du thread UI, avec quotas et annulation. Les noms CPC restent des données : chemins de destination calculés et confinés, collisions de casse/noms réservés Windows signalées, aucun chemin fourni par l'image exécuté ou suivi. Un échec ne laisse pas un projet incomplet annoncé comme valide.

## Usage avec l'IA

Après import, l'agent lit et modifie les sources dans le périmètre de mission existant. Il peut expliquer le code ancien, documenter ses routines, proposer des corrections et améliorations, avec checkpoint, diff et restauration. Le rapport d'import lui permet de connaître les limites de conversion et les dépendances manquantes sans transmettre toute la disquette.

L'import ne donne aucune permission supplémentaire. L'agent ne peut pas affirmer avoir vérifié le comportement dans le CPC si aucun test n'a eu lieu. L'observation et l'exécution automatiques par l'agent restent rattachées au lot 0.43 ; l'utilisateur peut déjà tester via le parcours humain existant, après intégration des ressources importées.

## Lots et critères de sortie

| Lot | Travail | Preuve attendue |
| --- | --- | --- |
| DSK-A | Inspection standard DATA, aperçu, import BASIC ASCII et originaux vers nouveau projet | Projet portable réouvert, buffers éditables, annulation et reprise sans perte |
| DSK-B | Détection AMSDOS et détokenisation BASIC non protégé | Listings de référence comparés, valeurs/chaînes préservées, tokens invalides refusés |
| DSK-C | Ressources et dépendances, build complet, IA sur sources importées | Programme multifichier modifié, relancé puis exporté ; originaux inchangés |
| DSK-D | Extended DATA puis profils supplémentaires, BASIC protégé et ajout au projet courant | Compatibilité annoncée profil par profil, conflits et refus vérifiés |

DSK-A seul ne satisfait pas la demande de reprise des anciens programmes tokenisés. La première livraison répondant au besoin combine A, B et C pour le profil standard DATA annoncé. D est un élargissement ; les fonctionnalités intermédiaires doivent porter leurs limites. Dans un second temps, les binaires extraits rejoindront l'[atelier de désassemblage Z80](21-retro-ingenierie-z80.md), sans promesse de récupération du source original.

Matrice de recette à constituer avant le code : fichiers ASCII/tokenisés, plusieurs programmes et dépendances binaires, constantes entières/réelles/hexadécimales/binaires, RSX, `DATA`/commentaires/chaînes contenant des octets ressemblant à des tokens, caractères CPC, BASIC protégé, noms sans `.BAS`, faux en-têtes, extents multiples, secteurs interlacés, disque plein, géométries refusées, images tronquées et collisions. Ajouter annulation, interruption de processus, destination modifiée et fichier source changé entre aperçu et validation, puis recette desktop Windows et Linux.

Les images de test doivent être synthétiques ou redistribuables avec provenance ; un DSK réel fourni par l'utilisateur complète la qualification sans être publié par défaut. Comparer au moins un listing à la sortie `LIST` du firmware qualifié et un disque reconstruit à un outil/émulateur indépendant. Distinguer équivalence du programme, conservation binaire des originaux et fidélité du format disque ; elles ne sont pas interchangeables.

## Place dans la roadmap

IDE-006 passe de P2 à **P1** pour ce besoin ; son état devient P avec la tranche ASCII 0.41.2. IDE-046/047 restent P : seul le parcours ASCII est réalisé. L’autorisation de développement priorise désormais l’import : détokenisation et ressources après la tranche ASCII. La séquence FN/portées → accès curseur → renommage reste au backlog. Aucune date de livraison des lots suivants n'est promise.

Références : [construction DSK](07-construction-dsk.md), [contrats](10-donnees-contrats.md), [roadmap produit](17-roadmap-ide-complet.md), [définition Extended DSK par ses auteurs](https://www.cpctech.cpcwiki.de/docs/extdsk.html). La spécification Extended décrit le conteneur ; les détails du codec BASIC demandent une qualification documentaire et firmware propre.
