# ADR 0018 — Création Git et indexation sélective

Date : 2026-10-04. Acceptée pour l'alpha 0.13. Complète [0015](0015-git-natif-et-publication-explicite.md) et [0017](0017-git-inspection-conservatrice.md). Ne qualifie ni commit ni réseau.

## Décision

Livrer création de dépôt `main`, stage/unstage d'un fichier et préconditions avant identité/commit/historique. Domaine/port TypeScript purs ; adaptateur Git natif existant, sans nouvelle dépendance. L'IPC n'accepte que session, plan/snapshot et ID opaque de changement, action enum. Un dialogue main confirme chaque mutation humaine. Aucun outil Git pour l'agent, aucun `add --all`, aucune sauvegarde implicite.

Init produit un aperçu avec nom de dossier, branche, version et texte exact des exclusions. La confirmation native montre le chemin absolu de la racine déjà sélectionnée ; aucun chemin hôte fourni par le renderer. Refuser dépôt existant/parent/bare, `.git` lié et `.gitignore` existant, même légitime : conserver ce fichier vaut mieux que le réécrire dans cette tranche. Avant création, vérifier absence et empreintes du projet contre le plan. `.git` est revendiqué par mkdir exclusif, `.gitignore` créé `wx`, Git utilise un template applicatif vide, SHA-1 et refs files explicitement. Ni hook/template personnel copié, ni fichier indexé, ni commit créé.

Un marqueur `.git/microide-init-pending` signale l'initialisation incomplète et bloque inspection/reprise. En cas d'échec après revendication, conserver `.git` et `.gitignore` pour examen, jamais supprimer automatiquement un dépôt. La réussite retire le seul marqueur et le dossier template vide détenus par cette opération. Une erreur après création peut laisser un dépôt utilisable mais un résultat non confirmé : inspecter avant reprise. Pas de rollback/crash recovery complet annoncé.

## Préconditions et publication de l'index

Chaque statut qualifié conserve côté hôte une signature SHA-256 : porcelain brut (branche/HEAD inclus), index, config locale, contenu des sources déclarées/manifeste/.gitignore et identité de racine. Deux lectures encadrent le hash ; un changement détecté refuse le snapshot. Un fichier non qualifié laisse le statut en lecture seule, sans token d'indexation. L'ID de snapshot et les IDs de changements sont invalidés par actualisation/mutation ; une répétition est refusée.

Stage/unstage exige snapshot courant, un seul chemin autorisé, fichier UTF-8 borné ou suppression enregistrée. Conflits, renommages, documents, ROM et autres chemins privés sont refusés, même déjà suivis. `.gitignore` rejoint les fichiers explicitement versionnables. Les brouillons bloquent les mutations UI et main. Une mission agent/opération disque en cours ou fermeture pendant opération est bloquée par le coordinateur existant.

Acquérir `index.lock` en création exclusive ; ne jamais supprimer un verrou préexistant. Copier l'index dans une destination opaque sous `.git` (ou utiliser une destination absente avant premier commit). Git reçoit `GIT_INDEX_FILE` contrôlé uniquement côté hôte. Stage utilise un pathspec littéral ; unstage utilise reset **par chemin**, ou force-remove **de l'index seul** avant premier commit. Aucun reset hard, aucune source effacée ni remplacée.

Les filtres/commandes/configs non qualifiés restent refusés par 0017 ; ajouter `core.hooksPath` neutralisé à chaque commande, notamment contre `post-index-change`, et template vide pour init. Revalider configuration et signature avant préparation, après Git et avant publication. Écrire/synchroniser l'index candidat dans le verrou détenu, vérifier son identité puis rename atomique vers index. Les autres entrées indexées et HEAD ne sont pas réécrits par ces cas d'usage. Nettoyer uniquement le fichier temporaire opaque et le verrou encore détenu ; pas de nettoyage général des locks.

## Limites

Git à droits hôte, pas sandbox OS. L'index.lock coordonne les clients respectant Git, pas un processus hostile. HEAD/config/fichiers peuvent encore changer dans l'intervalle final malgré les contrôles ; ce n'est pas un verrou global transactionnel. Un refus après `git add` isolé peut laisser des blobs sans référence dans `.git/objects`, sans index publié. Un timeout peut laisser un lock temporaire opaque : ne pas le supprimer aveuglément. Si publication réussit mais refresh échoue, signaler index modifié et imposer inspection, sans rejouer automatiquement.

Limites conservées : 1 Mio par fichier/commande/index, 10 s par commande, 2 000 changements et parcours métadonnées borné. Linux Git 2.51.1 local et version CI consignée ; comportement rename/fsync, helpers/protocoles et packaging Windows/macOS restent à qualifier. Ignorer un document ne rend pas le manifeste partagé portable et ne retire pas un contenu déjà commis : une future publication devra vérifier les pièces manquantes et secrets dans les commits à envoyer. JG-A/ACC-31 ne sont pas clos.
