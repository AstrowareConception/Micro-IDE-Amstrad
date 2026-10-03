# Sources, provenance et vérifications

Consultation initiale : **2026-10-03**. Les références techniques externes ont été confrontées aux fichiers fournis. Ce dossier contient une synthèse originale et des liens. Les trois fichiers fournis sont aussi conservés dans le corpus documentaire local ; ils gardent leurs attributions et conditions. Aucun scan de manuel supplémentaire ni ROM tiers n’est inclus.

## Fichiers fournis au lancement

| Nom original | Contenu et usage | Taille | SHA-256 |
| --- | --- | --- | --- |
| Locomotive-BASIC.txt | Présentation historique en français ; repère de contexte, pas spécification normative | 6 525 octets | `cc8bcb6c38e5f841cacb66e9dee66d3644cee114bf73bf6f38146b08896ce9ce` |
| Références.txt | Liste abrégée d'instructions ; base d'inventaire avec corrections à qualifier | 10 291 octets | `4515b3cda39f3e4a1280bcaa750ecb73729e0e6859532d0623622dfd275ab5ec` |
| Locomotive BASIC - CPCWiki.html | Page sauvegardée présentant le langage et ses liens techniques | 365 046 octets | `61169d8794397dcdeb5840e3a49cc15a304c780e9f603528b9f9a5165c96e203` |

Les empreintes identifient exactement les pièces étudiées. Les fichiers sont identifiés dans le [catalogue local](../../knowledge/locomotive-basic/catalog.json) ; les chemins temporaires de l'environnement de travail ne sont pas inscrits dans les contrats du produit. Les fautes et simplifications du corpus ne sont pas importées telles quelles dans la grammaire ou les fiches d'aide.

## Références primaires et usages

| Référence | Autorité ou nature | Utilisation dans la conception |
| --- | --- | --- |
| [Technical information about Locomotive BASIC](https://cpctech.cpcwiki.de/docs/bastech.html) | Documentation technique de format | Versions, lignes et encodage tokenisé ; qualification ROM encore nécessaire |
| [DSK standard](https://cpctech.cpcwiki.de/docs/dsk.html) | Définition du conteneur | Offsets, en-têtes et tailles de piste |
| [Extended DSK](https://cpctech.cpcwiki.de/docs/extdsk.html) | Définition du conteneur étendu | Tailles variables et limites d'import |
| [SOFT968, chapitre AMSDOS](https://github.com/Bread80/Soft968-Amstrad-Firmware-Manual/blob/main/md/9-AMSDOS.md) | Transcription du manuel Amstrad d'origine | Formats DATA, catalogue, conventions de header ; erreurs de transcription possibles |
| [floooh/chips](https://github.com/floooh/chips) | Code et documentation de l'auteur | Cœur candidat embarquable |
| [cpc.h au commit inspecté](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/systems/cpc.h) | API et implémentation CPC | Fonctions disponibles, profils, ROM, limites et snapshots |
| [fdd_cpc.h au commit inspecté](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/chips/fdd_cpc.h) | Parser DSK du cœur | Signatures standard/Extended et validation requise autour du parser |
| [fdd.h au commit inspecté](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/chips/fdd.h) | Structures et opérations disque | Copie mutable, limites de géométrie et extraction des écritures |
| [chips-test](https://github.com/floooh/chips-test) | Exemples de l'auteur du cœur | Repères de harness ; pas de reprise implicite des ROM ou exemples |
| [CPCBasicTS](https://github.com/benchmarko/CPCBasicTS) et [licence](https://github.com/benchmarko/CPCBasicTS/blob/master/LICENSE) | Code primaire, MIT | Référence lexer/parser/tokenisation ; exécution JS et extensions à isoler |
| [Caprice32](https://github.com/ColinPitrat/caprice32) | Code et documentation primaire, GPLv2 | Oracle indépendant proposé ; pas dépendance embarquée à ce stade |
| [Electron security](https://www.electronjs.org/docs/latest/tutorial/security) | Documentation officielle | Isolation renderer, IPC, navigation et CSP |
| [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) | Documentation officielle | Secret système et fallback de session si backend insuffisant |
| [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process) | Documentation officielle | Option future de séparation, sans garantie de sandbox automatique |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | Code et documentation Microsoft | Providers, modèles, ESM ; pas un hôte général d'extensions VS Code |
| [Emscripten et l'interface JS/C](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html) | Documentation officielle | Wrapper WASM, buffers et gestion mémoire |
| [PDF.js](https://mozilla.github.io/pdf.js/getting_started/) | Documentation Mozilla | Extraction et rendu locaux isolés |
| [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs) | Documentation officielle | Capacités de pièces jointes à revérifier lors de l'intégration |
| [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) | Documentation officielle | Appels d’outils et échange de résultats pilotés par le runner local |
| [OpenAI images and vision](https://developers.openai.com/api/docs/guides/images-vision) | Documentation officielle | Entrées visuelles et capacités de modèle |
| [Electron Forge lifecycle](https://www.electronforge.io/core-concepts/build-lifecycle) | Documentation officielle | Paquets, builds et plateformes |
| [python-jsonschema v4.26.0](https://github.com/python-jsonschema/jsonschema/releases/tag/v4.26.0) | Projet officiel | Validation documentaire JSON Schema, version figée |

Le commit `chips` candidat est `9e88298ce56319953ac7a43213a1120359f7a3a6`, daté du 26 septembre 2026. Les fichiers courants ont été inspectés avec cette référence de HEAD ; le futur harness doit vérifier/fixer le commit effectivement compilé, ses patchs et son outillage. Les liens non figés décrivent l'état des sources consultées, pas un verrou de dépendance applicative.

## Résultats de l'étude documentaire

- Le BASIC CPC est interprété par firmware ; une préparation de média ne nécessite pas un compilateur Z80.
- Le candidat d'émulation fournit des API CPC et disque, avec des limites concrètes ; ses capacités réelles restent à qualifier dans l'intégration.
- Les conventions de fichiers ASCII et binaires doivent rester distinctes.
- Les capacités de modèle IA, API, plateformes et bibliothèques évoluent ; elles seront recontrôlées au jalon concerné.

Les choix de produit sont des décisions de conception fondées sur ces informations ; ils ne sont pas des caractéristiques promises par les auteurs des bibliothèques. Les hypothèses conditionnelles sont listées dans le [registre d'arbitrages](../specifications/13-risques-arbitrages.md).

## Licences et dépendances futures

Les contributions originales du dépôt sont MIT. `chips` déclare zlib/libpng dans ses en-têtes ; CPCBasicTS déclare MIT ; Caprice32 GPLv2. Leur intégration effective devra conserver les notices et respecter les conditions applicables. Les modules applicatifs non encore installés ne sont pas listés comme composants redistribués. Un inventaire de dépendances et licences sera généré à partir du lockfile au jalon J1, puis du paquet final à J6.

Les droits du firmware sont étudiés séparément. Aucun droit de redistribution des ROM n'est déduit d'un commentaire de forum, de la licence d'un émulateur ou de la disponibilité d'un fichier sur Internet. Le choix initial d'import utilisateur permet de développer le produit sans prétendre résoudre cette question par une affirmation non vérifiée.
