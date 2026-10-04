# CPCéleste — Dossier de conception et réalisation — version 0.13

Nom de marque adopté le 4 octobre 2026 : **CPCéleste**, signature « Vos idées prennent vie en BASIC. ». [Charte et kit de marque](brand/README.md). Les rapports historiques gardent leur intitulé d’origine ; aucun format persistant n’est renommé.

Date de référence : **2026-10-04**. Responsable produit : **Térence FERUT / AstroWare Conception**. Les spécifications servent de référence au produit. Le [guide de l'alpha d'édition](implementation/editor-alpha.md), le [rapport J0](implementation/j0-report.md) et le [banc local](../tools/j0-harness/README.md) distinguent code disponible, preuves et qualification encore bloquée. L'[ADR 0009](adr/0009-edition-independante.md) découple l'édition du go moteur.

## Documents de référence

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
