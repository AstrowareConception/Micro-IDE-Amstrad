# Micro IDE Amstrad

Un atelier de programmation pour écrire du **Locomotive BASIC**, le tester dans un **Amstrad CPC émulé**, travailler avec une **IA et ses propres documents**, puis partager une **disquette DSK utilisable hors de l'IDE**.

**État au 3 octobre 2026 : conception initiale, version 0.1 des spécifications.** Ce dépôt contient le dossier de conception, des contrats de données et un exemple BASIC. L'application et le moteur d'émulation ne sont pas encore implémentés. Aucun résultat de compatibilité matérielle n'est revendiqué.

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
| IA | Fournisseurs interchangeables ; premier adaptateur OpenAI, clé personnelle, aucune obligation pour programmer |
| Stockage | Projet en dossier ouvert, fichiers texte et manifeste JSON versionné ; aucun serveur imposé |

La préparation d'un programme BASIC n'est pas une compilation Z80. L'IDE analyse, encode, construit le support et pilote l'émulateur. Une véritable chaîne assembleur pourra être ajoutée ultérieurement.

## Lire et reprendre le projet

Commencer par le [sommaire du dossier](docs/README.md), puis le [cadrage produit](docs/specifications/00-cadrage-produit.md), le [modèle métier](docs/specifications/03-domaines-ddd.md) et l'[architecture](docs/specifications/04-architecture-technique.md).

Les [décisions d'architecture](docs/adr/README.md) expliquent les arbitrages. La [feuille de route](docs/specifications/12-feuille-de-route.md) définit des incréments indépendants avec critères de sortie. Le premier travail d'implémentation sera **J0 : prouver le trajet BASIC → DSK → CPC 6128**, avant de construire l'IDE.

Pour vérifier le dossier avec Python 3.12 ou supérieur :

```bash
python scripts/check_specs.py
```

La validation complète des contrats nécessite aussi le paquet `jsonschema` :

```bash
python -m pip install -r scripts/requirements-docs.txt
python scripts/check_specs.py --schemas
```

Ces commandes vérifient la documentation et les exemples ; elles ne testent pas encore une application. Le workflow GitHub Actions `Specifications` automatise cette vérification.

## Principes de réalisation

- Le projet et le code restent lisibles, portables et utilisables sans IA.
- Le DSK est un véritable artefact CPC, distinct du projet de travail.
- Les modifications proposées par l'IA sont présentées en diff et appliquées par l'utilisateur.
- La compatibilité est qualifiée par profil de machine et jeux d'essai.
- Les ROM sont des dépendances distinctes ; aucun firmware tiers n'est inclus dans ce dépôt.
- Chaque incrément fait évoluer ensemble code, spécifications et preuves de recette.

Les fichiers de référence fournis au lancement ont été inventoriés dans [le dossier de sources](docs/reference/sources.md). Les contributions propres au projet sont sous [licence MIT](LICENSE) ; les dépendances et les contenus tiers conservent leurs conditions respectives.
