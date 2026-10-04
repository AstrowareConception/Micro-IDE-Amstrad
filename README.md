# CPCéleste

**Vos idées prennent vie en BASIC.** Un logiciel AstroWare Conception.

<img src="apps/desktop/public/brand/cpceleste-icon.png" alt="Logo CPCéleste : orbite cyan pixelisée, invite de code blanche et étoile ambre" width="128" height="128" />

Nom de produit du projet historiquement appelé « Micro IDE Amstrad ». [Identité visuelle et kit de marque](docs/brand/README.md). Le dépôt et les formats de projets conservent leurs identifiants techniques.

Un atelier de programmation pour écrire du **Locomotive BASIC**, le tester dans un **Amstrad CPC émulé**, travailler avec une **IA et ses propres documents**, puis partager une **disquette DSK utilisable hors de l'IDE**.

**État au 4 octobre 2026 : alpha desktop, version 0.18.** Electron/Monaco propose édition BASIC, menus/palette/contextes, ouverture rapide, renumérotation conservatrice, projets multifichiers et export DSK, ainsi qu'un agent OpenAI à outils : exploration, références du corpus fourni, documents TXT/MD/PDF texte et aperçus PNG/JPEG autorisés, création/remplacement de sources, renumérotation, analyse et construction, journal, avant/après et restauration de la mission courante. Clé API en mémoire côté main. L'import local des ROM OS/BASIC/AMSDOS et leur vérification sont disponibles ; Git natif ajoute statut/diff, création de dépôt, indexation sélective locale et historique paginé. Le terminal humain exécute des commandes hôte sans PTY, avec confirmation et limites ; aucun accès shell accordé à l’IA. Ce n'est pas encore le MVP : crash recovery complet, WebP/rendu PDF, commits/synchronisation Git intégrés, conversion écran et émulation intégrée qualifiée restent à construire. J0 attend un jeu firmware réel et les essais dans un émulateur indépendant ; aucun boot BASIC ou résultat matériel n'est revendiqué.

## Lancer l'éditeur

**Historique local 0.18** : versions avant/après des sauvegardes de projet, rétention 20 snapshots/64 Mio, diff et restauration dans le buffer avec Ctrl Z. Enregistrer actif partage le journal de reprise. [Guide et limites](docs/implementation/local-history-alpha.md). Récupération des brouillons et mutations agent restent à construire.

**Reprise 0.17** : Enregistrer tout journalise ses versions avant/après. À la réouverture d’un projet interrompu, un dialogue natif propose Annuler, Terminer ou Rétablir ; les conflits bloquent la reprise. [Guide et limites](docs/implementation/recovery-alpha.md). Qualification d’arrêt de processus Linux ; historique local, autres mutations et panne électrique restent ouverts.

**Enregistrer tout 0.16** sauvegarde les buffers du projet avec contrôle préalable de toutes les sources, compensation en mémoire sur erreur et undo conservé. [Guide et limites](docs/implementation/save-all-alpha.md). La version 0.17 ajoute le journal et la reprise décrits ci-dessus ; la version 0.18 ajoute l’historique local décrit ci-dessus.

**Recherche 0.15** : `Ctrl/Cmd Maj F` recherche les sources chargées, brouillons compris. Navigation intersource, aperçu et remplacement des fichiers choisis, undo par fichier ; aucune sauvegarde implicite. [Guide et limites](docs/implementation/search-alpha.md).

**Outils d’atelier 0.14** : `Ctrl/Cmd Maj P` ouvre la palette, `Ctrl/Cmd P` les sources. Menus Fichier/Édition/BASIC/Affichage, clic droit éditeur/onglet et bouton ⋯ d’une source. Historique Git en lecture seule et terminal local à commandes avec arrêt ; [guide complet et limites](docs/implementation/workbench-alpha.md).

Avec Node 24.12+ dans la branche 24 :

```bash
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run build:desktop
npm start
```

L'application s'ouvre sur un exemple BASIC. `Ctrl Espace` complète, `Ctrl S` enregistre et `F12` rejoint une cible littérale. Aucune ROM ou clé IA n'est nécessaire pour éditer et construire un DSK. [Guide, sécurité et limites de cette alpha](docs/implementation/editor-alpha.md).

**Renuméroter** propose plage, aperçu et application au buffer en une action annulable. Les cibles locales couvertes sont réécrites ; formes opaques/calculées et conflits sont refusés. L'agent dispose du même outil. [Guide de renumérotation 0.8](docs/implementation/renumber-alpha.md).

Pour travailler en plusieurs fichiers : **Créer projet dans un dossier vide**, ou **Ouvrir projet** sur `examples/hello-cpc`. [Guide des projets 0.5 et limites de sauvegarde](docs/implementation/projects-alpha.md). L'export utilise tous les buffers ; Enregistrer sauvegarde uniquement l'onglet actif ; Enregistrer tout sauvegarde les sources du projet.

Pour l'IA : ouvrir un projet, configurer sa **clé API OpenAI** dans le panneau Agent, puis lancer une mission. Les modifications de sources sont enregistrées automatiquement, avec checkpoint et contrôles de hash. [Guide agent 0.6, confidentialité, budgets et limites](docs/implementation/agent-alpha.md). Les tests automatisés utilisent un transport contrôlé, sans appel OpenAI réel facturé.

Dans **Documents du projet**, importer un TXT ou Markdown UTF-8. L'original est copié, vérifié et consultable comme texte en lecture seule. Cocher **Autoriser les documents du projet pour cette mission** permet à l'agent d'en lire/rechercher des extraits ; les pièces jointes restent exclues du DSK. [Guide documents 0.9](docs/implementation/documents-alpha.md).

**Importer image PNG / JPEG** ajoute un original vérifié et son aperçu nettoyé. L'agent autorisé peut demander cet aperçu pour une analyse visuelle avec un modèle compatible ; aucun pixel n'est transmis automatiquement au lancement. Limites : 1 Mio/fichier, 4 mégapixels/image, 4 Mio et 10 documents/projet. [Guide images 0.10](docs/implementation/images-alpha.md). Conversion SCR, WebP et vision distante réelle restent à qualifier/réaliser.

**Importer PDF** ajoute une copie vérifiée et un aperçu texte par page. Extraction PDF.js locale en thread dédié : 20 pages, 64 Kio de texte/page, 256 Kio/PDF, timeout 15 s, quotas d'originaux communs inchangés. L'agent autorisé lit/recherche uniquement les pages et extraits demandés. PDF chiffré refusé ; pas de rendu visuel ni OCR, absence de texte annoncée. [Guide PDF 0.11 et limites d'isolation](docs/implementation/pdf-alpha.md).

Le moteur retenu est **floooh/chips en C/WASM**. [Intégration prévue : worker, ROM, session et outils agent](docs/implementation/emulator-integration.md). Le wrapper/banc existe ; le panneau machine Electron attend le go firmware J0.

**Git · dépôt et index locaux (0.13)** affiche version, branche, statut et diff index/disque, puis permet de créer un dépôt vide `main` avec exclusions et d'indexer/retirer un seul fichier sélectionné, avec confirmation native et préconditions. Les brouillons bloquent les mutations sans sauvegarde automatique. Git doit être installé séparément ; configurations non qualifiées/worktrees/sous-modules refusés. Sources déclarées, manifeste et `.gitignore` seulement ; pièces jointes privées exclues. [Guide 0.13 et limites](docs/implementation/git-local-index-alpha.md), [lecture 0.12](docs/implementation/git-alpha.md). L’historique paginé est ajouté en 0.14 ; identité/commit puis clone/remotes/branches/fetch/pull/push restent à construire selon la [spécification JG](docs/specifications/16-integration-git.md). Le terminal humain peut lancer Git sous la responsabilité de l’utilisateur ; il ne remplace pas la qualification des futurs boutons de synchronisation.

Préparer les ROM dans **ROM du CPC 6128** : importer trois fichiers séparés de 16 Kio, vérifier les hashes et retrouver la sélection au redémarrage. Les fichiers restent dans le stockage applicatif local, hors projet et IA. [Guide ROM 0.7 et limites](docs/implementation/firmware-alpha.md). Un jeu complet reste expérimental ; ce panneau ne démarre pas encore la machine.

`npm run dev:editor` démarre uniquement un aperçu navigateur sur localhost : sauvegarder télécharge un fichier, ce n'est pas l'application de bureau.

## Direction retenue

| Élément | Choix |
| --- | --- |
| Produit | Application de bureau locale ; Windows en priorité, puis Linux et macOS |
| Machine de référence | CPC 6128 classique, Locomotive BASIC 1.1, AMSDOS |
| Interface | Electron, React, TypeScript, Monaco Editor |
| Cœur métier | TypeScript strict ; monolithe modulaire, DDD et ports/adaptateurs |
| Émulation | `floooh/chips` en C, compilé en WebAssembly avec Emscripten ; qualification obligatoire au jalon J0 |
| Programme CPC | BASIC numéroté, exécuté par la ROM de la machine ; export ASCII en premier, tokenisé ensuite |
| Livraison CPC | DSK standard, format AMSDOS DATA, un lecteur A ; Extended DSK limité à l'import pris en charge |
| IA | Agent local à outils métier, fournisseurs interchangeables ; premier adaptateur OpenAI avec tool calling, clé personnelle |
| Stockage | Projet en dossier ouvert, fichiers texte et manifeste JSON versionné ; aucun serveur imposé |

La préparation d'un programme BASIC n'est pas une compilation Z80. L'IDE analyse, encode, construit le support et pilote l'émulateur. Une véritable chaîne assembleur pourra être ajoutée ultérieurement.

## Lire et reprendre le projet

Le [backlog complet et qualifié de CPCéleste](docs/specifications/17-roadmap-ide-complet.md) liste les 75 fonctionnalités, priorités, états, dépendances, critères de recette et lots à réaliser. Il distingue socle 1.0 et outils avancés.

Commencer par le [sommaire du dossier](docs/README.md), puis le [cadrage produit](docs/specifications/00-cadrage-produit.md), le [modèle métier](docs/specifications/03-domaines-ddd.md) et l'[architecture](docs/specifications/04-architecture-technique.md).

Les [décisions d'architecture](docs/adr/README.md) expliquent les arbitrages. La [feuille de route](docs/specifications/12-feuille-de-route.md) définit les critères de sortie. **J0 reste en HOLD pour l'exécution**, mais l'[ADR 0009](docs/adr/0009-edition-independante.md) autorise l'édition indépendante : consulter le [rapport réel J0](docs/implementation/j0-report.md) et le [guide du banc local](tools/j0-harness/README.md).

Avec Node 24.12+ dans la branche 24 et Python 3.12 :

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build:hello
npm run build:probe
```

Ces commandes produisent `out/hello.dsk` et `out/probe.dsk`, validés structurellement. La [procédure C/WASM](tools/j0-harness/README.md) précise les compilateurs et la fourniture de firmware local. Aucun téléchargement de ROM n'est effectué. Le workflow `J0 prototype` teste codecs et transports avec une ROM synthétique originale ; il ne prétend pas exécuter Locomotive BASIC.

Pour vérifier le dossier avec Python 3.12 ou supérieur :

```bash
python scripts/check_specs.py
```

La validation complète des contrats nécessite aussi le paquet `jsonschema` :

```bash
python -m pip install -r scripts/requirements-docs.txt
python scripts/check_specs.py --schemas
```

Les commandes Python vérifient la documentation et les contrats. Le workflow GitHub Actions `Specifications` automatise ce contrôle, distinct des tests du prototype.

## Principes de réalisation

- Le projet et le code restent lisibles, portables et utilisables sans IA.
- Le DSK est un véritable artefact CPC, distinct du projet de travail.
- Le mode agent crée et modifie les fichiers autorisés, construit, teste et corrige ; journal, checkpoints et diff rendent le travail contrôlable.
- Les références Locomotive BASIC sont consultables par l'agent et qualifiées par dialecte ; le mode de revue préalable reste optionnel.
- La compatibilité est qualifiée par profil de machine et jeux d'essai.
- Les ROM sont des dépendances distinctes ; aucun firmware tiers n'est inclus dans ce dépôt.
- Chaque incrément fait évoluer ensemble code, spécifications et preuves de recette.

Les fichiers de référence fournis au lancement ont été inventoriés dans [le dossier de sources](docs/reference/sources.md). Les contributions propres au projet sont sous [licence MIT](LICENSE) ; les dépendances et les contenus tiers conservent leurs conditions respectives.
