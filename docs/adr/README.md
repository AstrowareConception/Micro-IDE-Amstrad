# Décisions d'architecture

Une ADR explique une décision durable et ses conséquences. **Acceptée** signifie direction retenue pour la conception, pas implémentation terminée. **Conditionnelle** signifie que la décision attend une preuve désignée. Toute substitution garde la décision précédente dans l'historique et précise ce qu'elle remplace.

| ADR | Décision | Statut |
| --- | --- | --- |
| [0001](0001-desktop-electron.md) | Bureau Electron avec React/TypeScript | Acceptée |
| [0002](0002-monolithe-ddd.md) | Monolithe modulaire DDD et ports/adaptateurs | Acceptée |
| [0003](0003-emulation-cpc-wasm.md) | Émulation CPC native en WASM avec `chips` | Conditionnelle à J0 |
| [0004](0004-basic-ascii-dsk.md) | BASIC ASCII et DSK DATA pour la première chaîne | Acceptée |
| [0005](0005-ia-propositions.md) | Agent à outils métier, corpus BASIC, checkpoints et mode Revue optionnel | Acceptée |
| [0006](0006-projets-fichiers.md) | Projets en dossiers ouverts et formats versionnés | Acceptée |
| [0007](0007-compatibilite-progressive.md) | Qualification progressive des machines et ROM séparées | Acceptée |
| [0008](0008-j0-data-harness.md) | DATA séquentiel, parser borné et preuves synthétiques distinctes des essais ROM | Acceptée pour J0 |
| [0009](0009-edition-independante.md) | Édition desktop indépendante de la qualification CPC | Acceptée pour l'alpha 0.4 |
| [0010](0010-projets-basic-incrementaux.md) | Dossiers et buffers BASIC indépendants, durabilité incrémentale explicite | Acceptée pour l'alpha 0.5 |
| [0011](0011-agent-openai-metier.md) | Agent OpenAI à outils métier, clé de session et checkpoints incrémentaux | Acceptée pour l'alpha 0.6 |
| [0012](0012-configuration-rom-locale.md) | Import et stockage ROM locaux indépendants de la qualification moteur | Acceptée pour l'alpha 0.7 |
| [0013](0013-documents-texte-incrementaux.md) | Originaux TXT/MD locaux et contexte agent documentaire explicitement autorisé | Acceptée pour l'alpha 0.9 |
| [0014](0014-images-natives-et-contexte-visuel.md) | PNG/JPEG locaux, aperçu nettoyé et contenu visuel agent à la demande | Acceptée pour l'alpha 0.10 |
| [0015](0015-git-natif-et-publication-explicite.md) | Git natif, remotes interchangeables, confiance et publication humaine explicite | Acceptée pour la conception ; à réaliser |
| [0016](0016-pdf-texte-borne.md) | Extraction PDF texte bornée en thread dédié, pages et scope documentaire | Acceptée pour l'alpha 0.11 |
| [0017](0017-git-inspection-conservatrice.md) | Git natif en lecture seule, configuration conservatrice et diff distinct des buffers | Acceptée pour l'alpha 0.12 |
| [0018](0018-git-init-et-index-isole.md) | Dépôt main/exclusions, staging sélectif et index isolé avec préconditions | Acceptée pour l'alpha 0.13 |
| [0019](0019-outils-atelier-et-terminal-humain.md) | Commandes/contextes d’atelier, historique Git paginé et terminal humain séparé de l’IA | Acceptée pour l’alpha 0.14 |
| [0020](0020-recherche-sources-et-remplacement-buffers.md) | Recherche littérale des sources chargées, aperçu et remplacement avec undo par modèle | Acceptée pour l’alpha 0.15 |
| [0021](0021-enregistrer-tout-compensation.md) | Sauvegarde globale, préconditions de lot et compensation en mémoire | Acceptée pour l’alpha 0.16 |
| [0022](0022-journal-sauvegarde-et-reprise.md) | Journal global versionné, synchronisation et reprise native explicite | Acceptée pour l’alpha 0.17 |

Date initiale : 2026-10-03. Une décision est reconsidérée sur besoin réel ou preuve technique, pas parce qu'une technologie différente est disponible.
