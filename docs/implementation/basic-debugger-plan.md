# Débogueur BASIC — faisabilité et prochain incrément

Date : 6 octobre 2026. **D1 partiellement prouvé en 0.35 ; interface BASIC à réaliser.** [Inspection et recette de frontière native/WASM](cpc-inspection-alpha.md). IDE-054 demeure bloqué pour son interface publique par qualification des événements et du mapping source. Le [lot 5](../specifications/18-increments-ide-production.md) interdit de présenter un état Z80 comme état BASIC qualifié.

## Ce qui existe réellement

L’application exécute un DSK à travers les ROM CPC locales ; le jeu 6128 anglais identifié dispose d’une recette boot/RUN/POKE. Pause suspend le moteur, double ESC tente BREAK et l’écran montre le résultat réel. Ces commandes ne constituent pas un pas à pas BASIC. `cpc_bridge_peek` existe pour le harness ; aucun lecteur de variables BASIC ou point d’arrêt de ligne n’est exposé dans l’IDE.

Le manuel utilisateur CPC 6128 documente **TRON/TROFF**, qui activent/désactivent l’affichage des numéros de lignes exécutées entre crochets ([chapitre BASIC, transcription du manuel](https://www.cpcalive.com/docs/basic_doc.html)). Une ligne `10 TRON` peut servir de trace native dans un programme de diagnostic ; l’IDE ne transforme pas cette sortie en ligne courante fiable. Le programme peut effacer/redéfinir l’écran, détourner les flux et désactiver la trace. Cette étude ne prétend pas avoir qualifié une capture structurée de TRON sur ROM.

La version épinglée de `chips`, commit `9e88298ce56319953ac7a43213a1120359f7a3a6`, possède `chips_debug_t`, un callback et un drapeau d’arrêt dans `cpc_desc_t`. `cpc_exec` distingue explicitement exécution sans hook et exécution avec callback par tick. Le fichier [cpc.h épinglé](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/systems/cpc.h) a été consulté ; empreinte attendue dans [chips.lock.json](../../packages/emulator/chips.lock.json). Le pont garde le hook absent en usage normal et l’arme uniquement dans la recette D1 : neuf fetches `DE60` rapprochés de `HL`, `AE1D` et du listing tokenisé chargé, identiques en natif/WASM. **Preuve ciblée sur un seul jeu ROM ; couverture des événements et liaison au buffer source ouvertes.**

## Tranches et preuves de sortie

| Ordre | Livrable concret | Qualification requise |
| --- | --- | --- |
| D1 | Profil ROM et observation d’une frontière d’instruction BASIC ; ligne réelle, raison d’arrêt et origine | Empreintes OS/BASIC/AMSDOS ; adresses/routines issues d’analyse ROM et docs ; rapprochement avec le listing tokenisé réellement chargé, pas avec la seule position Z80 |
| D2 | Points d’arrêt par ligne et Continuer/Pas suivant sur la machine réellement arrêtée | Instruction simple et plusieurs instructions sur une ligne, IF/GOTO/FOR, GOSUB/RETURN, timers/ON ERROR, INPUT bloquant ; arrêt avant/après défini explicitement |
| D3 | Variables et tableaux en lecture seule, pile lorsque sa structure est qualifiée | Suffixes %, !, $, nombres/chaînes, banques, pointeurs bornés, état stable en pause ; aucun calcul d’expression utilisateur mutateur |
| D4 | Observations reproductibles, snapshots et limites de profil | Révision source, hash DSK/ROM, instant/ticks, motif et confiance ; source modifiée rend la correspondance périmée, relancement explicite ; ROM inconnue refuse le mapping BASIC |

Une trace instrumentée reste un **artefact de diagnostic séparé**, avec transformations et effets sur temps/affichage indiqués ; elle ne remplace jamais l’export normal ni la source. Les variables ne sont pas interprétées depuis des adresses supposées identiques entre ROM.

## Budget et architecture

Le hook reste absent hors session de débogage : la voie actuelle sans callback est conservée. En mode actif, le filtrage doit rester dans le pont natif, avec buffer circulaire borné et messages worker groupés seulement aux arrêts/changements utiles. Aucun événement JavaScript par tick, sondage continu de toutes les variables ou capture écran permanente supplémentaire. En pause, lire les valeurs à la demande ; masquer la vue arrête ses mesures. Compter coût du hook, événements abandonnés et latence d’arrêt avant de fixer une fréquence.

Première recette D1 : petit listing connu avec POKE distinct avant/après deux instructions ; arrêter à la frontière supposée, comparer mémoire, ligne tokenisée et reprise. Exécuter sur le jeu ROM anglais identifié, puis contrôler erreurs, BREAK et interruptions. L’absence de preuve interdit boutons de points d’arrêt/pas BASIC dans la version publique. Le monitoring 0.34 est déjà utilisable pour le parser ; son temps de calcul ne qualifie pas le coût futur du hook moteur.
