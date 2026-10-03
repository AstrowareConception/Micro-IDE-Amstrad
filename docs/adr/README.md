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

Date initiale : 2026-10-03. Une décision est reconsidérée sur besoin réel ou preuve technique, pas parce qu'une technologie différente est disponible.
