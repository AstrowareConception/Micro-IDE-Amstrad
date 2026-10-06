# Inspection CPC et première preuve de débogage — alpha 0.35

Date : 6 octobre 2026. Incrément de LOT-5 et IDE-055, sans clôture J0/J3 ni débogueur BASIC public.

## Utilisation

Exécuter/F5 lance le CPC comme auparavant. Cliquer **Pause CPC**, puis ouvrir **Inspection CPC en pause** sous l’écran. Saisir une adresse hexadécimale (`8000`, `&8000` ou `0x8000`) et cliquer **Lire les registres et la RAM**. Quinze valeurs décrivent les registres principaux/alternatifs, la configuration RAM, la sélection ROM et le gate array ; jusqu’à 64 octets sont affichés en hexadécimal et ASCII, avec l’instant en ticks. À `FFFF`, un seul octet est lu : la plage ne reboucle pas sur zéro.

La RAM est celle des banques actives, **derrière les ROM** ; elle diffère du bus de lecture CPU lorsque les ROM sont visibles. PC est le compteur interne Z80, éventuellement au milieu d’une instruction ; ce n’est pas une ligne BASIC. Reprendre ou relancer retire la lecture précédente. L’inspection n’écrit ni la mémoire, ni le disque, ni le listing. Elle ne décode pas les variables ou la pile BASIC.

Une demande explicite produit un seul message worker et une lecture atomique pendant la pause. Aucun polling mémoire, hook d’instrumentation ou minuteur supplémentaire n’est activé par l’ouverture de cette vue. Les réponses d’une ancienne demande/session sont refusées. Les données restent dans la session locale, sans stockage ni outil IA ni export ajouté.

## Première preuve D1

Le pont expose un arrêt technique ponctuel au **fetch d’un opcode Z80**, filtrable sur la ROM supérieure, ou à expiration d’un budget de 1 à 40 millions de ticks. Le callback reste entièrement dans C ; il est absent après annulation, reprise, reset et destruction. Le budget arrête la machine et distingue cette raison de l’adresse atteinte. Armer le hook ne reprend pas une machine déjà en pause : le harness reprend explicitement, puis arme avant d’avancer. Aucune commande publique de point d’arrêt/pas BASIC n’est ajoutée.

La recette `scripts/qualify-basic-debug.mjs` exige trois fichiers locaux `cpc6128_os.bin`, `cpc6128_basic.bin`, `cpc6128_amsdos.bin` avec les empreintes du jeu anglais identifié. Elle refuse un autre firmware avant instrumentation et génère un DSK de diagnostic distinct. La référence technique est le [désassemblage analysé par Bread80, commit ceb731e](https://github.com/Bread80/Amstrad-CPC-BASIC-Source/blob/ceb731e3211464cfa076e05b37b8403b4b0622f8/Execution.asm), consulté sans importer son code ni sa ROM dans le dépôt.

Sur ce profil, le fetch à `DE60` précède le stockage du pointeur de l’instruction et le traitement des événements synchrones. `HL` désigne l’octet précédant ses tokens ; le mot RAM `AE1D` pointe vers le numéro de ligne. La recette vérifie ce pointeur dans **les enregistrements tokenisés effectivement chargés par BASIC**, depuis `AE64 + 1` jusqu’à la fin annoncée par `AE66`, en RAM configuration zéro. Elle ignore le mode direct où le pointeur de ligne est nul. La chaîne observée est `10, 20, 20, 30, 100, 110, 40, 60, 70` ; les marqueurs `POKE &8000` prouvent l’arrêt avant les instructions attendues, le saut de la ligne 50 et la reprise sans hook.

Natif et WebAssembly doivent produire exactement les mêmes numéros, adresses de ligne/instruction, marqueurs et ticks. La preuve n’est pas un mapping de positions UTF-8/colonnes éditeur : les tokens peuvent être modifiés par la ROM. La provenance inclut empreintes firmware et SHA-256 du listing ; le disque de test est reproductible et séparé des sources utilisateur.

Le `cpc_exec` épinglé retourne le nombre de ticks demandé même après arrêt anticipé ; le pont compte les ticks réellement exécutés quand le hook est armé, et corrige la durée du clavier à ces ticks (résolution d’une microseconde). La voie sans hook conserve son comportement. Le coût du callback actif par tick n’est pas un benchmark de performance : son instrumentation reste un outil de qualification ponctuel.

## Validation et limites

- Tests natifs ASan/UBSan : octets derrière ROM, huit configurations RAM, lecture traversant une frontière de banque, plages invalides, opcode atteint, budget de 23 ticks, stabilité de la pause et retrait du hook.
- WASM : exports réels, lecture stable/bornée, raisons d’arrêt et décompte des ticks.
- D1 réel sur ROM anglaises identifiées : chargement DSK, neuf frontières, deux instructions d’une ligne, `GOSUB/RETURN`, `IF` à cible numérique, reprise ; natif et WASM identiques.
- Recette navigateur avec le moteur réel : `POKE` lu comme `A5`, adresse invalide, `FFFF` borné, lecture supprimée après reprise, redimensionnement/docking et relancement conservés. La même recette Electron est exécutée en CI.

Localement, LeakSanitizer ne peut pas opérer sous l’environnement ptrace : essais C avec `ASAN_OPTIONS=detect_leaks=0:halt_on_error=1`, ASan/UBSan actifs. La CI conserve la détection des fuites par défaut. Les recettes Electron locales et le build Windows sont à confirmer par CI ; aucune qualification matérielle/émulateur indépendant supplémentaire n’est revendiquée.

**D1 est partiellement prouvé**, D2/D3/D4 restent ouverts. Timers, événements `ON ERROR/ON BREAK`, `INPUT` bloquant, `FOR/NEXT`, code modifié en mémoire, programmes protégés/chargements successifs, ROM françaises/autres versions et correspondance source révisionnée restent à qualifier avant l’interface de débogage BASIC. La routine pollant les événements après le fetch, ce point est « avant l’instruction prévue et avant les événements », pas une garantie de la prochaine instruction effectivement exécutée en présence de callbacks BASIC.

Reproduire après `npm run chips:fetch`, `npm run build:wasm` et préparation explicite des ROM autorisées :

```bash
CPC_TEST_ROM_DIR=/chemin/vers/roms node scripts/qualify-basic-debug.mjs
```

Rapport local : `out/basic-debug-qualification.json` ; CI Linux conserve ce rapport et les captures navigateur/Electron. La recette ne télécharge aucune ROM.
