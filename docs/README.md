# CPCéleste — Dossier de conception et réalisation — version 0.40.8

**Flux BASIC 0.40.8** : piles GOSUB/ON GOSUB/RETURN suivies dans les contextes d’erreur, appelants distincts et navigation vers les sites empilés. Reprises avec appels du gestionnaire en attente qualifiées sur firmware. Budget de 16 appels ; piles de boucles et autres erreurs implicites encore ouvertes, conclusions globales suspendues. [Guide](implementation/basic-control-flow-alpha.md), [ADR 0057](adr/0057-piles-appels-contextes-erreur.md).

**Suites BASIC 0.39 — premier lot** : suites persistantes, lancement individuel/global, historique des dix derniers rapports et retour aux assertions. [Guide](implementation/basic-test-suites-alpha.md), [ADR 0047](adr/0047-suites-basic-et-historique.md). Le [deuxième lot 0.39.1](implementation/basic-scenarios-alpha.md) ajoute des scénarios clavier, fixtures ASCII et observations écran/fichier ([ADR 0048](adr/0048-scenarios-basic-reproductibles.md)).

**Packaging Preview 0.38.1** : premiers paquets desktop réels Windows x64 (NSIS + portable) et Linux x64 (AppImage + deb), ASAR/WASM vérifiés depuis le binaire empaqueté, checksums et publication hebdomadaire de préversions GitHub si le code ou la chaîne de construction a changé. [Guide et limites](implementation/packaging-preview-alpha.md), [ADR 0046](adr/0046-packaging-desktop-preview.md).

**Debugger BASIC 0.38** : breakpoints de lignes et pas statement ancrés sur le firmware Locomotive BASIC 1.1 qualifié. [Guide](implementation/basic-debugger-alpha.md), [ADR 0045](adr/0045-debugger-basic-firmware-qualifie.md).

**Tests BASIC 0.37** : listings autonomes sur machines isolées, assertions natives et rapport borné à la demande. [Guide et limites](implementation/basic-tests-alpha.md), [ADR 0044](adr/0044-tests-basic-isoles.md).

## Vous cherchez le mode d’emploi ?

**[Présentation commerciale et notice utilisateur illustrée de CPCéleste](guide-utilisateur.md)** : 25 chapitres, 23 captures, les parcours complétés par les suites/scénarios BASIC et l’analyse de flux 0.40.8, des premiers pas aux fonctions avancées.

Le dossier ci-dessous conserve les spécifications et les rapports des incréments successifs.

**Qualité BASIC 0.36** : rapport local à la demande sur la source active ou les buffers chargés ; longueurs, segments, complexité estimée et cinq pistes de revue localisées. Exports Markdown/JSON, annulation et sources modifiées signalées. [Guide et limites](implementation/basic-quality-alpha.md).

**Inspection CPC 0.35** : registres Z80 et RAM logique en pause, lecture à la demande ; première preuve ciblée de frontières BASIC en natif/WASM, sans débogueur BASIC public. [Guide et limites](implementation/cpc-inspection-alpha.md).

**Diagnostics et performance 0.34** : analyse BASIC en worker temporisé, révisions protégées, contrôles structurels étendus, diagnostics multifichiers et monitoring à la demande. [Guide](implementation/basic-diagnostics-alpha.md). Débogueur BASIC : [faisabilité et étapes](implementation/basic-debugger-plan.md), mapping source et événements encore à qualifier.

**Notifications 0.33** : registre de session borné, filtres/niveaux/origines/non lus, détails et aperçus personnalisables. [Guide](implementation/notifications-alpha.md), [ADR 0040](adr/0040-centre-notifications-session.md). IDE-029 et lot 7 partiels.

**Personnalisation 0.32** : préférences versionnées, profils portables, keymap et dispositions. [Guide](implementation/personalization-alpha.md), [ADR 0039](adr/0039-personnalisation-profils-et-keymap.md). Lot 7 partiel.

**Sources 0.31** : renommage/déplacement/suppression durables, aperçu, copie du brouillon supprimé et rétablissement de la dernière organisation. [Guide](implementation/source-operations-alpha.md), [ADR 0038](adr/0038-organisation-durable-des-sources.md). Le lot 1 reste partiel.

**Explorateur 0.30** : dossiers réels, sources et documents, filtre local, fichiers privés/générés et aperçu texte inerte. [Guide](implementation/project-explorer-alpha.md), [ADR 0037](adr/0037-explorateur-projet-lecture-seule.md). Le lot 1 reste partiel.

**Git et GitHub 0.28** : branches/remotes/clone, fetch/pull fast-forward/push, GitHub privé et PR, message IA relu. [Guide](implementation/git-network-alpha.md), [ADR 0035](adr/0035-atelier-git-reseau-et-github.md).

**Projets récents 0.27** : réouverture par registre privé, noms/dossiers/date/filtre, retrait et chemins indisponibles ; menus bornés au viewport. [Guide](implementation/recent-projects-alpha.md), [ADR 0034](adr/0034-projets-recents-et-placement-menus.md).

**Disposition 0.26** : panneaux flottants dans l’IDE, séparateurs, hauteur du terminal, écran CPC ajustable et zoom. [Guide](implementation/production-workbench-alpha.md), [ADR 0033](adr/0033-panneaux-flottants-et-ecran-cpc.md).

**Atelier 0.25** : outils et Git à gauche, assistant IA à droite, sorties en bas ; menus exclusifs, icônes, raccourcis et diagnostics syntaxiques pendant la saisie. [Guide](implementation/production-workbench-alpha.md).

**Exécution CPC 0.24** : bouton Exécuter/F5, écran CPC 6128 intégré, buffers non enregistrés, lancement RUN par clavier, pause/arrêt/son et export du disque de session. Trois ROM locales sont nécessaires ; le jeu anglais identifié démarre automatiquement, les autres demandent confirmation de Ready. [Guide](implementation/emulator-run-alpha.md).

Le [profil privé d’identité Git 0.23](implementation/git-identity-alpha.md) ajoute mémorisation opt-in, chargement et oubli avec révisions protégées. [ADR 0028](adr/0028-profil-prive-identite-git.md). Suite : branches locales ; IDE-033 reste partiel.

Les [commits Git 0.22](implementation/git-commit-alpha.md) commencent R3 : identité par commit, aperçu de l’index et publication confirmée. [ADR 0027](adr/0027-commit-git-index-exact.md). IDE-033 reste partiel ; branches et réseau suivent.

La [reprise des mutations agent 0.21](implementation/agent-durability-alpha.md) ajoute journal durable des sources/manifeste, choix natif terminer/rétablir, créations/retrait lors de restauration et snapshots agent dans l’historique local. [ADR 0026](adr/0026-journal-durable-des-mutations-agent.md). R2 reste ouvert ; commits locaux ajoutés en 0.22.

La [revue externe 0.20](implementation/external-alpha.md) détecte les changements disque, conserve les buffers et propose comparaison/chargement avec undo ou adoption de base sans remplacement. [ADR 0025](adr/0025-revue-des-modifications-externes.md). IDE-012 devient partiel ; checkpoints agent puis Git local suivent.

La [copie des brouillons 0.19](implementation/drafts-alpha.md) ajoute une récupération opt-in distincte des sources, aperçu/diff et restauration sélective avec undo. Les copies héritées et brouillons non sélectionnés sont conservés ; aucune sauvegarde implicite. [ADR 0024](adr/0024-copie-brouillons-et-reprise-buffers.md). IDE-011 devient partiel ; la suite est IDE-012, watcher externe, puis mutations agent.

L’[historique local 0.18](implementation/local-history-alpha.md) livre snapshots avant/après des sauvegardes de projet, rétention 20/64 Mio, diff et restauration de buffer avec undo. Enregistrer actif partage le journal de reprise. [ADR 0023](adr/0023-historique-local-et-restauration-buffer.md). IDE-009/010 deviennent partiels ; brouillons, watcher et mutations agent suivent.

La [reprise 0.17](implementation/recovery-alpha.md) ajoute un journal global versionné et le choix natif de terminer/rétablir à l’ouverture, avec refus de conflit et tests SIGKILL Linux. [ADR 0022](adr/0022-journal-sauvegarde-et-reprise.md). IDE-007/008 restent partiels ; historique local et journalisation des autres mutations suivent.

[Enregistrer tout 0.16](implementation/save-all-alpha.md) commence R2 avec préconditions de lot, conservation des sources propres, compensation en mémoire et piles Monaco préservées. [ADR 0021](adr/0021-enregistrer-tout-compensation.md). Les tranches 0.17/0.18 ci-dessus complètent ce socle ; IDE-007 reste partiel.

La [recherche 0.15](implementation/search-alpha.md) commence le lot R1 : recherche des sources chargées/brouillons, navigation, aperçu et remplacement des fichiers choisis, annulation par source et contrôle de contenu. [ADR 0020](adr/0020-recherche-sources-et-remplacement-buffers.md). La suite prioritaire est R2 : sauvegarde coordonnée, historique local durable et récupération.

L’[atelier 0.14](implementation/workbench-alpha.md) ajoute menus/palette/contextes, ouverture rapide, réglages de code, historique Git paginé et terminal humain non interactif. [ADR 0019](adr/0019-outils-atelier-et-terminal-humain.md). Le shell n’est pas accessible à l’agent ; historique local durable, commit intégré, PTY et réseau Git intégré restent à construire.

Nom de marque adopté le 4 octobre 2026 : **CPCéleste**, signature « Vos idées prennent vie en BASIC. ». [Charte et kit de marque](brand/README.md). Les rapports historiques gardent leur intitulé d’origine ; aucun format persistant n’est renommé.

Date de référence : **2026-10-04**. Responsable produit : **Térence FERUT / AstroWare Conception**. Les spécifications servent de référence au produit. Le [guide de l'alpha d'édition](implementation/editor-alpha.md), le [rapport J0](implementation/j0-report.md) et le [banc local](../tools/j0-harness/README.md) distinguent code disponible, preuves et qualification encore bloquée. L'[ADR 0009](adr/0009-edition-independante.md) découple l'édition du go moteur.

## Documents de référence

La [roadmap qualifiée d’un IDE complet](specifications/17-roadmap-ide-complet.md) inventorie 75 fonctionnalités, leurs états/priorités/dépendances et critères de validation, puis définit les lots R1–R9. Elle complète les jalons techniques J0–J6/JG et devient le backlog produit détaillé à suivre.

La tranche [projets BASIC 0.5](implementation/projects-alpha.md) ajoute dossiers, manifeste, plusieurs buffers et export multifichier. Elle ne clôture pas la durabilité J1-03 ; voir l'[ADR 0010](adr/0010-projets-basic-incrementaux.md).

La tranche [agent OpenAI 0.6](implementation/agent-alpha.md) réalise missions à outils, clé de session, mutations et checkpoint. Le [plan d'intégration du moteur CPC](implementation/emulator-integration.md) distingue wrapper existant, worker desktop prévu et qualification firmware bloquée. [ADR 0011](adr/0011-agent-openai-metier.md).

La tranche [ROM locales 0.7](implementation/firmware-alpha.md), datée du 4 octobre, ajoute import séparé, stockage par empreinte, vérification et configuration persistante ; aucun boot CPC n'est qualifié. [ADR 0012](adr/0012-configuration-rom-locale.md).

La tranche [renumérotation 0.8](implementation/renumber-alpha.md) ajoute plans de substitutions, contrôle de révision et annulation Monaco, ainsi que le même outil métier pour l'agent. Couverture conservatrice partielle, sans qualification d'exécution ni clôture ACC-05.

La tranche [documents texte 0.9](implementation/documents-alpha.md) ajoute import immuable TXT/MD, aperçu texte sûr, empreintes et outils de lecture/recherche autorisés par mission. [ADR 0013](adr/0013-documents-texte-incrementaux.md). Contribution partielle à J4/J5, sans images/PDF ni conversion CPC.

La tranche [images 0.10](implementation/images-alpha.md) ajoute PNG/JPEG, garde des dimensions, aperçu PNG nettoyé et outil d'inspection visuelle à la demande dans le scope documentaire. [ADR 0014](adr/0014-images-natives-et-contexte-visuel.md). WebP/PDF, conversion écran et vision OpenAI réelle restent ouverts.

La tranche [PDF texte 0.11](implementation/pdf-alpha.md) ajoute import vérifié, extraction bornée dans un thread dédié, navigation par page et outils agent ciblés. [ADR 0016](adr/0016-pdf-texte-borne.md). Pas de rendu PDF/OCR ni qualification Windows/macOS ; J4-02 reste partiel. [Git intégré](specifications/16-integration-git.md) est conçu et devient la prochaine tranche indépendante JG-A.

La tranche [Git lecture seule 0.12](implementation/git-alpha.md) ajoute découverte, statut et diff index/disque par Git natif, avec configuration restrictive et buffers préservés. [ADR 0017](adr/0017-git-inspection-conservatrice.md). JG-A1/A2 restent partiels : init, stage, commits/historique puis synchronisation encore ouverts ; aucun outil Git n'est accordé à l'IA.

La tranche [dépôt/index Git 0.13](implementation/git-local-index-alpha.md) ajoute aperçu/confirmation de création `main`, exclusions privées, stage/unstage par fichier et snapshots de précondition avec index isolé. [ADR 0018](adr/0018-git-init-et-index-isole.md). Aucune source remplacée, aucun commit automatique ni capacité Git de l'IA. Identité/commits/historique puis réseau restent ouverts ; JG-A n'est pas clos.

| Document | Question traitée |
| --- | --- |
| [00 — Cadrage produit](specifications/00-cadrage-produit.md) | Pour qui, pour quoi, avec quel périmètre ? |
| [01 — Exigences fonctionnelles](specifications/01-exigences-fonctionnelles.md) | Quels comportements l'outil doit-il fournir ? |
| [02 — Interface et parcours](specifications/02-interface-parcours.md) | Comment l'utilisateur accomplit-il son travail ? |
| [03 — Domaines et DDD](specifications/03-domaines-ddd.md) | Quels concepts, règles et responsabilités structurent le produit ? |
| [04 — Architecture technique](specifications/04-architecture-technique.md) | Quels composants, processus et dépendances ? |
| [05 — Locomotive BASIC](specifications/05-locomotive-basic.md) | Quelle syntaxe, quelles analyses et quelles transformations ? |
| [06 — Émulateur et machines](specifications/06-emulateur-machines.md) | Comment exécuter et qualifier une véritable machine CPC ? |
| [07 — Construction et DSK](specifications/07-construction-dsk.md) | Comment produire et vérifier un support exploitable ? |
| [08 — Ressources et documents](specifications/08-ressources-documents.md) | Comment exploiter images, textes, Markdown et PDF ? |
| [09 — IA](specifications/09-assistance-ia.md) | Comment contextualiser, générer, corriger et contrôler les changements ? |
| [10 — Données et contrats](specifications/10-donnees-contrats.md) | Quels fichiers, protocoles, révisions et migrations ? |
| [11 — Qualité et recette](specifications/11-qualite-recette.md) | Comment démontrer que les exigences sont satisfaites ? |
| [12 — Feuille de route](specifications/12-feuille-de-route.md) | Dans quel ordre réaliser le produit ? |
| [13 — Risques et arbitrages](specifications/13-risques-arbitrages.md) | Qu'est-ce qui peut changer et à quelle condition ? |
| [14 — Programmation agentique](specifications/14-programmation-agentique.md) | Comment l'agent agit-il sur les fichiers, les ressources et les essais ? |
| [15 — Corpus Locomotive BASIC](specifications/15-corpus-locomotive-basic.md) | Comment les références du langage guident-elles et vérifient-elles le travail ? |
| [16 — Git intégré](specifications/16-integration-git.md) | Comment versionner, gérer les branches et synchroniser sans perdre ni publier implicitement le travail ? |
| [17 — Roadmap IDE complet](specifications/17-roadmap-ide-complet.md) | Quelles 75 fonctionnalités réaliser, dans quel ordre et avec quelles preuves ? |
| [18 — Incréments IDE de production](specifications/18-increments-ide-production.md) | Quels parcours, dépendances et recettes pour les huit lots ? |
| [19 — Expérience et consommation agent](specifications/19-agent-experience-consommation.md) | Comment comprendre une mission, reprendre et suivre son coût ? |
| [Glossaire](reference/glossaire.md) | Quel vocabulaire partager ? |
| [Sources](reference/sources.md) | Sur quelles références reposent les décisions ? |
| [ADR](adr/README.md) | Pourquoi les options principales ont-elles été retenues ? |

## Contrats et exemples

Les contrats JSON Schema Draft 2020-12 définissent les formes de données persistées, sans implémenter les règles métier interdocuments : [projet](../contracts/project.schema.json), [proposition IA en mode revue](../contracts/ai-proposal.schema.json), [rapport de construction](../contracts/build-report.schema.json) et [mission agentique](../contracts/agent-task.schema.json). Les invariants complémentaires sont dans les documents 10 et 14.

Le projet [hello-cpc](../examples/hello-cpc/README.md) fournit un manifeste et une source BASIC cohérents avec le schéma. Les fichiers [proposition IA](../examples/ai-proposal.json) et [rapport de construction illustratif](../examples/build-report.json) montrent les échanges attendus. Le rapport est un **exemple contractuel**, pas un résultat d'exécution.

La [mission illustrative](../examples/agent-task.json) décrit le mode agent, sans prétendre avoir été exécutée. Le [corpus initial](../knowledge/locomotive-basic/README.md) contient les références fournies au lancement et un catalogue de provenance. Les permissions de mission permettent l'exploration progressive dans le périmètre choisi ; elles ne requièrent pas de sélectionner chaque fichier avant chaque appel.

## Règles de lecture et d'évolution

Les mots **DOIT**, **NE DOIT PAS**, **DEVRAIT** décrivent respectivement une obligation, une interdiction et une recommandation avec dérogation documentée. Les exigences `REQ-*` sont définies une seule fois dans le document 01. Les scénarios `ACC-*` et les jalons `J*` les relient à une preuve et à une livraison.

Le périmètre du **MVP produit** inclut l'éditeur, l'émulation, le DSK, les pièces jointes et l'IA. J1 ou J2 sont des incréments techniques, pas un MVP qui oublierait l'assistance IA. Les fonctions ultérieures sont explicitement identifiées.

En cas de contradiction : contrat métier et exigence spécifique priment sur illustration ; une ADR remplace un choix précédent seulement lorsqu'elle le dit. Tout changement incompatible exige une mise à jour coordonnée des schémas, exemples, scénarios et ADR concernés. Aucun texte ne doit présenter un objectif de performance ou un essai prévu comme une mesure effectuée.

Les [préférences et retours utilisateurs 0.25](adr/0032-preferences-et-retours-utilisateurs.md) ajoutent thèmes/police/édition/disposition persistés, auto-save de projet opt-in, journal Git dans le dock et tickets préparés depuis Aide.

L’[agent 0.29](implementation/agent-missions-alpha.md) sépare réglages et mission, affiche résultats/erreurs et consommations, et reprend les limites avec contexte conservé dans la session ([ADR 0036](adr/0036-agent-reprise-resultats-et-consommation.md)). Spécifications des huit lots au document 18 et parcours agent au document 19 ; aucune qualification globale J5/J6 annoncée.

L’[analyse de flux 0.40.0](implementation/basic-control-flow-alpha.md) ajoute au rapport Qualité un graphe exploratoire, les appels et cycles, et une complexité locale par entrée, avec conclusions suspendues sur les formes inconnues ([ADR 0049](adr/0049-graphe-basic-conservateur.md)).
