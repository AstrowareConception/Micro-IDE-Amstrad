# J0 — Première preuve technique CPC et DSK

Date : **2026-10-03**. État : **incrément technique implémenté, qualification moteur suspendue faute de firmware**. Ce rapport décrit le prototype livré ; les spécifications du produit restent la cible des jalons suivants.

## Résultat et décision

Le dépôt possède désormais un codec TypeScript strict pour BASIC ASCII, binaire AMSDOS et disquette DATA, un wrapper C du cœur `floooh/chips`, des builds natif/WASM, une page locale de recette et une CI dédiée. Aucun IDE Electron ni agent IA n'est encore revendiqué.

**Décision J0 : HOLD, pas de go moteur ni de lancement J1.** Les ROM OS/BASIC/AMSDOS ne figurent ni parmi les sources fournies ni dans le dépôt. Les essais synthétiques disponibles ne peuvent établir que Locomotive BASIC démarre ou que OPENOUT fonctionne via le contrôleur CPC. La procédure de recette est concrète et prête pour un jeu de firmware utilisable et un émulateur indépendant.

| Tâche | Résultat de cet incrément | État |
| --- | --- | --- |
| J0-01 | Commit moteur, 13 SHA-256, notices exactes et Emscripten 4.0.15 verrouillés | Réalisé |
| J0-02 | Wrapper borné et validation avant parser ; boot ROM absent | Partiel |
| J0-03 | Writer/reader DATA, ASCII hello et binaire AMSDOS, disque déterministe | Réalisé structurellement |
| J0-04 | Transport exécution/clavier/vidéo/audio/pause/reset ; comportement firmware à vérifier | Partiel |
| J0-05 | Export des secteurs du lecteur modifié, construit distinct de session ; OPENOUT et oracle à vérifier | Partiel |
| J0-06 | Rapport HOLD et procédure restante | Réalisé, qualification ouverte |

## Implémentation et choix figés

Les codecs résident dans `packages/cpc-disk/src` et n'importent ni Node, ni UI, ni Electron. Les scripts Node assurent l'I/O. Le cœur C est téléchargé dans un cache ignoré ; aucune source upstream n'est réécrite. Le [lock moteur](../../packages/emulator/chips.lock.json) fixe `9e88298ce56319953ac7a43213a1120359f7a3a6`. Le SDK emsdk est fixé au commit `389a68bc35dcff7ebae4614e1615099dafda00d1`, version Emscripten 4.0.15. Les [notices](../../licenses/chips.txt) accompagnent les artefacts WASM.

Le profil writer `data-standard-sequential-v1` choisit l'ordre physique **C1, C2, …, C9**. Le reader parcourt les IDs, avec un test d'interleave différent. Le conteneur est toujours de **194 816 octets**. Allocation stable par nom, 64 entrées, 178 blocs d'un Kio, extents de 16 Kio et records de 128 octets. Le codec expose les records bruts ; seule une demande explicite de décodage ASCII coupe à CTRL-Z. Le binaire se relit à la longueur de son en-tête AMSDOS.

Le listing hello construit porte le SHA-256 **`c36a0f2a041a11f15c2e7438624daad65ae56c1e26b4a8ef83a81a905fc94988`**. Cette empreinte fige un format ; elle ne constitue pas une preuve de compatibilité. La validation par mutations et la lecture du parser disque upstream fournissent des contrôles supplémentaires.

J0 utilise un package de développement minimal, avant les workspaces Electron de J1. La page HTML/JS est un banc éphémère, sans privilège hôte ; elle n'anticipe pas les composants React/Monaco. Le monolithe modulaire et TypeScript strict restent les décisions produit.

## Essais effectivement exécutés

| Contrôle | Preuve | Limite |
| --- | --- | --- |
| TypeScript strict | `npm run typecheck` réussi, TypeScript 5.9.3 | Codecs et tests du prototype |
| Codec disque et encodages | **21 tests réussis** sous Node 24.19.0 | Analyse syntaxique BASIC complète hors J0 |
| Déterminisme hello | SHA-256 figé ; ordre d'entrée inversé produit les mêmes octets | Pas encore lu par AMSDOS réel |
| Limites record/bloc/extent/capacité | Tailles 0 à 182 272 octets, dépassements refusés | Writer DATA uniquement |
| Binaire AMSDOS | En-tête/checksum/adresses et aller-retour 16 Kio | LOAD par ROM restant à tester |
| C natif | GCC 13.3.0, ASan et UBSan, essais réussis | ROM synthétique originale `JP 0` |
| Entrées du wrapper | Toutes les longueurs erronées jusqu'à taille disque + 1 ; mutations des champs critiques | Pas une campagne de fuzz exhaustive |
| Écriture/export lecteur | `fdd_write` upstream modifie un secteur ; export et conservation au reset contrôlés | Pas OPENOUT via firmware/UPD765 |
| Pause/clavier/audio | Ticks gelés, touches relâchées, buffer audio borné | Pas INKEY$, TIME ou SOUND qualifiés |
| Documentation/contrats | Vérification complète avec jsonschema 4.26.0 réussie | Ne teste pas le CPC |

LeakSanitizer ne peut examiner les processus de cet environnement local (`/proc`/ptrace) : l'essai local conserve ASan/UBSan et désactive uniquement la recherche de fuites. La CI Linux l'active par défaut. La compilation et les essais WASM sont également exécutés par le workflow [J0 prototype](../../.github/workflows/j0.yml) ; leurs résultats doivent être lus dans la CI de la PR, sans assimiler une configuration de workflow à un succès.

## Essais restant bloqués

| Preuve attendue | Nécessaire pour la conclure |
| --- | --- |
| Boot CPC 6128 et prompt BASIC 1.1 | ROM OS/BASIC/AMSDOS locales utilisables, hashes et capture |
| CAT/RUN ASCII et LOAD binaire | Même firmware ; parcours hello et probe |
| OPENOUT/CLOSEOUT, export puis OPENIN | `RESULT.TXT` extrait et relu dans Caprice32 externe |
| INKEY$, interruption, son audible, modes vidéo et TIME | Observation du programme de recette ; essais complémentaires modes 0/2 et AFTER/EVERY/FRAME |
| Performance et absence de gel UI sur programme réel | Mesures sur machines hôtes et firmware identifiés ; page temporaire distincte du worker de production |
| Qualification en dehors du moteur intégré | Version d'émulateur indépendant, hashes, captures et verdict |
| CPC physique | Essai matériel séparé, futur ; aucune revendication actuelle |

Les scénarios ACC-08, ACC-09 et ACC-24 ne sont donc pas clôturés. Les contrôles de transport sont des preuves partielles, pas leur recette produit.

## Reprise concrète

Le [guide du harness](../../tools/j0-harness/README.md) donne toutes les commandes et le parcours. Construire hello/probe, fournir les trois ROM de 16 Kio, observer le prompt, lancer `RUN"PROBE.BAS"`, exporter `session.dsk`, vérifier `RESULT.TXT`, puis le relire dans Caprice32. Joindre observations et captures à une nouvelle preuve sans ajouter de ROM au dépôt.

Si lecture ou écriture via la machine échoue, conserver disque, hashes et commande, puis corriger le wrapper ou produire un cas upstream borné. Si le cœur reste incompatible avec les usages requis, comparer un autre moteur et remplacer l'ADR avant J1. Le wrapper actuel ne justifie pas un changement de moteur ; l'absence de firmware n'est pas un échec du moteur.
