# Alpha d'édition desktop 0.4

Date : 2026-10-03. Incrément demandé : continuer le logiciel, ajouter coloration et complétion. [Décision de découplage](../adr/0009-edition-independante.md).

## Parcours disponible

L'application Electron s'ouvre sur un exemple CPC. Elle édite **un seul listing UTF-8**, conserve les lignes vides dans le buffer, signale les changements et propose ouvrir, enregistrer, enregistrer sous et exporter une disquette DATA contenant `MAIN.BAS` ASCII. Les lignes vides sont omises seulement dans cet artefact. La relecture du DSK contrôle la structure, pas l'exécution BASIC.

Monaco fournit coloration, annuler/rétablir, recherche, sélection et raccourcis. Les fournisseurs du projet proposent commandes/fonctions du sous-ensemble, identifiants observés et cibles BASIC ; survol et panneau consultent les fiches. `F12` rejoint une cible littérale connue. Cliquer un diagnostic rejoint sa position physique. Aucune modification automatique globale de casse ou renumérotation.

## Installation et vérification

Node 24.12+ dans la branche 24, environnement graphique Windows ou Linux. macOS n'est pas qualifié par cet incrément. Les dépendances et les binaires de développement sont téléchargés à l'installation ; l'édition et la construction fonctionnent ensuite localement, sans serveur ni connexion IA.

```bash
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run typecheck
npm test
npm run build:desktop
npm start
```

Les composants main, preload, renderer et worker sont construits localement. Il n'y a pas encore d'installateur signé ni d'auto-update. L'application se lance depuis ce dépôt ; Electron Forge et les distributions finales sont reportés, pas remplacés par un Site.

Tests de parcours :

```bash
npx playwright install chromium
npm run test:editor
```

Sur Ubuntu avec Xvfb, l'essai Electron utilise un utilisateur non privilégié et le sandbox activé :

```bash
xvfb-run -a npm run test:desktop
```

Ne pas ajouter `--no-sandbox` pour contourner une restriction de l'hôte. Le workflow `Desktop editor` exécute types, tests unitaires, construction, Chromium et Electron. Les captures sont des preuves de cette application, pas des maquettes.

L'aperçu `npm run dev:editor` utilise un autre adaptateur : lecture via sélecteur navigateur, enregistrement/export par téléchargement. Il n'a ni API disque native ni garantie de sauvegarde dans le fichier ouvert.

## Analyse et couverture

| Fonction | Couverture de cette alpha | Non couvert |
| --- | --- | --- |
| Lexer | Casse, nombres décimaux/hexadécimaux/binaires, suffixes de variables, chaînes, REM/apostrophe, DATA opaque jusqu'au séparateur non cité | Grammaire complète, noms ambigus et toutes les formes compactes |
| Complétion | 48 fiches éditoriales, identifiants observés, numéros locaux après GOTO/GOSUB/THEN/ELSE/RESTORE/RUN | Variantes qualifiées 1.0/1.1, RSX, toutes les signatures, snippets et paramètres contextuels |
| Diagnostics | Numéros 1–65535 croissants, chaîne ouverte, cible littérale absente, ASCII exportable | Types, arité, structures de contrôle, mémoire, toutes les erreurs BASIC |
| Références | Cibles numériques directes et listes ON, ON ERROR GOTO 0 exclu ; textes/commentaires/DATA ignorés | Références calculées, externes, RESUME, renumérotation |
| Fichiers | UTF-8 strict, CRLF normalisé en LF, limite 1 Mio, sauvegarde temporaire + renommage, hash de conflit externe | Projet/manifeste, plusieurs buffers, autosave, reprise après crash, verrouillage interprocessus |

Le nombre de fiches est vérifié par le module et peut évoluer ; les tokens supplémentaires ne possèdent pas tous une fiche. Les contraintes ASCII sont celles du codec actuel, pas une affirmation que le CPC ne connaît que ces caractères. Aucun remplacement de caractères non ASCII n'est effectué : l'export échoue explicitement.

Les fiches sont des résumés éditoriaux du document fourni, avec ID, version de corpus, empreinte SHA-256 et numéro de ligne source. Leur statut est `editorial-subset-not-rom-qualified`. Les tests vérifient ces localisations et le digest. Le corpus original reste inchangé. `INTRS`, coquille du document, n'est pas promu en commande ; GET/PUT ne sont pas importés depuis les mentions historiques. Ce n'est pas la validation complète ACC-30.

## Sécurité et limites de durabilité

Le renderer n'a pas Node, `require`, chemins arbitraires ni shell. Le preload expose quatre opérations spécifiques, pas `ipcRenderer`. Le main valide émetteur/frame, types et volume, possède seul le chemin sélectionné par les dialogs et reconstruit lui-même le DSK depuis le snapshot du listing. Navigation/fenêtres externes et demandes de permissions sont refusées. CSP locale, contexte isolé et sandbox restent actifs. Références suivies : [sécurité Electron](https://www.electronjs.org/docs/latest/tutorial/security), [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc), [sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox).

Un conflit externe connu interdit l'écrasement et demande réouverture ou enregistrement sous. Une course reste possible entre lecture du hash et renommage : il n'y a pas encore de journal transactionnel ni de verrou partagé. La fermeture ordinaire d'un buffer modifié demande confirmation ; un crash peut perdre les modifications non sauvegardées. Les capacités de récupération J1/J6 restent nécessaires.

Les effets React nettoient modèle, éditeur, actions et abonnements. Les callbacks courants passent par une ref pour éviter de recréer Monaco à chaque frappe ; l'analyse affichée utilise une valeur différée. Cela ne remplace pas le benchmark p95 de J6, non mesuré ici.

## Preuves et exigences

Localement : TypeScript strict, 28 tests de domaine/codecs et construction desktop exécutés. Le premier téléchargement automatique de navigateur a échoué ; le miroir officiel Playwright a ensuite fourni Chromium. Le contrôle `agent-browser` a échoué au démarrage de son daemon ; les parcours reproductibles Playwright sont utilisés pour les preuves effectives. Le test Electron local exige un environnement graphique non privilégié ; son résultat doit être lu dans le workflow, pas déduit du build.

Le workflow publie les captures et ses résultats. Cette livraison contribue partiellement à REQ-EDT-001/002/003/005, REQ-KNW-001/002/004/005, ACC-02/03/04/06/30. Elle ne ferme pas ces exigences globales : multi-document, qualification par dialecte, transactions et couverture complète restent ouverts.

## Dépendances directes

| Dépendance | Version | Licence déclarée | Usage |
| --- | --- | --- | --- |
| Electron | 44.5.1 | MIT + notices Chromium et composants embarqués | Runtime desktop main/preload/renderer |
| React / React DOM | 19.3.0 | MIT | Interface locale |
| Monaco Editor | 0.57.0 | MIT | Buffer et services d'éditeur |
| Vite | 8.3.2 | MIT | Build et aperçu renderer |
| @types/react / @types/react-dom | 19.3.0 | MIT | Types du renderer |

Les autres dépendances déjà présentes conservent leurs notices ; le lockfile fixe le graphe transitif. Les notices du runtime doivent accompagner le packaging futur, en particulier `LICENSES.chromium.html`. Le corpus n'est pas relicencié MIT par le projet.

## Suite

Projet en dossier et manifeste, multi-document, transactions/reprise, corpus et parser enrichis. Qualification J0 avec firmware autorisé, puis boucle d'exécution réelle. Ensuite ressources et agent IA à outils, sans remplacer les mutations réversibles prévues par un simple chat.
