# Micro IDE Amstrad

Un atelier de programmation pour écrire du **Locomotive BASIC**, le tester dans un **Amstrad CPC émulé**, travailler avec une **IA et ses propres documents**, puis partager une **disquette DSK utilisable hors de l'IDE**.

**État au 3 octobre 2026 : prototype technique J0, version 0.3.** Le dépôt contient les spécifications, le corpus BASIC, un codec DSK DATA testé, un wrapper d'émulation C/WASM et un banc local. L'IDE Electron et l'agent IA restent les jalons suivants. La qualification CPC attend les ROM OS/BASIC/AMSDOS et les essais dans un émulateur indépendant ; aucun boot BASIC ou résultat matériel n'est revendiqué.

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

Commencer par le [sommaire du dossier](docs/README.md), puis le [cadrage produit](docs/specifications/00-cadrage-produit.md), le [modèle métier](docs/specifications/03-domaines-ddd.md) et l'[architecture](docs/specifications/04-architecture-technique.md).

Les [décisions d'architecture](docs/adr/README.md) expliquent les arbitrages. La [feuille de route](docs/specifications/12-feuille-de-route.md) définit les critères de sortie. **J0 est implémenté partiellement et reste en HOLD** avant J1 : consulter le [rapport réel](docs/implementation/j0-report.md) et le [guide du banc local](tools/j0-harness/README.md).

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
