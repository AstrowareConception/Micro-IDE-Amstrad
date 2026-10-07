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

Le workflow `.github/workflows/package-preview.yml` construit nativement les deux plateformes sur pull request et sur demande. Chaque job publie ses artefacts CI et son rapport de smoke test.

Un tag de forme `v*-preview*` déclenche en plus un job final qui récupère les artefacts Windows et Linux du même run, régénère un `SHA256SUMS.txt` global et crée une GitHub Release en brouillon.

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
