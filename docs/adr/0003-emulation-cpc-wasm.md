# ADR 0003 — Cœur CPC C compilé en WASM

Statut : conditionnelle à la qualification J0. Date : 2026-10-03.

## Contexte

Le résultat doit fonctionner dans un CPC avec son interpréteur ROM, ses accès mémoire, son clavier et son disque. Une exécution de BASIC en JavaScript ne reproduit pas nécessairement CALL, OUT, les timings ou les périphériques.

## Décision

Retenir `floooh/chips` comme premier candidat, wrapper C propre et build Emscripten figé. Exécuter le WASM dans un worker sans privilèges hôte. Encapsuler l'API et les éventuels hooks firmware dans l'adaptateur. Qualifier disque lecture/écriture, clavier, audio, boot, timing et export de secteurs à J0.

## Options considérées

CPCBasicTS est utile comme référence de langage ou éventuel codec MIT, mais son BASIC compilé en JavaScript n'est pas l'autorité matérielle. Caprice32 peut servir d'oracle indépendant et être évalué comme autre cœur si nécessaire ; son intégration et ses conditions GPL doivent alors être conçues. Piloter seulement un émulateur externe ne satisfait pas le besoin d'émulation intégrée.

## Conséquences

Le commit candidat et le wrapper disposent désormais de tests de transport J0, sans qualification firmware : voir le [rapport d'implémentation](../implementation/j0-report.md). L'export DSK mutable est implémenté pour DATA ; son emploi via OPENOUT reste à éprouver. Les restrictions de CRTC et de géométrie sont visibles. Les snapshots internes sont réservés à leur version ; pas de compatibilité SNA affirmée sans codec. Aucune ROM n'est redistribuée par la seule licence du cœur.

Critère de confirmation : rapport J0 positif sur tous les usages nécessaires, avec DSK relu dans un autre émulateur. En cas d'échec, nouvelle ADR avant construction de l'UI autour du moteur. Une bibliothèque reconnue ne dispense pas de cette preuve.
