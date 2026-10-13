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

- Conteneurs standard et Extended ordinaires, DATA ou SYSTEM, 40 pistes/une face/utilisateur 0, secteurs 512 octets sans erreur, répertoire à extents et blocs 1 Kio. Reconstruction en DATA standard uniquement. Noms limités aux lettres ASCII majuscules, chiffres et underscore, format 8.3.
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
