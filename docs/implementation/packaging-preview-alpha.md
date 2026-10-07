# Alpha 0.38.1 — Packaging Preview

CPCéleste dispose désormais d’une chaîne de packaging desktop reproductible destinée à révéler tôt les problèmes qui n’apparaissent pas en développement.

## Artefacts

Windows x64 :

- `CPCeleste-Setup-0.38.1-x64.exe` : installateur NSIS par utilisateur ;
- `CPCeleste-Portable-0.38.1-x64.exe` : version autonome sans installation.

Linux x64 :

- `CPCeleste-0.38.1-x86_64.AppImage` ou nom d’architecture équivalent généré par Electron Builder ;
- `cpceleste_0.38.1_amd64.deb` ou nom d’architecture équivalent.

Chaque job produit également `SHA256SUMS.txt`.

## Ce qui est réellement embarqué

Le build desktop prépare d’abord le moteur CPC WebAssembly verrouillé, puis Vite et TypeScript produisent le renderer et le processus Electron. La release contient donc :

- l’IDE Electron ;
- le renderer React/Monaco ;
- le moteur CPC `cpc.mjs` / `cpc.wasm` ;
- le corpus Locomotive BASIC utilisé par l’aide et l’agent ;
- les dépendances runtime nécessaires ;
- les licences.

Les ROM OS/BASIC/AMSDOS ne font jamais partie de la release. Elles restent des entrées privées importées par l’utilisateur et stockées dans le répertoire applicatif de son profil.

## Validation CI

La CI construit les vrais formats finaux, puis démarre l’application depuis le dossier unpacked produit par Electron Builder. Le test exige le vrai titre, le branding, le renderer React et Monaco. Cela valide la résolution du renderer, du preload, du corpus et des dépendances runtime au démarrage.

Le premier essai avec ASAR a révélé `net::ERR_UNEXPECTED` sur les sous-ressources JS/CSS du protocole `cpceleste://`. La preview 0.38.1 garde donc les ressources applicatives unpacked. Ce choix ne modifie pas les frontières de sécurité Electron et évite de déclarer une compatibilité ASAR non prouvée.

Les packages sont ensuite exposés comme artefacts GitHub Actions pendant 14 jours. Il ne s’agit pas encore d’une publication stable ni d’une mise à jour automatique.

## Étape suivante de distribution

Avant 1.0, IDE-071/072 doivent encore couvrir la signature Windows, l’upgrade sans perte, désinstallation, auto-update, politique de publication et qualification des plateformes annoncées.
