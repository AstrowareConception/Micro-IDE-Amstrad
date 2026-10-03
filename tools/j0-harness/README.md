# Banc technique J0

Ce prototype construit un disque CPC et expose le cœur C/WASM. Il ne constitue pas encore l'IDE Electron. Lire le [rapport de qualification](../../docs/implementation/j0-report.md) pour les preuves et limites réellement observées.

## Prérequis et construction

Node **24.12.0 ou supérieur dans la branche 24**, Python 3.12, compilateur C pour les tests natifs ; Emscripten **4.0.15** pour le navigateur. Les paquets de développement sont figés dans `package-lock.json`. Aucun paquet JS n'est nécessaire à l'exécution des codecs ou du serveur local.

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build:hello
npm run build:probe
npm run chips:fetch
npm run test:native
```

Le téléchargement vérifie le commit et les SHA-256 des 13 en-têtes du [lock moteur](../../packages/emulator/chips.lock.json). Il ne télécharge aucune ROM. Les tests natifs utilisent une ROM de test originale de 16 Kio, contenant uniquement `JP 0` : ce n'est pas le firmware Amstrad.

Installer ensuite le SDK verrouillé dans le cache local, sous Linux/macOS :

```bash
git clone --depth 1 --branch 4.0.15 https://github.com/emscripten-core/emsdk.git .cache/emsdk
git -C .cache/emsdk rev-parse HEAD
# La sortie attendue est 389a68bc35dcff7ebae4614e1615099dafda00d1.
.cache/emsdk/emsdk install 4.0.15
.cache/emsdk/emsdk activate 4.0.15
source .cache/emsdk/emsdk_env.sh
python scripts/build_emulator.py wasm
node tests/wasm-smoke.mjs
node scripts/serve-harness.mjs
```

Ouvrir `http://127.0.0.1:6128`. Le script de compilation refuse une autre version d'Emscripten. Son environnement peut sélectionner le Node embarqué dans emsdk ; revenir à Node 24 pour les commandes TypeScript. Sous Windows, charger l'environnement avec `emsdk_env.bat` et employer les mêmes scripts Python/Node ; la compilation native GCC et ses sanitizers sont pour l'instant vérifiés sur Linux.

Le serveur écoute uniquement la boucle locale et sert cinq ressources prédéfinies. Il ne fournit aucun endpoint de lecture/écriture de fichiers, de shell ou d'IA. Les imports de firmware restent en mémoire du navigateur ; leurs empreintes apparaissent dans les observations téléchargeables.

Pour le contrôle automatique navigateur, installer Chromium avec `npx playwright install chromium`, puis exécuter `node tests/browser-smoke.mjs`. Sur Linux, `--with-deps` installe aussi ses bibliothèques système ; c'est l'option de la CI. Ce test importe la ROM synthétique, vérifie progression, pause, export et accès HTTP, puis produit `out/j0-harness.png`. Cette capture ne représente pas un boot Amstrad.

## Parcours avec firmware personnel

1. Fournir séparément les ROM **OS, BASIC 1.1 et AMSDOS, chacune de 16 384 octets**, et `out/probe.dsk`. Disposer des droits d'utilisation de ces fichiers. Le prototype contrôle taille et hash ; il ne reconnaît pas encore une liste de firmwares qualifiés. Les ROM inconnues restent expérimentales.
2. Démarrer, regarder l'écran et attendre le prompt BASIC. Cliquer **Le prompt BASIC est visible** seulement lorsqu'il l'est. Ce signal est manuel et enregistré comme tel ; aucun délai ne prouve le boot.
3. Saisir `CAT`, puis `RUN"PROBE.BAS"`. L'injection passe par les touches CPC, espacées de 60 ms de pression et de relâchement en temps émulé. Le clavier physique fonctionne lorsque le canvas a le focus ; une commande injectée a priorité.
4. Le programme charge `CHECK.BIN` à `&9000`, contrôle sa première valeur, écrit `RESULT.TXT` avec OPENOUT/CLOSEOUT, pose le marqueur 42 à `&8000`, trace un rectangle et émet SOUND. Activer le son par le bouton dédié. Presser une touche ; le marqueur à `&8001` devient 43 et le programme affiche le temps écoulé.
5. Vérifier pause, reprise, ESC et reset. La pause fige les ticks, relâche touches/joystick et vide l'audio ; la perte de focus ou la dissimulation de la page met en pause. La reprise ne rattrape pas le temps hôte perdu. Le reset conserve les secteurs de la session mais invalide la confirmation du prompt.
6. Télécharger la disquette de session et les observations JSON. `out/probe.dsk` demeure l'artefact construit. L'export recopie les secteurs du lecteur mutable, pas le listing de départ.
7. Relire le disque téléchargé :

```bash
node scripts/disk-cli.mjs inspect /chemin/session.dsk
node scripts/build-probe.mjs /chemin/session.dsk
```

La seconde commande vérifie le contenu ASCII attendu de `RESULT.TXT`. Elle ne lance aucun émulateur.

8. Dans un Caprice32 externe, consigner version, profil et hashes ROM/disque. Monter le même export, contrôler CAT et exécuter un lecteur BASIC distinct :

```basic
10 OPENIN "RESULT.TXT"
20 LINE INPUT #9,a$
30 CLOSEIN
40 PRINT a$
```

Attendre `J0 DISK WRITE`. Tester également `out/hello.dsk` avec `RUN"MAIN.BAS"`. Garder la capture et le rapport d'essai hors des ROM du dépôt. Un essai sur CPC réel possède sa propre preuve ; il n'est pas déduit de Caprice32.

## Périmètre de l'adaptateur

Le wrapper accepte uniquement le **DSK standard DATA 40 pistes, 1 face, 9 secteurs de 512 octets**, avec IDs C1–C9 distincts, CHRN cohérents et statuts normaux. Il refuse Extended et les géométries atypiques avant le parser upstream. Le reader TypeScript refuse aussi les catalogues hors utilisateur 0, les allocations invalides et les extents incomplets. Un disque lisible par le moteur n'est pas nécessairement importable en tant que projet.

L'API C retourne 0 ou un code d'erreur négatif pour les commandes ; export et audio retournent la longueur produite. Les buffers sont alloués/libérés par l'adaptateur. Une tranche d'exécution est bornée à 20 ms ; le harness utilise des tranches de 10 ms et un maximum de cinq par repaint. Le framebuffer est indexé : palette RGBA8 du cœur, stride distinct de la largeur visible. Audio mono 44 100 Hz, anneau de 4096 échantillons ; un hôte lent abandonne les anciens échantillons, sans stopper l'AY.

`cpc_bridge_peek` observe les premières banques physiques de RAM ; ce n'est ni un debugger BASIC ni une vue logique de toutes les commutations mémoire. Les snapshots, hooks ROM, worker de production et détection d'erreurs BASIC restent à réaliser. Aucun appel ne traduit le BASIC en JavaScript.

## Qualification restante

Le succès d'une ROM synthétique vérifie le transport et le contrôle ; il ne prouve ni boot BASIC, ni SOUND audible, ni TIME du firmware, ni OPENOUT via le contrôleur. Voir les essais bloqués dans le rapport. Ne pas enclencher J1 sur un résultat moteur supposé.
