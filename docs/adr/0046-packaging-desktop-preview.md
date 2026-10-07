# ADR 0046 — Packaging desktop précoce et qualifié

## Statut

Accepté pour l’alpha 0.38.1.

## Contexte

CPCéleste est déjà une application Electron mais les incréments précédents étaient exécutés depuis le checkout de développement. Attendre la 1.0 pour produire un véritable installateur ferait découvrir trop tard les écarts de chemins, d’ASAR, de workers, de WebAssembly, de ressources et de stockage utilisateur.

Le moteur CPC, le renderer, les connaissances BASIC et le preload doivent fonctionner depuis une application empaquetée sans Node.js, npm, Python ou Emscripten sur la machine de l’utilisateur final. Les ROM restent une dépendance privée importée localement.

## Décision

La 0.38.1 introduit un **Packaging Preview** volontairement non signé :

- Windows x64 : installateur NSIS et exécutable portable ;
- Linux x64 : AppImage et paquet deb ;
- application empaquetée avec ASAR ;
- icône CPCéleste issue du kit de marque ;
- moteur CPC/WASM construit avant emballage et embarqué dans le renderer ;
- `electron-builder` stable **26.17.0** épinglé dans la commande de packaging, sans dépendance runtime supplémentaire ;
- construction sur la plateforme cible : Windows sur runner Windows, Linux sur runner Linux ;
- checksums SHA-256 des artefacts distribuables ;
- GitHub Release en brouillon uniquement lorsqu’un tag `v*-preview*` déclenche le workflow.

La CI lance ensuite le **binaire réellement empaqueté**, fenêtre masquée, et lui demande une preuve minimale : `app.isPackaged`, version, URL `cpceleste://app/index.html` et lecture du vrai `cpc.wasm` par le protocole applicatif. Ce mode de smoke test n’est actif qu’en application empaquetée et lorsque la variable de CI dédiée est fournie.

## Frontières de distribution

Aucune ROM Amstrad n’est empaquetée ou téléchargée. Les ROM continuent d’être importées vers `app.getPath('userData')`.

Git n’est pas embarqué dans cette tranche : les fonctions Git intégrées conservent leur dépendance à un Git hôte détecté et qualifié séparément.

Les builds preview ne sont pas signés et peuvent donc déclencher SmartScreen ou des avertissements de provenance. Ils ne constituent pas la release 1.0.

## Conséquences

IDE-071 et IDE-072 progressent mais restent partiels. Avant 1.0 restent notamment : installation/désinstallation automatisée, upgrade et migrations sur données existantes, signature Windows, stratégie de mise à jour, tests hors-ligne, ARM64 et qualification macOS.

La recette empaquetée devient une régression permanente afin qu’une modification future du protocole, du WASM ou de l’arborescence `dist` ne produise pas silencieusement un installateur inutilisable.
