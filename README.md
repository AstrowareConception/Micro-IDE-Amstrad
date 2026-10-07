# CPCéleste

**Tests BASIC 0.37** : assertions natives sur des listings autonomes, exécutés à la demande sur des CPC isolés ; résultats par cas, budgets, annulation, provenance et rapports Markdown/JSON. [Guide et exemple](docs/implementation/basic-tests-alpha.md). Jeu ROM 6128 anglais identifié requis ; pas de couverture ou de lecteur de variables ajouté.

**Qualité BASIC 0.36** : rapport local à la demande sur la source active ou les buffers chargés ; longueurs, segments, complexité estimée et cinq pistes de revue localisées. Exports Markdown/JSON, annulation et sources modifiées signalées. [Guide et limites](docs/implementation/basic-quality-alpha.md).

**Inspection CPC 0.35** : registres Z80 et RAM logique en pause, lecture à la demande ; première preuve ciblée de frontières BASIC en natif/WASM, sans débogueur BASIC public. [Guide et limites](docs/implementation/cpc-inspection-alpha.md).

**Diagnostics et performance 0.34** : analyse BASIC en worker temporisé, révisions protégées, contrôles structurels étendus, diagnostics multifichiers et monitoring à la demande. [Guide](docs/implementation/basic-diagnostics-alpha.md). Débogueur BASIC : [faisabilité et étapes](docs/implementation/basic-debugger-plan.md), mapping source et événements encore à qualifier.

**Notifications 0.33** : historique de session, filtres, messages non lus, accès aux détails et aperçus réglables. [Guide et limites](docs/implementation/notifications-alpha.md). PR 26–34 intégrées dans `main`.

**Personnalisation 0.32** : réglages recherchables, accents/densité, options du code, keymap configurable et base inspirée JetBrains, profils importables/exportables, dispositions Édition/Exécution/Agent et mode Concentration. [Guide et limites](docs/implementation/personalization-alpha.md).

**Sources 0.31** : renommer/déplacer/supprimer depuis les commandes et contextes, aperçu et confirmation, brouillons préservés, journal de reprise et rétablissement de la dernière organisation. [Guide et limites](docs/implementation/source-operations-alpha.md).

**Explorateur 0.30** : arborescence réelle, dossiers à la demande, filtre des dossiers chargés, fichiers privés/générés masqués, brouillons signalés et aperçus texte en lecture seule. Sources et documents rejoignent leurs vues existantes ; aucun ajout implicite au DSK. [Guide et limites](docs/implementation/project-explorer-alpha.md).

**Agent 0.29** : réglages IA séparés, résultats/erreurs des outils visibles, pause et reprise de mission, tokens détaillés et estimation USD depuis les tarifs officiels actualisés. [Guide et limites](docs/implementation/agent-missions-alpha.md). Les [specs des huit lots IDE](docs/specifications/18-increments-ide-production.md) et du [nouveau parcours agent](docs/specifications/19-agent-experience-consommation.md) définissent la suite.

**Git et GitHub 0.28** : branches, remotes, clone, fetch/pull/push, dépôts GitHub privés, création de dépôt/PR et message de commit proposé par IA. Accès par menu Git et panneau gauche. [Guide et limites](docs/implementation/git-network-alpha.md).

**Projets récents 0.27** : Fichier → Projets récents (`Ctrl/Cmd R`) retrouve les vingt derniers projets avec filtre, dossier et date. Les menus restent entièrement visibles près des bords de fenêtre. [Guide](docs/implementation/recent-projects-alpha.md).

**Disposition 0.26** : séparateurs redimensionnables, panneaux outils/IA/sorties détachables et agrandissables dans l’IDE, positions conservées, commandes CPC à gauche de l’écran et zoom jusqu’à 300 %. [Guide](docs/implementation/production-workbench-alpha.md).

**Atelier 0.25** : outils et Git à gauche, assistant IA à droite, sorties en bas ; menus exclusifs, icônes, raccourcis et diagnostics syntaxiques pendant la saisie. [Guide](docs/implementation/production-workbench-alpha.md).

**Exécution CPC 0.24** : bouton Exécuter/F5, écran CPC 6128 intégré, buffers non enregistrés, lancement RUN par clavier, pause/arrêt/son et export du disque de session. Trois ROM locales sont nécessaires ; le jeu anglais identifié démarre automatiquement, les autres demandent confirmation de Ready. [Guide](docs/implementation/emulator-run-alpha.md).

**Vos idées prennent vie en BASIC.** Un logiciel AstroWare Conception.

<img src="apps/desktop/public/brand/cpceleste-icon.png" alt="Logo CPCéleste : orbite cyan pixelisée, invite de code blanche et étoile ambre" width="128" height="128" />

Nom de produit du projet historiquement appelé « Micro IDE Amstrad ». [Identité visuelle et kit de marque](docs/brand/README.md). Le dépôt et les formats de projets conservent leurs identifiants techniques.

Un atelier de programmation pour écrire du **Locomotive BASIC**, le tester dans un **Amstrad CPC émulé**, travailler avec une **IA et ses propres documents**, puis partager une **disquette DSK utilisable hors de l'IDE**.

**État au 7 octobre 2026 : alpha desktop, version 0.37.0.** Electron/Monaco propose édition BASIC, menus/palette/contextes, ouverture rapide, renumérotation conservatrice, projets multifichiers et export DSK, ainsi qu'un agent OpenAI à outils : exploration, références du corpus fourni, documents TXT/MD/PDF texte et aperçus PNG/JPEG autorisés, création/remplacement de sources, renumérotation, analyse et construction, journal, avant/après et restauration de la mission courante. Clé API en mémoire côté main. L'import local des ROM OS/BASIC/AMSDOS et leur vérification sont disponibles ; Git natif ajoute statut/diff, création de dépôt, indexation sélective locale, commits examinés, historique paginé, branches/remotes et synchronisation fast-forward avec GitHub privé. Le terminal humain exécute des commandes hôte sans PTY, avec confirmation et limites ; aucun accès shell accordé à l’IA. Ce n'est pas encore le MVP : crash recovery complet, WebP/rendu PDF, merge/rebase et résolution des conflits Git, conversion écran et émulation intégrée qualifiée restent à construire. Boot BASIC 1.1 et RUN depuis DSK sont vérifiés avec un jeu 6128 anglais identifié ; la relecture indépendante et la qualification matérielle globale restent ouvertes.

## Lancer l'éditeur

**Identité Git 0.23** : profil privé facultatif, mémorisation/chargement/oubli du nom et de l’email pour les prochains projets et redémarrages. [Guide et limites](docs/implementation/git-identity-alpha.md).

**Commits Git 0.22** : identité explicite, aperçu exact de l’index et confirmation native ; commits locaux non signés, hooks désactivés, index/disque/configuration conservés. [Guide et limites](docs/implementation/git-commit-alpha.md).

**Mutations agent 0.21** : journal durable des sources/manifeste, reprise explicite après interruption (terminer/rétablir), créations et restauration de mission couvertes, versions agent dans l’historique local. [Guide et limites](docs/implementation/agent-durability-alpha.md).

**Modifications externes 0.20** : détection des sources modifiées/supprimées, diff et chargement explicite avec Ctrl Z, ou conservation du buffer après comparaison. Aucun rechargement automatique. [Guide et limites](docs/implementation/external-alpha.md).

**Brouillons 0.19** : copie locale opt-in sans écriture des sources, comparaison et reprise sélective avec Ctrl Z après redémarrage. Une copie héritée reste protégée jusqu’à revue/restauration ou effacement explicite. [Guide et limites](docs/implementation/drafts-alpha.md). Watcher externe et extension aux mutations agent suivent.

**Historique local 0.18** : versions avant/après des sauvegardes de projet, rétention 20 snapshots/64 Mio, diff et restauration dans le buffer avec Ctrl Z. Enregistrer actif partage le journal de reprise. [Guide et limites](docs/implementation/local-history-alpha.md). Récupération des brouillons et mutations agent restent à construire.

**Reprise 0.17** : Enregistrer tout journalise ses versions avant/après. À la réouverture d’un projet interrompu, un dialogue natif propose Annuler, Terminer ou Rétablir ; les conflits bloquent la reprise. [Guide et limites](docs/implementation/recovery-alpha.md). Qualification d’arrêt de processus Linux ; historique local, autres mutations et panne électrique restent ouverts.

**Enregistrer tout 0.16** sauvegarde les buffers du projet avec contrôle préalable de toutes les sources, compensation en mémoire sur erreur et undo conservé. [Guide et limites](docs/implementation/save-all-alpha.md). La version 0.17 ajoute le journal et la reprise décrits ci-dessus ; la version 0.18 ajoute l’historique local décrit ci-dessus.

**Recherche 0.15** : `Ctrl/Cmd Maj F` recherche les sources chargées, brouillons compris. Navigation intersource, aperçu et remplacement des fichiers choisis, undo par fichier ; aucune sauvegarde implicite. [Guide et limites](docs/implementation/search-alpha.md).

**Outils d’atelier 0.14** : `Ctrl/Cmd Maj P` ouvre la palette, `Ctrl/Cmd P` les sources. Menus Fichier/Édition/BASIC/Affichage, clic droit éditeur/onglet et bouton ⋯ d’une source. Historique Git en lecture seule et terminal local à commandes avec arrêt ; [guide complet et limites](docs/implementation/workbench-alpha.md).

Avec Node 24.12+ dans la branche 24, Python 3.12+ et Git installés (Windows/PowerShell, Linux et macOS) :

```bash
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run build:desktop
npm start
```

Depuis 0.24.1, `npm run build:desktop` prépare automatiquement le moteur CPC manquant : headers vérifiés, SDK Emscripten 4.0.15 verrouillé dans `.cache/emsdk`, puis compilation WASM. Le premier build télécharge le SDK (volumineux) et nécessite Internet ; aucun firmware n’est téléchargé. Les builds suivants réutilisent le moteur local. `npm run emulator:prepare` le reconstruit explicitement après un changement du wrapper C ou du lock. Un compilateur externe peut être fourni avec `EMCC` ; voir le [guide](docs/implementation/emulator-run-alpha.md).

L'application s'ouvre sur un exemple BASIC. `Ctrl Espace` complète, `Ctrl S` enregistre et `F12` rejoint une cible littérale. Aucune ROM ou clé IA n'est nécessaire pour éditer et construire un DSK. [Guide, sécurité et limites de cette alpha](docs/implementation/editor-alpha.md).

**Renuméroter** propose plage, aperçu et application au buffer en une action annulable. Les cibles locales couvertes sont réécrites ; formes opaques/calculées et conflits sont refusés. L'agent dispose du même outil. [Guide de renumérotation 0.8](docs/implementation/renumber-alpha.md).

Pour travailler en plusieurs fichiers : **Créer projet dans un dossier vide**, ou **Ouvrir projet** sur `examples/hello-cpc`. [Guide des projets 0.5 et limites de sauvegarde](docs/implementation/projects-alpha.md). L'export utilise tous les buffers ; Enregistrer sauvegarde uniquement l'onglet actif ; Enregistrer tout sauvegarde les sources du projet.

Pour l'IA : ouvrir un projet, configurer sa **clé API OpenAI** dans le panneau Agent, puis lancer une mission. Les modifications de sources sont enregistrées automatiquement, avec checkpoint et contrôles de hash. [Guide agent 0.6, confidentialité, budgets et limites](docs/implementation/agent-alpha.md). Les tests automatisés utilisent un transport contrôlé, sans appel OpenAI réel facturé.

Dans **Documents du projet**, importer un TXT ou Markdown UTF-8. L'original est copié, vérifié et consultable comme texte en lecture seule. Cocher **Autoriser les documents du projet pour cette mission** permet à l'agent d'en lire/rechercher des extraits ; les pièces jointes restent exclues du DSK. [Guide documents 0.9](docs/implementation/documents-alpha.md).

**Importer image PNG / JPEG** ajoute un original vérifié et son aperçu nettoyé. L'agent autorisé peut demander cet aperçu pour une analyse visuelle avec un modèle compatible ; aucun pixel n'est transmis automatiquement au lancement. Limites : 1 Mio/fichier, 4 mégapixels/image, 4 Mio et 10 documents/projet. [Guide images 0.10](docs/implementation/images-alpha.md). Conversion SCR, WebP et vision distante réelle restent à qualifier/réaliser.

**Importer PDF** ajoute une copie vérifiée et un aperçu texte par page. Extraction PDF.js locale en thread dédié : 20 pages, 64 Kio de texte/page, 256 Kio/PDF, timeout 15 s, quotas d'originaux communs inchangés. L'agent autorisé lit/recherche uniquement les pages et extraits demandés. PDF chiffré refusé ; pas de rendu visuel ni OCR, absence de texte annoncée. [Guide PDF 0.11 et limites d'isolation](docs/implementation/pdf-alpha.md).

Le moteur retenu est **floooh/chips en C/WASM**. [Intégration et qualification](docs/implementation/emulator-integration.md). Le panneau machine Electron permet désormais Exécuter/F5 ; la qualification complète J0 reste ouverte.

**Git · dépôt et index locaux (0.13)** affiche version, branche, statut et diff index/disque, puis permet de créer un dépôt vide `main` avec exclusions et d'indexer/retirer un seul fichier sélectionné, avec confirmation native et préconditions. Les brouillons bloquent les mutations sans sauvegarde automatique. Git doit être installé séparément ; configurations non qualifiées/worktrees/sous-modules refusés. Sources déclarées, manifeste et `.gitignore` seulement ; pièces jointes privées exclues. [Guide 0.13 et limites](docs/implementation/git-local-index-alpha.md), [lecture 0.12](docs/implementation/git-alpha.md). L’historique paginé est ajouté en 0.14 ; [commits locaux 0.22](docs/implementation/git-commit-alpha.md) disponibles avec identité explicite par commit ; [profil privé d’identité 0.23](docs/implementation/git-identity-alpha.md) disponible ; branches/remotes/clone/fetch/pull/push sont ajoutés en [0.28](docs/implementation/git-network-alpha.md) ; réglage d’identité par dépôt et Git avancé restent à construire selon la [spécification JG](docs/specifications/16-integration-git.md). Le terminal humain peut lancer Git sous la responsabilité de l’utilisateur ; il ne remplace pas la qualification des boutons de synchronisation.

Préparer les ROM dans **ROM du CPC 6128** : importer trois fichiers séparés de 16 Kio, vérifier les hashes et retrouver la sélection au redémarrage. Les fichiers restent dans le stockage applicatif local, hors projet et IA. [Guide ROM 0.7 et limites](docs/implementation/firmware-alpha.md). Après cet import, **Exécuter/F5** démarre la machine intégrée. Un jeu complet reste expérimental ; voir le [guide Exécuter](docs/implementation/emulator-run-alpha.md).

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

Les [décisions d'architecture](docs/adr/README.md) expliquent les arbitrages. La [feuille de route](docs/specifications/12-feuille-de-route.md) définit les critères de sortie. **J0 reste en HOLD pour sa qualification globale**, mais l'[ADR 0009](docs/adr/0009-edition-independante.md) autorise l'édition indépendante : consulter le [rapport réel J0](docs/implementation/j0-report.md) et le [guide du banc local](tools/j0-harness/README.md).

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

**Préférences et retours 0.25** : Outils → Paramètres (`Ctrl/Cmd ,`) conserve thème, police, édition, dimensions et auto-save des sources du projet (opt-in). Le dock accueille le journal Git. Aide → Proposer une amélioration prépare un ticket à relire/envoyer sur GitHub ; [guide](docs/implementation/production-workbench-alpha.md).
