# CPCéleste — Point de reprise du développement

**Pause demandée le 8 octobre 2026.** Ce document conserve l’état vérifié, les décisions et la suite ; il n’archive pas les conversations. Confronter son contenu au `main` distant avant toute reprise.

## Incrément du 13 octobre — atelier binaire 0.41.5

Base distante : `main` à `5ad4d90ad86aa48443c0dbd5157f2681da7bd398`, PR #65 fusionnée après tous les contrôles réussis. Branche `feat/binary-workbench`. Vérifier la PR de cette branche avant d’annoncer sa fusion ; aucun installateur déclenché.

Réalisé : mode explicite de projet binaire sans faux BASIC ; import DSK/fichier CPC, choix d’entrée, ressources immuables, atelier central avec plages code/données, notes et copies assembleur persistantes dans binary-z80.json, révision et empreintes contrôlées. Assembleur local borné, aller-retour identique avant édition, tailles/origines fixes, export DSK modifié et bouton Tester la copie modifiée ; F5 utilise les ressources originales. [Guide](implementation/binary-workbench-alpha.md), [ADR 0063](adr/0063-atelier-projets-binaires.md).

Preuves : 415 tests unitaires, TypeScript, builds renderer/main et contrôle documentaire réussis (153 Markdown, 21 JSON, six schémas/six exemples). Parcours Chromium réel worker/stockage : import, annotation, Ctrl S, vérification 0 puis 1 octet modifié, export, préparation d’exécution et réouverture ; capture inspectée. Recette native avec ROM contrôlées : binaire de sept octets importé/réassemblé, LD A,77 changé en LD A,78, RAM &9000 observée à 77 puis 78. Deflektor : trois ressources, chargeur de 190 octets réassemblé à l’identique et menu atteint depuis la disquette reconstruite ; aucune partie complète revendiquée. Tests IPC ajoutés à la suite existante, résultat CI de cette tête à vérifier.

Limites : assembleur lié aux tables du décodeur (pas une preuve indépendante complète), 16 Kio par zone, pas de macros/expressions/relocalisation ; annotations des ressources dans projets BASIC mixtes et agent IA binaire non réalisés. Labels manuels, classement humain, aucun graphe/trace/banque ni décompilation BASIC. Brouillons non enregistrés protégés à la fermeture, sans récupération après crash. Suite : qualification assembleur indépendante et projets mixtes, puis routines expliquées/éditées par IA avec tests. Les jeux/ROM/captures commerciales et projets d’essai restent hors Git.

## Incrément du 13 octobre — compatibilité réelle 0.41.4

Base distante : PR #64 fusionnée après réussite des trois workflows, commit `9ef09cb84d05136cedf2140e42f0455c5c96f51e`. Branche `fix/dsk-historical-compatibility`. Le build WASM et les contrôles éditeur Windows/Linux de 0.41.3 sont donc validés en CI, malgré le blocage local du SDK décrit dans l'historique. Vérifier la PR de cette nouvelle branche avant d'annoncer sa fusion.

Trois images réelles étudiées localement sans publication : Nebulus et Vindicator contiennent chacun un chargeur BASIC récupérable et sept ressources ; Deflektor ne fournit aucun BASIC reconnu, seulement trois binaires. Correction ciblée : accepter les signatures standard exactement complétées d'espaces (Vindicator), en conservant tous les contrôles de secteurs/allocations et les originaux. Writer et montage natif inchangés. 409 tests unitaires, vérification TypeScript et contrôle documentaire/schémas réussis. [Guide et recette manuelle](implementation/recovery-protection-alpha.md#compatibilité-historique-et-essais-réels--0414).

Deux projets réellement créés/rouverts/reconstruits ; sept ressources chacun conservées à l'identique. Comparaison native initial/reconstruit avec ROM contrôlées : question du chargeur puis menu Nebulus, illustration puis menu Vindicator atteints. Captures inspectées ; aucune partie complète ni nouvelle validation indépendante revendiquée. Script `qualify-real-disk.mjs` reproductible avec fichiers/ROM locaux ; captures, DSK et projets hors Git, aucune nouvelle CI de jeu ni installation déclenchée.

Suite : projets entièrement binaires persistants (cas Deflektor), annotations code/données puis assembleur avec aller-retour prouvé. Pas de reconstitution universelle BASIC ; tester parties/émulateur indépendant et étendre caractères/profils. Ne pas confondre source du chargeur et source complète du jeu.

## Incrément du 13 octobre — récupération et distribution 0.41.3

Base distante : `main` à `93b4237801b9c446d678ccb74170b6a5a6586479`, PR #63 fusionnée après succès des contrôles spécifications, natif/disque, WASM, éditeur Linux et Windows. Branche de cette tranche : `feat/dsk-recovery-protection`. Vérifier sa PR et ses contrôles avant d'annoncer la fusion de 0.41.3.

Demande prioritaire : aller jusqu'au parcours utilisable de récupération et ajouter les trois modes de distribution. Réalisé : BASIC tokenisé/protégé via codec local MIT, détection indépendante des extensions, import isolé BAS/BIN, DATA/SYSTEM standard/Extended ordinaires 40 pistes, ressources déclarées et réintégrées au build/F5/agent, extraction brute, lecture linéaire Z80 annotable/exportable, obfuscation/protection/combinaison sur copies avec aperçu. [Guide et compatibilité exacte](implementation/recovery-protection-alpha.md), [ADR 0062](adr/0062-recuperation-distribution-basic.md).

Preuves locales : 407 tests réussis, TypeScript, renderer/main, parcours Chromium réel UI → worker/stockage → trois DSK ; sources claires inchangées. Recette native du moteur CPC et trois ROM 6128 anglaises explicitement contrôlées : résultats identiques pour clair/obfusqué/protégé/combiné ; vrais SAVE P/SAVE A récupérés ; scénario import → édition → LOAD/CALL du binaire préservé réussi (résultat 78). Comparaison Z80 externe : 699 encodages, 693 identiques, six différences documentées selon Zilog. Scripts de recette et preuves régénérables sous out/. Aucun installeur déclenché. Le build WASM local est bloqué par SIGSEGV de clang du SDK dans cet environnement ; CI complète et nouvelle recette IPC à vérifier pour cette tête.

Limites : ASCII éditable seulement (glyphes CPC non convertibles conservés bruts), autres géométries/utilisateurs/protections disque refusés, dépendances non analysées automatiquement, ajout au projet courant non réalisé. Obfuscation conservatrice et autonome ; FN/portées/accès machine refusés. Z80 documentaire : ni reconstitution exacte des symboles, ni réassemblage, ni décompilateur BASIC universel. L'extraction et la copie des originaux restent possibles sans source convertible. Les fichiers source réellement compilés demandent un format identifié ou une reconstruction explicitement qualifiée.

Suite : valider un DSK réel fourni sans le publier ; qualifier le jeu de caractères CPC, les noms historiques et les profils supplémentaires ; élargir les recettes firmware (multifichier/binaire) et émulateur indépendant ; compléter l'atelier Z80 puis reprendre FN/portées. Conserver les spécifications longues comme cible : ne pas marquer tous leurs lots comme réalisés.

## Complément du 13 octobre 2026 — import et récupération de sources

Base relue : `main` à `50949c2fab9fc6c1ef746f3756425b27971688ca`, fusion de la PR #61 ; aucune PR ouverte lors de la vérification précédant ce travail. Branche de cadrage : `docs/dsk-project-import`. Le code reste en 0.41.1 ; aucun codec, exécutable ou nouveau build livré par ce complément.

Deux demandes sont désormais détaillées : [DSK vers projet](specifications/20-import-dsk-projet.md), puis [récupération de sources et atelier Z80](specifications/21-retro-ingenierie-z80.md). L'objectif est de récupérer une source exploitable, BASIC compris si son format le permet, sans se fier à l'extension BIN/BAS. Le lecteur réel est limité à standard DATA 40 pistes/une face/utilisateur 0 ; détokenisation et parcours d'import restent à construire. Pour les fichiers compilés, distinguer source conservée, assembleur reconstruit et réécriture BASIC assistée ; aucune récupération exacte universelle.

Les deux roadmaps et les sommaires sont actualisés. La séquence FN/portées ci-dessous est préservée, sans faire passer ces nouvelles spécifications pour une livraison. Pour attaquer le chantier demandé, commencer par DSK-A/B/C et constituer les fixtures originales/redistribuables avant le code ; suivre ensuite les lots Z80. Les autres profils disque et compilateurs sont à qualifier séparément.

Validation de ce complément : `python scripts/check_specs.py --schemas` réussi (145 Markdown, 20 JSON, 84 exigences, 37 scénarios, cinq schémas et six exemples) et `git diff --check` réussi. Aucun test fonctionnel d'import ou de désassemblage annoncé. Les preuves 0.41.1 ci-dessous restent historiques.

## Incrément du 13 octobre — import ASCII 0.41.2

Autorisation explicite de publier et de commencer le développement. Le cadrage est fusionné dans `main` par la [PR #62](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/62), commit `2bb4732d10eb3bd0dcc93c3f605384265b2907b1`. Développement sur `feat/dsk-project-import`, version 0.41.2 : [guide](implementation/dsk-import-alpha.md), [ADR 0061](adr/0061-import-dsk-ascii.md). Vérifier la PR de cette branche et son état avant de déclarer le code intégré à `main`.

Réalisé : catalogue DATA strict, aperçu, sélection ASCII et entrée, création d'un nouveau dossier projet, noms CPC conservés indépendamment de l'extension, original DSK et enregistrements bruts conservés, rapport portable, garde d'empreinte et arbitrage des brouillons. L'agent existant peut travailler sur les sources importées. Les fichiers tokenisés/protégés/binaires sont classifiés et conservés, pas convertis ni réintégrés au build.

Preuves locales : 400 tests réussis, TypeScript, builds renderer/main et contrôle syntaxique des scripts réussis. Parcours Chromium avec vrai worker/stockage réussi, capture inspectée (`out/dsk-import-alpha.png`) ; une étiquette de sélection a été corrigée pendant cette recette. Les dialogues natifs et IPC disposent d'une recette ajoutée à la suite Electron, à vérifier en CI. Aucun nouveau test CPC/ROM/émulateur indépendant ni build installable local revendiqué.

Prochaine tranche demandée : **DSK-B, détokenisation BASIC non protégé**, puis DSK-C (ressources exécutables et parcours multifichier complet). Qualifier tokens, nombres, chaînes/DATA/commentaires, RSX et caractères CPC avant le codec ; ne pas utiliser l'IA pour deviner les octets. Extended, autres géométries et protection SAVE P suivent. La [récupération de sources/Z80](specifications/21-retro-ingenierie-z80.md) vient ensuite. L'[obfuscation BASIC](specifications/22-obfuscation-basic.md), question complémentaire, est une proposition P2 non implémentée dépendant notamment du renommage sémantique.

Limites de reprise de l'import : staging conservé en cas d'échec, pas de reprise automatique ni qualification panne électrique/Windows ; sauvegarder tout le dossier pour garder les originaux `.microide/imports/`. Ne pas assimiler les tests synthétiques à une compatibilité universelle des anciennes disquettes.

Précision utilisateur ajoutée pendant la réalisation : IDE-078 est retenu avec trois modes **obfuscation seule / BASIC protégé seul / combinaison des deux**, appliqués uniquement à une copie de distribution. Ordre : obfuscation, validation puis format protégé qualifié. Source claire et table de correspondance restent hors DSK ; aucune promesse d'inviolabilité. Fonctionnalité spécifiée, non implémentée, après ses prérequis de renommage/codec et sans interrompre l'import DSK.

## Base historique de la pause

- Dépôt : `AstrowareConception/Micro-IDE-Amstrad`.
- `main` au commit **`0152099bd6b74b87d58a9a567e6a03d41dbf1f7f`** : alpha desktop **0.41.1**, [PR #60](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/60) fusionnée après la [PR #59](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/59). Aucune PR ouverte au moment de ce constat. Une ancienne branche locale ne remplace pas `main` distant.
- Tranches déjà intégrées : édition/projets multifichiers, F5 et CPC intégré, debugger BASIC initial, diagnostics et monitoring, rapport Qualité, suites/scénarios de tests, Git/GitHub, agent IA, personnalisation, analyse de flux jusqu’aux piles de boucles 0.40.9, index Symboles/usages 0.41.0 et types possibles 0.41.1. Lire les guides pour le périmètre exact : nombre de ces capacités restent **partielles**.

## Travail 0.41.1

Types explicites par suffixe, types implicites possibles par première lettre, déclarations DEFINT/DEFREAL/DEFSTR navigables. Analyse conservatrice de toute la source, pas une simulation de l’ordre d’exécution. Contextes incomplets signalés. Exports Symboles version 2, budgets et gardes d’obsolescence préservés. [Réalisation](implementation/basic-symbols-alpha.md#types-0411), [ADR 0060](adr/0060-types-possibles-symboles-basic.md).

## Vérifications de cette reprise

- 394 tests unitaires réussis, dont sept nouveaux tests de types.
- TypeScript et build desktop réussis.
- Suite firmware intégrée terminée : 202 scénarios, dont six nouveaux cas de types réussis ; les scénarios négatifs conservent leurs résultats attendus.
- Recette Chromium complète réussie, dont types, navigation des déclarations, exports et liens obsolètes. Capture inspectée et mise à jour dans le guide.
- Contrôle documentaire réussi : 143 Markdown, 20 JSON, 84 exigences, 37 critères, cinq schémas et six exemples.
- CI de la tête de PR #60 : cinq contrôles terminés avec succès (spécifications, natif/disque, WASM, éditeur Linux et Windows). Ces chiffres décrivent cette tranche, pas les futurs commits.

Les ROM privées sont hors Git. La qualification reste celle du jeu CPC 6128 anglais identifié dans le moteur intégré, sans nouvelle preuve sur matériel ou émulateur indépendant. La version de [GitHub Releases](https://github.com/AstrowareConception/Micro-IDE-Amstrad/releases) peut être plus ancienne que le code ; aucune nouvelle préversion binaire n’est annoncée ici.

## Tranche intelligence IDE conservée : fonctions DEF FN et portées

**But :** faire progresser IDE-015 sans confondre paramètre, variable libre et globale. La 0.41.1 omet explicitement définitions et appels FN. La concordance du nom ne suffit pas à prouver une identité.

1. **Qualifier avant de coder.** Relire `AGENTS.md`, les documents de langage 14/15, `knowledge/locomotive-basic`, l’[ADR 0060](adr/0060-types-possibles-symboles-basic.md) et le [guide Symboles](implementation/basic-symbols-alpha.md). Constituer une matrice de listings pour `DEF FNnom[(paramètres)]=expression`, appels `FNnom`, zéro/un/plusieurs paramètres, suffixes explicites/implicites, homonymie locale/globale, variables libres, redéfinitions, appels imbriqués et formes invalides. Vérifier les effets observables sur le firmware qualifié ; laisser inconnue toute forme non prouvée.
2. **Étendre le domaine borné.** Distinguer fonction, paramètre local et variable libre dans une source, avec occurrences et liens seulement lorsque l’identité est justifiée. Conserver coordonnées exactes, raisons d’omission, quotas, worker à la demande, annulation et protection des snapshots. Ne pas transformer l’ordre textuel des `DEFINT` en preuve d’exécution. Documenter tout nouveau contrat d’export et décider d’un ADR pour les portées.
3. **Valider dans le CPC et l’interface.** Tester masquage local/global, suffixes, branches, commentaires/DATA/chaînes, appels opaques et limites ; relier les assertions firmware aux conclusions de l’index. Vérifier recherches et liens depuis la source active et les buffers chargés, obsolescence, budgets, annulation et confidentialité des exports. Distinguer dans le rapport tests exécutés, limites connues et qualifications non faites.

**Critère de sortie :** un paramètre et une globale homonymes ne sont pas confondus ; chaque lien FN annoncé est justifié ; les formes inconnues sont omises avec une raison visible. IDE-015 reste partiel tant que la navigation sémantique entière n’est pas qualifiée.

## Tranches suivantes, dans cet ordre

| Tranche | Travail | Critère de sortie et dépendance |
| --- | --- | --- |
| Accès depuis le curseur | Ouvrir sur demande les usages/une définition reconnue du symbole sous le curseur ; préserver source et plage exactes. | Aucun calcul supplémentaire à la frappe ; chaînes, commentaires, DATA et segments opaques exclus ; snapshot obsolète non navigable. Dépend des identités FN qualifiées ou affiche clairement leurs limites. |
| Renommage sémantique (IDE-017, non réalisé) | Proposer le nom, un **aperçu du diff de chaque source**, les collisions et conséquences des suffixes, types et portées ; appliquer après révision humaine. | Refuser les identités ambiguës et les sources modifiées ; préserver chaînes/DATA/commentaires, fonctions et tableaux ; undo, brouillons et préconditions testés. Dépend d’IDE-015 suffisamment qualifié. |
| Profiler 0.42 | Mesurer sur le CPC exécuté fréquences et coûts des lignes ou statements, puis montrer des hotspots avec provenance. | Mesure et surcoût quantifiés, budget/arrêt explicites, mapping et firmware qualifiés ; ne pas confondre estimation lexicale et temps mesuré. Dépend des hooks et du debugger. |
| Agent observant le CPC 0.43 | Outils contrôlés pour exécuter, observer l’écran/état autorisé, lancer des tests, expliquer, corriger et revérifier avec checkpoints. | Permissions/budget clairs, preuve de l’exécution et diff restaurable ; documents sans shell hôte, ROM et secrets protégés. Dépend du CPC et des tests qualifiés. |

## Chantiers ouverts au-delà de cette séquence

Le [backlog qualifié](specifications/17-roadmap-ide-complet.md) reste la liste exhaustive. Les points suivants ne sont pas tous des prérequis à la tranche FN :

- **Langage et qualité :** parser/références non exhaustifs (IDE-013/014), inspections/formatage absents (IDE-019), flux 0.40 partiel sur certains `NEXT`, portées franchies, erreurs implicites et événements (IDE-076). Les tests BASIC (IDE-077) n’ont ni couverture, ni fixtures binaires, ni génération IA de tests.
- **Debugger et CPC :** variables/tableaux/chaînes, pile GOSUB/RETURN, Step Over/Out, watchpoints, gouttière Monaco et autres firmwares restent à qualifier (IDE-054). Inspection intégrée et validation externe ne sont pas équivalentes.
- **Projet et fiabilité :** récupération Windows/panne électrique, autres mutations, import d’anciens projets, historique/restauration élargis, watcher, conflits externes et certains états d’onglets (IDE-001 à 012). Préserver les brouillons et distinguer source UTF-8, fichier CPC, disquette et session émulée.
- **Atelier, Git et IA :** modèles/assistant de démarrage, explorateur enrichi, fenêtres système, merge/rebase/conflits Git, SSH/OAuth/coffre et boucle IA observant le CPC restent ouverts ; voir IDE-002/005/027/035/036/039/062–067.
- **Distribution 1.0 :** previews Windows/Linux non signées et smoke du binaire empaqueté déjà présents ; signature, installation/mise à jour/désinstallation, matrice fonctionnelle installée, ARM64/macOS, canaux stables, accessibilité et J6 restent ouverts (IDE-070 à 074). Ne pas déclencher un packaging à chaque commit.

Ne pas déclarer J0–J6, R1–R9 ou la version 1.0 achevés sur la seule base de cette alpha.

## Méthode de continuité

1. Lire ce document, `AGENTS.md`, les deux roadmaps et le guide du lot. Vérifier `main` distant, les PR, contrôles et la version des Releases. Si `main` a dépassé `0152099…`, prendre ses changements comme état courant et actualiser ce document. Ne pas repartir automatiquement d’une ancienne branche locale.
2. Choisir une seule tranche cohérente (détokenisation DSK selon la demande du 13 octobre), créer sa branche depuis `main`, puis fixer la matrice de preuves et les limites. Regrouper code, exemples, tests utiles, ADR/guide/roadmap et nouveau point de reprise dans une PR. Vérifier les contrôles adaptés au diff et lire la première erreur réelle avant toute relance.
3. Avant la prochaine pause, inscrire ici commit de `main`, PR, preuves effectivement observées, limites et prochaine action. Les fichiers temporaires et logs locaux ne remplacent pas un commit publié. Ne jamais y copier clé API, ROM, document personnel ou conversation privée.

**Instruction de reprise courte :** « Reprends CPCéleste depuis `main` après lecture de `AGENTS.md` et `docs/reprise.md`. Vérifie d'abord la PR `feat/dsk-project-import` et ses contrôles, puis poursuis la récupération des anciens programmes par la détokenisation BASIC DSK-B. Garde FN/portées au backlog et mets à jour le point de reprise. »
