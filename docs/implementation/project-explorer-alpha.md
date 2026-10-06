# Explorateur du projet — alpha 0.30

## Utilisation

Ouvrir un projet puis Projet / Ctrl Maj E. L’arborescence présente les fichiers du dossier réel ; ouvrir un dossier pour charger ses enfants. Le champ filtre les noms et chemins des dossiers déjà chargés. **Actualiser les fichiers** recharge la racine et replie les dossiers, en conservant tous les buffers BASIC.

Une source marquée **BASIC** rejoint son onglet et conserve brouillon, undo et curseur. **Actions** et le clic droit retrouvent ses commandes existantes. Le nom documentaire original est affiché pour les pièces jointes importées ; leur sélection rejoint le lecteur TXT/MD, image ou PDF texte, avec vérification de l’original. Le fichier manifeste et les autres textes UTF-8 disposent d’un aperçu en lecture seule, fermable par Échap, avec retour du focus. Aucune ouverture n’ajoute une source au DSK et aucune lecture ordinaire n’est transmise à l’IA.

Les noms privés commençant par un point et les dossiers node_modules/dist/out/build/coverage/__pycache__ sont masqués par défaut. **Privés et générés** les montre sur cette session. Les liens sont signalés et leur contenu n’est pas parcouru.

## Contrats et bornes

`ExplorerPort.list(sessionId, directory, showHidden)` renvoie une liste consultative avec chemins relatifs, rôle, ID source/document si déclaré, taille, révision et indicateur de complétude. `preview(sessionId, path, revision)` contrôle le manifeste, le trajet et la révision puis lit un fichier ordinaire de manière bornée. Les sources/documents doivent utiliser leur vue dédiée. Ces routes utilisent les mêmes contrôles d’émetteur/session/activité que les autres opérations du projet. Le domaine ne connaît ni disque ni Electron ; [ADR 0037](../adr/0037-explorateur-projet-lecture-seule.md).

Un dossier retourne au maximum 500 entrées après examen de 2 000 éléments. Si la limite est atteinte, la liste est annoncée partielle ; le sous-ensemble dépend de l’énumération du système. L’UI conserve au maximum 32 dossiers et ouvre 16 niveaux, puis demande une actualisation. Texte limité à 64 Kio : au-delà, ou pour binaire/encodage inconnu, seules les métadonnées sont affichées. L’aperçu n’est pas un rendu HTML/PDF/image universel ; les documents importés gardent leur lecteur spécialisé. Révision périmée : actualiser avant lecture. Aucun nouveau droit de mutation.

## Vérification et état

208 tests Node passent, dont cinq recettes disque de l’explorateur : rôles, manifeste inchangé, fichiers non déclarés, privé/généré, liens, chemins invalides, tailles/encodages, versions périmées et liste partielle. TypeScript strict et builds renderer/main sont vérifiés localement. La recette navigateur complète, dont `project-explorer-smoke.mjs`, passe avec navigation/brouillon/undo, texte inerte, focus, visibilité, documents et erreurs ; aucune erreur navigateur. Le contrôle documentaire valide 100 Markdown, 16 JSON, quatre schémas et quatre exemples.

La recette Electron ajoutée dans `desktop-smoke.mjs` et la recette Windows s’exécutent dans les workflows CI de la [PR #32](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/32). Electron/Xvfb n’est pas disponible dans l’environnement local. La description de PR consigne les résultats et liens vers les preuves finales ; un scénario préparé ne vaut pas une recette réussie. Les contrôles CI de la PR #31 concernent son propre commit 0.29.

## Suite

Lot 1 et IDE-002/003/004 restent partiels. Ajouter ensuite les mutations humaines durables et les onglets de prévisualisation, édition des fichiers ordinaires, badges Git, exclusions configurables et restauration des vues. Le parser BASIC reste le lot 2. Aucun succès d’exploration ne qualifie une mission créative réelle, l’émulation globale ou la distribution 1.0.

## Reprise après interruption

La branche publiée `feat/project-explorer` part du commit `c876ba1c998d38519a253f9c08f519a85f82ebe1`, dernière version de la PR #31 (`feat/agent-missions-specs`, alpha 0.29). Cette PR précédente reste ouverte et contient les tranches 0.25–0.29 non fusionnées. La PR #32 vers main les inclut également ; aucun merge automatique. Les spécifications 18/19 constituent le cadrage actuel, et la roadmap 17 garde les états partiels. Le fil du 6 octobre a été repris avec vérification de l’état réel du dépôt, sans relancer de mission OpenAI payante.

La publication et l’ouverture de PR ont été explicitement autorisées le 6 octobre. La connexion GitHub a publié le contenu testé, avec contrôle d’égalité de tree SHA. Vérifier la PR #32 et ses workflows/captures avant toute qualification ; le diff ciblé reste exportable avec `git diff c876ba1c998d38519a253f9c08f519a85f82ebe1 HEAD`. Il s’applique à la version de la PR #31, pas au main ancien. Les mutations humaines durables de sources sont le prochain incrément du lot 1.
