# Packaging desktop — alpha 0.38.1

Date : 7 octobre 2026. Incrément partiel IDE-071 / IDE-072, [ADR 0046](../adr/0046-packaging-desktop-preview.md).

## Artefacts visés

| Plateforme | Artefact |
| --- | --- |
| Windows x64 | `CPCeleste-Setup-0.38.1.exe` |
| Windows x64 portable | `CPCeleste-Portable-0.38.1.exe` |
| Linux x64 | `CPCeleste-0.38.1-x86_64.AppImage` |
| Debian / Ubuntu x64 | `cpceleste_0.38.1_amd64.deb` |

Ces paquets sont des previews alpha non signées. Les ROM Amstrad ne sont pas présentes dans les artefacts.

<a id="telecharger"></a>
## Télécharger et démarrer

Build vérifié le **7 octobre 2026** : [exécution 37609669941](https://github.com/AstrowareConception/Micro-IDE-Amstrad/actions/runs/37609669941), commit `06e19b956b955bf5fba9a56a6d8c89a4ea4cd1fb`. Les deux jobs de packaging et les deux contrôles de démarrage du binaire empaqueté sont réussis.

| Archive | Contenu |
| --- | --- |
| [Windows x64](https://github.com/AstrowareConception/Micro-IDE-Amstrad/actions/runs/37609669941/artifacts/11477066469) | Setup, portable, `SHA256SUMS-win.txt`, preuve de démarrage |
| [Linux x64](https://github.com/AstrowareConception/Micro-IDE-Amstrad/actions/runs/37609669941/artifacts/11477206526) | AppImage, deb, `SHA256SUMS-linux.txt`, preuve de démarrage |

Une connexion GitHub est nécessaire pour télécharger ces artefacts. Leur expiration annoncée est le **21 octobre 2026**. Si le lien a expiré, consulter les [Releases](https://github.com/AstrowareConception/Micro-IDE-Amstrad/releases) ou les [derniers packagings réussis](https://github.com/AstrowareConception/Micro-IDE-Amstrad/actions/workflows/package-preview.yml). Au contrôle du 7 octobre, aucune release publique n’était disponible ; un workflow vert n’équivaut pas à une release publiée.

1. Télécharger l’archive correspondant au système et l’extraire entièrement.
2. Vérifier les empreintes contre le manifeste fourni. Sous Windows, `Get-FileHash .\CPCeleste-Portable-0.38.1.exe -Algorithm SHA256` affiche l’empreinte à comparer. Sous Linux, exécuter `sha256sum -c SHA256SUMS-linux.txt` dans le dossier extrait.
3. Windows : ouvrir le portable pour essayer sans installateur, ou le Setup pour installer l’application. La preview non signée peut afficher un avertissement de provenance ; vérifier le fichier et sa provenance avant de décider de l’exécuter.
4. Linux : rendre l’AppImage exécutable (`chmod +x CPCeleste-0.38.1-x86_64.AppImage`) puis la lancer, ou installer le deb avec le gestionnaire de paquets du système. Les bibliothèques système/FUSE de la distribution peuvent être nécessaires ; ne pas désactiver la sandbox pour une utilisation normale.
5. Ouvrir ou créer un projet. L’édition et l’export DSK fonctionnent sans ROM. Pour F5, importer ses ROM OS/BASIC/AMSDOS depuis l’atelier.

Node.js, npm, Python et Emscripten ne sont nécessaires qu’à la construction depuis les sources. Git reste une dépendance séparée pour les fonctions de versionnement. « Portable » désigne ici le lancement sans installateur ; cela ne garantit pas que les préférences soient conservées à côté de l’exécutable.

## Construire localement

Prérequis de build uniquement : Node 24.12+ dans la branche 24, Python 3.12+ et accès réseau lors de la première préparation Emscripten. L’utilisateur final n’a pas besoin de ces outils.

Sous Windows x64 :

```powershell
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run package:preview:win
```

Sous Linux x64 :

```bash
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run package:preview:linux
```

La commande reconstruit d’abord le desktop et le moteur CPC/WASM puis invoque `electron-builder@26.17.0` avec `electron-builder.yml`. Les artefacts et le manifeste SHA-256 sont écrits dans `release/`.

## Recette du paquet réel

`scripts/packaged-smoke.mjs` cherche l’exécutable dans `release/win-unpacked` ou `release/linux-unpacked`, démarre ce binaire packagé et attend une preuve produite par le processus main.

La preuve exige :

1. `app.isPackaged === true` ;
2. la page chargée est `cpceleste://app/index.html` ;
3. le protocole applicatif peut lire `emulator/cpc.wasm` depuis le paquet ASAR ;
4. les quatre octets magiques WebAssembly sont `00 61 73 6D` ;
5. le processus termine proprement.

Sous Linux CI, le binaire unpacked est lancé sous Xvfb avec `--no-sandbox` pour éviter de confondre la politique sandbox du runner avec le contenu du paquet.

## GitHub Actions et release

Le workflow `.github/workflows/package-preview.yml` construit nativement les deux plateformes sur demande (`workflow_dispatch`, en sélectionnant la branche à qualifier), sur les changements de `main` correspondant aux chemins surveillés, ou sur tag preview. Il ne se déclenche plus à chaque mise à jour de pull request. Une nouvelle exécution manuelle sur la même branche annule la précédente ; les publications par tag ne sont pas interrompues automatiquement. Chaque job publie ses artefacts CI et son rapport de smoke test.

Un tag de forme `v*-preview*` déclenche en plus un job final qui récupère les artefacts Windows et Linux du même run, régénère un `SHA256SUMS.txt` global et crée une GitHub Release en brouillon.

## Préparer une release sans reconstruire

Le workflow manuel [Prepare preview release from existing build](../../.github/workflows/prepare-preview-release.yml) reprend les quatre binaires d’une exécution déjà réussie. Depuis Actions, choisir ce workflow, **Run workflow**, branche `main`, puis renseigner :

- `source_run_id` : `37609669941` pour le build ci-dessus, tant que ses artefacts sont disponibles ;
- `preview_tag` : un nouveau tag correspondant à sa version, par exemple `v0.38.1-preview.1`.

Le script vérifie le dépôt et le workflow source, la branche `main`, le succès complet, le commit commun aux artefacts, leur présence et leur non-expiration. Après téléchargement, il vérifie les quatre noms attendus, les SHA-256 **d’origine** et les preuves UI/WASM des deux plateformes. Il produit un manifeste global et `build-provenance.json`, puis crée une release **en brouillon et préversion**, ciblant le commit construit. Il refuse un tag/release existant : aucune pièce jointe existante n’est écrasée. La publication publique reste une action distincte dans GitHub Releases.

Cette préparation ne lance aucune compilation et ne modifie aucun exécutable. Le workflow ne s’exécute ni sur push ni sur PR. Les tests locaux couvrent la sélection du build, les artefacts expirés/incohérents, les versions, les empreintes altérées et les preuves invalides ; la création distante du brouillon reste à exécuter pour valider le parcours GitHub complet.

## Ce qui reste ouvert

- signature Authenticode Windows et réputation SmartScreen ;
- test automatisé de l’installateur NSIS puis désinstallation ;
- conservation/migration de `userData` sur upgrade ;
- auto-update avec canaux stable/beta/nightly ;
- test hors connexion après téléchargement ;
- ARM64 ;
- macOS DMG/notarisation ;
- Git embarqué éventuel ;
- qualification de toutes les fonctions CPC/IA à l’intérieur de la version installée.

La 0.38.1 vise d’abord à rendre impossible une régression où le checkout fonctionne mais le logiciel téléchargé ne démarre pas.
