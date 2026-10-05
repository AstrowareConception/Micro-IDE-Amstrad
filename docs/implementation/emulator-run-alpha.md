# Exécuter dans le CPC — alpha 0.24

## Lancement utilisateur

Le bouton **Exécuter · F5** est dans la barre principale. Il existe aussi dans BASIC et la palette. Il construit et monte un DSK à partir des buffers courants, y compris ceux non enregistrés, puis ouvre l’écran CPC 6128 intégré. Aucun export manuel ni logiciel externe à lancer ; aucune sauvegarde automatique.

Configurer une fois les trois ROM locales dans **ROM du CPC 6128** : OS 6128, BASIC 1.1 et AMSDOS, fichiers séparés de 16 384 octets. Si une ROM manque ou est corrompue, Exécuter explique le blocage et **Configurer les ROM** ramène au panneau d’import. Le produit n’inclut pas de ROM et n’en télécharge aucune automatiquement. Un fichier de bonne taille n’est pas nécessairement une ROM du bon rôle.

Jeu anglais de référence reconnu : le vrai écran de démarrage Ready déclenche automatiquement `RUN"<entrée>"`. Autre jeu : attendre visuellement Ready puis cliquer **Ready est visible : lancer le programme**. Ce bouton confirme une observation humaine, pas une reconnaissance automatique. Les erreurs BASIC/AMSDOS et les résultats apparaissent dans l’écran CPC ; la mention « commande envoyée » ne prétend pas que le programme a réussi.

Pour un listing isolé, l’entrée est MAIN.BAS. Pour un projet, l’entrée configurée est lancée et toutes les sources figurent sur le disque. Les autres fichiers sont des programmes séparés, accessibles avec les commandes BASIC adéquates ; aucune liaison ou concaténation implicite. Un buffer invalide/non encodable, un snapshot incomplet ou un dépassement du disque bloque la construction avant démarrage.

## Contrôles de session

Cliquer l’écran pour utiliser le clavier : caractères ASCII, Entrée, ESC, suppression et flèches. **Pause CPC/Reprendre**, **Interrompre BASIC (ESC)**, **Activer/Couper le son CPC**, **Exporter la disquette de session**, **Arrêter et fermer**. Perte de focus de l’écran relâche les touches ; perte de focus fenêtre ou masquage met la machine en pause. Audio muet au départ, activation par geste utilisateur. Audio audible et mapping matriciel complet restent à qualifier.

F5 relance une machine propre depuis les dernières modifications ; la session précédente est détruite. Exporter auparavant ses écritures utiles : le disque de session est distinct du DSK construit et des sources. Modifier le code ne modifie pas le programme déjà chargé ; relancer. Une saisie de commande interrompue par pause/perte de focus peut nécessiter F5. L’écran reste dans l’atelier et le code peut être édité pendant l’exécution.

L’export desktop utilise le dialogue natif puis une écriture atomique : annulation sans écriture, destination hors du projet, listing ouvert protégé et session projet revalidée. La prévisualisation navigateur utilise un téléchargement. Une réponse d’export arrivée après fermeture ou relance ne modifie pas le panneau suivant.

## Préparer le build desktop

Node 24.12+ et dépendances npm figées. Le moteur est compilé depuis les headers verrouillés ; aucun binaire téléchargé à l’insu du build :

```bash
npm ci
npm run chips:fetch
# Installer et activer emsdk 4.0.15 (commit 389a68bc35dcff7ebae4614e1615099dafda00d1).
EMCC=/chemin/emsdk/upstream/emscripten/emcc npm run build:wasm
npm run build:desktop
npm start
```

Le build copie cpc.mjs/cpc.wasm et leurs notices dans le renderer. Une absence de moteur échoue explicitement. Les artefacts CI `cpceleste-desktop-alpha` contiennent dist/package/lock/licenses : après extraction, `npm ci` puis `npm start` permettent de lancer le build sans recompiler WASM. C’est une alpha Node/Electron, pas encore un installateur autonome signé.

## Provenance et qualification

Cœur chips 9e88298ce56319953ac7a43213a1120359f7a3a6, Emscripten 4.0.15. Jeu de recette externe : floooh/chips-test 3785836e76c43922f78a50e1f8adfed259ab9672, examples/roms/cpc6128_*.bin. Aucun original ROM n’est présent dans ce dépôt ni dans les captures/rapports/archives produits.

| Rôle | SHA-256 de référence |
| --- | --- |
| OS | ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf |
| BASIC | 58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977 |
| AMSDOS | ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d |

Signature Ready des 108 premières lignes indexées : 463daf9b810f7bc36fb0c570a970269051bd023c91c6db7935ea21c0add3b607. La recette firmware compare cette signature puis vérifie réellement le chargement disque et POKE &8000,165. La recette UI compare les pixels exacts de PRINT, pas une simple présence de framebuffer. Elle vérifie absence ROM, F5 dirty, pause/reprise, export des octets de session et relance ; Electron ajoute point d’entrée multifichier, sources inchangées et frontières IPC/protocole.

Commandes de recette avec les ROM fournies explicitement hors dépôt :

```bash
CPC_TEST_ROM_DIR=/chemin/roms node tests/firmware-runtime.mjs
CPC_TEST_ROM_DIR=/chemin/roms CPC_UI_MODE=browser node tests/emulator-ui-smoke.mjs
CPC_TEST_ROM_DIR=/chemin/roms xvfb-run -a npm run test:emulator
```

157 tests Node, tests natifs ASan/UBSan, transport WASM et navigateur ; recette Electron/captures attestées dans la PR. Linux natif et navigateur ont effectivement affiché BASIC 1.1 puis exécuté RUN depuis DSK avec le jeu ci-dessus. La qualification globale demeure ouverte : OPENOUT/export/relecture indépendante dans Caprice32, son audible, timings, mapping complet, modes/firmwares/langues supplémentaires, Windows/macOS et matériel. Aucun résultat de ces essais non exécutés n’est inféré du succès de PRINT/POKE.

Source des ROM de référence pour essais : [chips-test](https://github.com/floooh/chips-test/tree/3785836e76c43922f78a50e1f8adfed259ab9672/examples/roms). Le [texte historique de Cliff Lawson](https://www.freetimeweb.nl/home/computer/alt/lawsons-amstrad-computer_site/web.ukonline.co.uk/cliff.lawson/cpchomec.htm) distingue les copyrights Amstrad/Locomotive ; aucune licence générale de ROM n’est déduite de celle du moteur. Le produit conserve les imports locaux. [ADR 0029](../adr/0029-executer-buffers-cpc-integre.md).
