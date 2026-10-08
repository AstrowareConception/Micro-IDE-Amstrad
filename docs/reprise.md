# CPCéleste — Point de reprise du développement

Mise à jour : 8 octobre 2026. Ce document conserve l’état du travail ; il ne constitue pas une archive des discussions.

## Base vérifiée

- Dépôt : `AstrowareConception/Micro-IDE-Amstrad`.
- Base de cette tranche : `fcc8c5e4ae09d17d6567c914fb88c5b07de2a1d7`, fusion de la [PR 59](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/59), alpha 0.41.0.
- Tranches déjà intégrées : exécution F5, debugger BASIC initial, suites/scénarios de tests, réglages IA réorganisés, analyse de flux jusqu’aux piles de boucles 0.40.9, index Symboles/usages 0.41.0. Ne pas les recommencer.
- Branche de la présente tranche : `feat/basic-symbol-types` ; version du code 0.41.1.
- Pour connaître l’intégration actuelle, consulter la [PR de cette branche](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pulls?q=is%3Apr+head%3Afeat%2Fbasic-symbol-types) et comparer son commit à `main`. Le statut GitHub fait foi.

## Travail 0.41.1

Types explicites par suffixe, types implicites possibles par première lettre, déclarations DEFINT/DEFREAL/DEFSTR navigables. Analyse conservatrice de toute la source, pas une simulation de l’ordre d’exécution. Contextes incomplets signalés. Exports Symboles version 2, budgets et gardes d’obsolescence préservés. [Réalisation](implementation/basic-symbols-alpha.md#types-0411), [ADR 0060](adr/0060-types-possibles-symboles-basic.md).

## Vérifications de cette reprise

- 394 tests unitaires réussis, dont sept nouveaux tests de types.
- TypeScript et build desktop réussis.
- Suite firmware intégrée terminée : 202 scénarios, dont six nouveaux cas de types réussis ; les scénarios négatifs conservent leurs résultats attendus.
- Recette Chromium complète réussie, dont types, navigation des déclarations, exports et liens obsolètes. Capture inspectée et mise à jour dans le guide.
- Contrôle documentaire réussi : 143 Markdown, 20 JSON, 84 exigences, 37 critères, cinq schémas et six exemples.
- CI distante : à vérifier sur le commit de la PR ; ne pas déduire son état des résultats locaux.

Les ROM privées sont hors Git. La qualification reste celle du jeu CPC 6128 anglais identifié dans le moteur intégré, sans nouvelle preuve sur matériel ou émulateur indépendant. Aucune nouvelle préversion binaire n’est annoncée par ce document.

## Suite immédiate

1. Qualifier DEF FN : déclarations/appels, paramètres et occurrences internes, interactions des suffixes et changements de type, fonctions redéfinies et appels imbriqués. Écrire les observations firmware avant de conclure à une identité/portée.
2. Étendre l’index avec des portées explicites ; conserver les cas non prouvés comme limites. Les alias sans suffixe ne doivent pas être fusionnés sur la seule position textuelle d’un DEFINT.
3. Ajouter l’accès depuis le symbole sous le curseur et enrichir la navigation.
4. Construire le renommage avec aperçu, contrôle de révision, exclusions documentées et annulation. IDE-015 reste partiel ; IDE-017 non réalisé.
5. Poursuivre ensuite le profiler 0.42, puis l’agent observant/testant le CPC 0.43 selon la [roadmap](specifications/17-roadmap-ide-complet.md).

## Méthode de continuité

Au début d’une session, lire ce fichier et AGENTS.md, inspecter les changements locaux, `main`, les PR ouvertes et leurs contrôles. Préserver les travaux non intégrés. À chaque tranche, actualiser ce point avec les changements et résultats réellement observés, puis le versionner avec le code. Les fichiers temporaires et logs locaux ne remplacent pas un commit publié.

Regrouper les modifications et validations avant de pousser. Ne pas lancer de packaging par commit : la publication hebdomadaire ou manuelle existante reste la règle. Ne pas relancer des CI anciennes pour reconstituer la reprise.
