# Récupération et protection — alpha 0.41.3

## Parcours livrés

**Fichier → Importer une disquette DSK…** : catalogue, sélection des BASIC convertibles, aperçu puis nouveau projet. Reconnaissance par contenu : un BASIC nommé BIN est récupérable. ASCII, tokenisé AMSDOS type 0 et protégé type 1 sont pris en charge dans le sous-ensemble décrit ci-dessous. Les ressources voisines sont copiées sous `assets/`, déclarées dans le manifeste et réintégrées au build, à F5 et à la construction demandée par l'agent. Les noms CPC ne changent pas.

**Fichier → Récupérer un fichier CPC…** applique la même détection à un fichier isolé. Nom CPC 8.3 requis ; BASIC tokenisé sans en-tête accepté seulement si toute sa structure est valide. Un fichier sans BASIC convertible peut être extrait et étudié sans créer artificiellement de projet vide.

Dans l'aperçu d'un fichier non convertible, **Extraire les octets originaux…** conserve ses enregistrements. **Désassembler la plage Z80** demande une origine explicite (préremplie depuis un en-tête AMSDOS), un décalage dans la charge utile et une longueur. Le listing montre instructions, adresses, octets et offsets, avec provenance SHA-256. On peut l'annoter puis enregistrer un `.asm`. Cette sortie est documentaire : pas de build assembleur ni de transformation automatique en BASIC. Les binaires peuvent contenir des images ou données ; leur désassemblage ne prouve pas qu'ils sont du code.

**Fichier → Exporter avec protection…** : choisir un mode, prévisualiser puis enregistrer un nouveau DSK. Le projet clair reste intact.

| Mode | Résultat |
| --- | --- |
| Obfuscation seule | Listing ASCII renommé/commentaires retirés selon options, éventuellement renuméroté |
| BASIC protégé seul | Sources tokenisées et protégées au format SAVE P |
| Combiné | Copie obfusquée puis format SAVE P ; sa déprotection restitue la copie obfusquée |

La table de correspondance et le source clair ne sont pas ajoutés au DSK. Les ressources BASIC laissées brutes bloquent cet export. Les autres ressources sont conservées ; leur contenu peut lui-même être lisible. La protection historique reste réversible.

## Compatibilité exacte

- Conteneurs standard et Extended ordinaires, DATA ou SYSTEM, 40 pistes/une face/utilisateur 0, secteurs 512 octets sans erreur, répertoire à extents et blocs 1 Kio. Reconstruction en DATA standard uniquement. Noms limités aux lettres ASCII majuscules, chiffres, underscore et `&`, format 8.3. La variante qualifiée en 0.41.7 est décrite ci-dessous.
- BASIC : lignes croissantes, tokens connus, entiers/réels/hexadécimaux/binaires, noms de variables, RSX, chaînes, DATA et commentaires. Pointeurs de lignes en mémoire refusés. La présentation peut être normalisée ; commentaires et noms conservés lors de l'import, lorsqu'ils existent dans le fichier.
- Les caractères CPC graphiques/contrôles non représentables en ASCII sont refusés pour l'édition plutôt que remplacés silencieusement. Les originaux restent extractibles. Ce n'est pas encore un convertisseur intégral du jeu de caractères CPC.
- Export tokenisé : source de 65 535 caractères maximum, 255 caractères par ligne ; programme encodé au plus 65 535 octets. Les contraintes réelles de mémoire BASIC et de disquette peuvent être inférieures.
- Obfuscation : un seul programme autonome, index de symboles complet pour renommer, première lettre/suffixes conservés. DEF FN/portées, accès machine/mémoire/temps, RSX et chargements externes non qualifiés sont refusés. Le protégé seul reste disponible quand l'obfuscation est refusée. Aucun contrat d'identité des temps d'exécution.
- Z80 : lecture linéaire bornée à 16 Kio, sans dépassement 16 bits. Instructions documentées de base/CB/ED/IX/IY et CB indexées ; encodages non documentés/ignorés ou tronqués conservés en DEFB. Pas de suivi de flot, banque, décompression, symboles historiques, assembleur ou décompilateur de haut niveau.

## Vérification

407 tests unitaires réussis, TypeScript strict aux frontières, compilations renderer et main, parcours Chromium avec vrai worker et fichiers réels : BASIC protégé importé, ressources conservées, lecture Z80 et enregistrement des trois modes sans altérer la source. Une recette IPC native étend le smoke Electron ; résultat distant à vérifier à la tête de PR.

`CPC_TEST_ROM_DIR=… node scripts/qualify-basic-recovery.mjs` compile un harness natif du moteur CPC intégré. Il charge le programme clair puis les trois distributions, compare le fichier RESULT produit, et récupère les vrais SAVE P et SAVE A générés par le firmware. Profil explicite CPC6128 anglais, empreintes des trois ROM contrôlées ; aucune ROM dans Git. Un second scénario importe un BASIC protégé et son CODE.BIN, modifie le calcul, reconstruit puis exécute LOAD/CALL : résultat 78 vérifié et disque original inchangé. Les résidus après CTRL-Z de SAVE A sont préservés dans l'original et exclus du listing.

`Z80_REFERENCE_DIR=… node scripts/compare-z80-reference.mjs` compare au commit `2ff52822f0d706f9f39762e079f300f45cfd451d` de maziac/z80dismblr : 699 encodages décodés, 693 identiques ; six divergences documentées et attendues. Deux sont les noms Zilog OTIR/OTDR, quatre concernent le déplacement obligatoire de INC/DEC (IX/IY+d), omis par cette version de référence. Le tableau de contrôle est enregistré dans `out/z80-comparison.json`. Cet outil externe n'est pas embarqué.

Le build WASM local est bloqué par un crash SIGSEGV de `clang --version` du SDK Emscripten dans cet environnement. Le build renderer/main et la recette firmware native sont distincts et exécutables. Aucun nouvel installeur ni nouvelle qualification matérielle/émulateur indépendant annoncés. Les contrôles CI usuels vérifient le build complet ; aucun packaging manuel supplémentaire déclenché.

## Suite

Qualifier le jeu de caractères CPC et les programmes réels fournis sans publication implicite ; étendre noms/profils multi-face/utilisateurs ; rendre les dépendances visibles avant import ; ajout à un projet existant avec conflits ; annotation Z80 persistante dans l'atelier, assembleur et aller-retour binaire. Un programme réellement compilé ne restitue pas universellement le BASIC d'origine : cela demande un format/compiler identifié ou une réécriture explicitement qualifiée.


## Compatibilité historique et essais réels — 0.41.4

Le lecteur d'import accepte aussi les signatures standard exactes `MV - CPCEMU Disk-File` complétées par des espaces jusqu'à 34 octets et `Track-Info` complétées par deux espaces. Aucun préfixe approximatif, octet nul ou padding arbitraire n'est accepté. Les contrôles de géométrie, secteurs, statuts et allocations restent bloquants. Les en-têtes Extended ne changent pas. Les copies originales restent intactes ; le writer et le montage natif continuent à utiliser les signatures canoniques.

Recette du 13 octobre, sur trois DSK fournis localement :

| Image examinée | Récupération | Observation |
| --- | --- | --- |
| Nebulus, variante Aragorn | NEBULUS.BAS éditable et sept ressources | Projet créé, rouvert, reconstruit ; question sur les options puis menu du jeu atteints |
| Vindicator | VIND.BAS éditable et sept ressources | Variante d'en-têtes acceptée directement ; projet reconstruit ; illustration de chargement puis menu atteints |
| Deflektor | Trois binaires, aucune source BASIC reconnue | Extraction et désassemblage du chargeur DISC.BIN ; aucun projet BASIC artificiel ni essai de lancement revendiqué |

Pour les deux projets, les sept ressources restent identiques octet par octet, noms inclus. Les observations natives comparent le DSK initial (seules les signatures de Vindicator sont normalisées dans une copie pour le montage) à la disquette reconstruite depuis le listing ASCII récupéré. Même profil CPC6128 anglais et mêmes ROM que la recette ci-dessus. Les captures sont inspectées visuellement : ce n'est ni une comparaison pixel parfaite d'animations, ni une partie complète, ni une qualification sur émulateur indépendant. Les jeux complets et leurs captures ne sont pas publiés dans le dépôt.

Recette manuelle reproductible, sans déclencher de workflow ou distribuer de jeu :

```sh
CPC_TEST_ROM_DIR=/chemin/roms node scripts/qualify-real-disk.mjs /chemin/nebulus.dsk NEBULUS.BAS 15 n 30 ''
CPC_TEST_ROM_DIR=/chemin/roms node scripts/qualify-real-disk.mjs /chemin/vindicator.dsk VIND.BAS 15 ' ' 30 ''
```

Chaque paire indique le nombre de secondes émulées avant la capture, puis les touches à envoyer. Le script vérifie les empreintes ROM, importe via le vrai worker, crée/rouvre/reconstruit le projet et compare les ressources. Il compile `tests/native_disk_recovery.c` avec GCC et les headers chips déjà préparés, puis produit rapport JSON, copies DSK et captures PPM sous `out/real-disk-*`. Examiner les captures pour conclure sur le lancement : un processus natif terminé ne prouve pas que le jeu fonctionne. Le projet temporaire peut être rouvert depuis le chemin du rapport. Cette recette est limitée à DATA standard 40 pistes ; le script ne télécharge aucun fichier.

409 tests unitaires réussis, dont deux nouveaux tests synthétiques : import réel des en-têtes à espaces avec conservation/reconstruction, et refus des signatures voisines, secteurs erronés/dupliqués, allocations invalides et troncatures. Aucun fichier commercial n'est utilisé par la CI.

Suite prioritaire : atelier persistant pour les disquettes entièrement binaires, séparation code/données annotable et round-trip assembleur qualifié ; tests de parties et d'émulateur indépendant ; extension contrôlée des caractères et profils. Le BASIC récupéré dans ces deux exemples est un chargeur : le code machine du jeu ne redevient pas automatiquement un source BASIC.


## Import historique et diagnostic — 0.41.7

Le lecteur accepte ST1=&80 seul (fin de cylindre), sans ignorer les autres indicateurs FDC. Pour Extended DATA/SYSTEM, il accepte neuf secteurs usuels de 512 octets accompagnés, au maximum, d’un secteur supplémentaire de 256 octets (CA en DATA, 4A en SYSTEM). L’ordre physique est libre, y compris un secteur supplémentaire en première position. Les adresses, tailles, doublons, statuts, bornes et allocations restent contrôlés. Les erreurs de secteur précisent désormais piste, identifiant et motif.

L’aperçu indique les particularités détectées et rappelle que les secteurs hors système de fichiers restent **uniquement dans le DSK original intégral**, pas dans la reconstruction DATA. Les avertissements sont conservés dans `import-report.json` (convertisseur `basic-resources-import-3`). Les noms comme `F&F.BAS` sont préservés au catalogue, dans le manifeste, au build et dans la commande RUN ; les chemins locaux restent générés à partir des identifiants.

L’aperçu calcule aussi les blocs et entrées de catalogue nécessaires à la sélection : convertir du BASIC tokenisé en ASCII peut saturer un disque presque plein. L’import et l’édition restent possibles ; un dépassement est indiqué avant création, avec les valeurs conservées dans le rapport. Sélectionner moins de BASIC à convertir conserve les autres fichiers comme ressources brutes. Cela ne constitue pas encore un export automatique retokenisé ni une répartition automatique entre disquettes.

### Cas fourni : Fer & Flamme, disquette 1 sur 4

L’image examinée contient 40 pistes, une face, 368 secteurs avec ST1=&80 dont huit secteurs supplémentaires sur les pistes 5, 10, 15, 20, 25, 30, 35 et 39. Le catalogue fournit **47 fichiers**. Cinq listings sont convertibles : `F&F.BAS`, `F&F2.BAS`, `F&F3.BAS`, `TRANSIT.BAS` et `W86.BAS`. `DEF1.BAS` porte un en-tête BASIC protégé, mais sa structure ne passe pas la validation du détokeniseur : conservation brute, sans prétendre en avoir récupéré une source fiable.

Recette locale : vrai worker, création/réouverture du projet, cinq sources et 42 ressources ; DSK original et enregistrements conservés octet par octet. L’export des cinq sources en ASCII dépasse la capacité DATA et est refusé sans perte de fichiers. En sélectionnant uniquement `F&F.BAS`, la reconstruction tient exactement dans 178 blocs : 47 fichiers relus, 46 ressources identiques aux originaux. Cela permet de travailler progressivement. Aucune exécution du jeu, vérification de ses protections ou des trois autres disquettes n’est revendiquée. Aucun octet du jeu ni capture commerciale n’est versionné.

Les régressions utilisent des disquettes synthétiques : DATA et SYSTEM, interleave, secteur supplémentaire en tête, statuts EN/erreurs FDC, secteurs faibles/dupliqués/tronqués, allocations invalides, noms avec `&`, import/réouverture/build et prévision de capacité. Le parcours navigateur contrôle les avertissements avant import et le maintien de l’import lorsque la reconstruction dépasse la capacité.

Références techniques : [définition Extended DSK par ses auteurs](https://cpctech.cpcwiki.de/docs/extdsk.html), [registres uPD765 dans le moteur chips](https://github.com/floooh/chips/blob/master/chips/upd765.h). Le bit EN est distinct des erreurs CRC, données absentes et dépassements ; cette tolérance ne répare pas un secteur défectueux.
