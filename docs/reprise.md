# CPCéleste — Point de reprise du développement

**Pause demandée le 8 octobre 2026.** Ce document conserve l’état vérifié, les décisions et la suite ; il n’archive pas les conversations. Confronter son contenu au `main` distant avant toute reprise.

## Base vérifiée

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

## Première tranche à reprendre : fonctions DEF FN et portées

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
2. Choisir une seule tranche cohérente (FN d’abord selon la décision actuelle), créer sa branche depuis `main`, puis fixer la matrice de preuves et les limites. Regrouper code, exemples, tests utiles, ADR/guide/roadmap et nouveau point de reprise dans une PR. Vérifier les contrôles adaptés au diff et lire la première erreur réelle avant toute relance.
3. Avant la prochaine pause, inscrire ici commit de `main`, PR, preuves effectivement observées, limites et prochaine action. Les fichiers temporaires et logs locaux ne remplacent pas un commit publié. Ne jamais y copier clé API, ROM, document personnel ou conversation privée.

**Instruction de reprise courte :** « Reprends CPCéleste depuis `main` après lecture de `AGENTS.md` et `docs/reprise.md`. Compare leur état à GitHub, puis attaque la qualification `DEF FN`/portées prévue par la roadmap ; conserve les limites explicites et mets à jour le point de reprise à la fin. »
