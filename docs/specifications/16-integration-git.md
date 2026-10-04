# 16 — Git intégré et hébergements distants

Date : 2026-10-04. Demande produit : travailler avec Git depuis l'IDE comme dans un IDE contemporain. **Statut : conception acceptée, fonctions non implémentées dans l'alpha 0.10.** [ADR 0015](../adr/0015-git-natif-et-publication-explicite.md). Cette extension ne remplace ni la tranche PDF en cours de préparation ni la qualification moteur J0.

## Objectif et périmètre

L'utilisateur DOIT pouvoir créer un dépôt local, cloner un dépôt, ouvrir un projet déjà versionné, associer plusieurs remotes, examiner et sélectionner ses changements, créer un commit, gérer ses branches et synchroniser avec un remote. GitHub est un hébergement pris en charge, pas le format du projet ni un passage obligé. GitLab, Bitbucket et un serveur Git privé utilisent les mêmes cas d'usage Git. Aucun compte du produit n'est requis.

« Git intégré » signifie commandes et vues dans l'IDE ; il ne signifie pas réimplémenter chaque commande Git ni exposer un terminal arbitraire à l'agent. Le cœur du parcours est requis au MVP via le jalon transversal JG. Les opérations avancées ont une deuxième tranche obligatoire avant 1.0 ; les fonctions propres à GitHub sont une extension distincte.

| Tranche | Fonctions attendues | Hors de cette tranche |
| --- | --- | --- |
| JG-A, local | Détection/version Git, init, statut, diff working tree/index, stage/unstage par fichier, identité locale, commit, historique paginé | Stage par fragment, shell libre |
| JG-B, synchronisation | Clone, ajout/modification/retrait de remote, branches locales/distantes, création/switch/renommage/suppression sûre, upstream, fetch, pull fast-forward, push explicite | Force-push, intégration automatique d'histoires divergentes |
| JG-C, conflits et historique | Merge, rebase local guidé, continue/abort, résolution à trois versions, stash explicite, tags, revert, cherry-pick, blame | Réécriture silencieuse d'une histoire publiée |
| Extension GitHub | Création d'un dépôt privé/public, publication initiale, liens web ; PR et statut CI ensuite | Obligatoire pour utiliser Git ; inclusion automatique de l'API GitHub dans le MVP |

## Architecture et vocabulaire

Le contexte **VersionControl** possède `RepositorySession`, `RepositorySnapshot`, `GitBranch`, `GitRemote`, `GitChange`, `GitOperation` et `PublicationRequest`. Workspace reste propriétaire du manifeste et des buffers. Une révision de projet, un checkpoint IA, un commit et un artefact DSK sont quatre objets distincts.

Le port applicatif `VersionControlPort` fournit des cas d'usage typés : `inspect`, `init`, `clone`, `status`, `diff`, `stage`, `unstage`, `commit`, `history`, `branches`, `createBranch`, `switchBranch`, `renameBranch`, `deleteBranch`, `remotes`, `configureRemote`, `fetch`, `pullFastForward` et `push`. Les cas avancés viennent en JG-C ; aucune méthode `exec(command: string)` n'est exposée. Domaine et DTO ne dépendent ni de Node ni d'Electron ni d'un hébergeur.

L'adaptateur lance **Git natif**, asynchrone côté hôte, via un exécutable identifié et un tableau d'arguments, sans shell. La CLI est retenue plutôt qu'une bibliothèque JavaScript incomplète ou une réimplémentation de Git. `git status --porcelain=v2 -z --branch` fournit une sortie destinée au parsing ; les chemins NUL sont conservés et ne sont pas découpés sur espaces ou lignes. Diff désactive pager, external diff et textconv. Les messages de commit passent via entrée standard/fichier applicatif contrôlé, jamais par interpolation de shell.

Première livraison : Git installé par l'utilisateur, détection de son chemin/version et guide d'installation, sans téléchargement automatique. La version exacte, son maintien sécurité et les hôtes testés sont consignés dans le rapport JG-A ; aucun support de toutes versions n'est promis. Un Git embarqué nécessiterait un audit de distribution/licence GPL-2.0 et une ADR distincte. L'absence de Git n'empêche pas d'éditer, construire ou utiliser l'IA BASIC. Node reste embarqué dans l'application distribuée.

L'IPC ne reçoit qu'un identifiant de session de dépôt opaque et des paramètres validés. Ni `.git`, ni le chemin de l'exécutable, ni les credentials ne sont accessibles au renderer ou à l'agent. Un projet dans un dépôt parent est détecté mais DOIT demander un choix de racine explicite ; l'IDE n'initialise pas accidentellement un deuxième dépôt. Les changements hors projet sont signalés ; leur lecture/staging nécessite le périmètre de dépôt choisi, jamais un élargissement implicite du scope IA.

Worktrees liés, dépôt bare, sous-modules et Git LFS sont détectés : lecture limitée ou refus explicite tant que leur prise en charge n'est pas qualifiée. Un fichier `.git` de worktree n'est pas traité comme un dossier ordinaire et son chemin externe n'est pas suivi sans validation. Un projet non conforme après clone reste consultable dans la vue Git, sans permettre une construction BASIC trompeuse.

## Parcours et interface

La barre d'état montre branche, dirty state du dépôt, opérations en cours et divergence connue. **Contrôle de version** contient changements non indexés/indexés, diff, message de commit et liste exacte des fichiers sélectionnés. Sauvegarde de buffer et stage sont deux actions distinctes : le diff Git compare des octets sur disque ; un bandeau indique les brouillons non sauvegardés. Pas de sauvegarde automatique ni de `add --all` implicite.

**Créer dépôt** prévisualise racine et exclusions, refuse un dépôt existant, crée la branche initiale `main` et propose un premier commit sans le réaliser automatiquement. L'identité auteur est consultable ; configuration locale au dépôt, sans modifier la configuration globale. Une signature requise mais indisponible produit un blocage expliqué, pas un commit non signé silencieux.

**Cloner** demande remote et dossier vide, affiche progression/annulation puis ouvre un manifeste choisi. Le clone n'écrase aucun dossier. Un clone interrompu conserve un dossier incomplet identifié ; sa suppression requiert une action explicite sur la cible exacte. Les URLs avec token/mot de passe intégré sont refusées.

**Branches** liste locales/distantes, HEAD détaché et dépôt sans premier commit. Créer peut simplement créer une référence ou créer et basculer, au choix. Supprimer refuse la branche active et, par défaut, une branche non fusionnée. Switch, merge, rebase, stash apply/pop et pull sont bloqués tant qu'une mission mutative, une sauvegarde ou des buffers dirty sont actifs. L'utilisateur sauvegarde ou arbitre ses brouillons avant de continuer ; aucun stash caché n'est créé.

**Synchroniser** sépare fetch, pull et push. Les compteurs ahead/behind sont datés du dernier fetch et ne prétendent pas connaître un remote hors ligne. Pull utilise une stratégie fast-forward explicite, sans autostash ni rebase automatique ; une divergence ouvre un choix merge/rebase en JG-C. Push affiche remote, URL expurgée, branche locale/distante, commits et fichiers publiés, puis demande confirmation. Le premier push propose l'upstream. Un rejet non-fast-forward reste un rejet, jamais un retry forcé.

## Cohérence avec le manifeste et les sources

Le manifeste contient les SHA-256 des sources et documents. Git peut produire une fusion textuelle sans conflit tout en rendant ces empreintes incohérentes : **merge réussi ne signifie pas projet valide**. Après toute opération modifiant le working tree, suspendre l'écriture Workspace, revalider le projet et rouvrir une nouvelle session cohérente. Les résultats d'analyses et outils de l'ancienne session sont invalidés.

Si le manifeste ne concorde plus avec les sources, proposer une réparation locale avec diff : calculer les empreintes à partir des fichiers examinés, conserver IDs/point d'entrée/noms CPC et refuser collisions/chemins sortants. Cette réparation crée une nouvelle modification à sauvegarder/committer ; elle ne modifie jamais le commit reçu. Aucune réparation automatique d'un document de contexte altéré, aucune disparition silencieuse de source et aucune fusion sémantique BASIC non qualifiée. Pour un conflit de lignes BASIC, afficher les trois textes puis rejouer les diagnostics et le build après résolution.

Un `RepositorySnapshot` capture HEAD (ou absence), empreinte de l'index, état pertinent du working tree et génération de session. Chaque mutation vérifie ses préconditions juste avant exécution et rafraîchit après ; un autre client Git peut agir malgré la sérialisation interne. Une erreur `index.lock` est signalée, jamais « réparée » par suppression automatique. Les locks Git ne sont pas un journal de récupération de l'IDE. Une annulation/fermeture ne garantit pas le rollback d'une commande déjà commencée ; inspecter le résultat réel et proposer récupération/reflog lorsque pertinent.

## Réseau, identité et confiance

Les remotes sont saisis/choisis par l'utilisateur. JG-B prend en charge HTTPS et SSH ; les remotes locaux sont autorisés seulement sur dossier explicitement choisi pour import/tests. Refuser par défaut `ext::`, les remote helpers arbitraires et les protocoles non qualifiés ; pas de suivi automatique d'un sous-module. Vérifier les URLs push et fetch distinctes, les destinations résultant des règles `insteadOf`/`pushInsteadOf` et refspecs : une réécriture non validée bloque avant accès réseau. Ne jamais désactiver TLS ni accepter silencieusement une nouvelle clé SSH.

HTTPS utilise un gestionnaire de credentials système approuvé (par exemple Git Credential Manager) ; SSH utilise l'agent existant et ses clés, sans copie/export par l'IDE. Une demande interactive manquante ou une erreur d'authentification ouvre une explication/un flux natif approprié, sans exposer le secret. Clé OpenAI et credentials Git sont séparés. La création via API GitHub exige une autorisation GitHub distincte et des scopes minimaux ; un login Git n'accorde pas automatiquement ce droit.

Git peut exécuter hooks, filtres, helpers, éditeurs, outils de signature et commandes SSH configurés. **Lancer sans shell n'en fait pas un sandbox.** Avant mutation, clone ou réseau, vérifier confiance et configurations effectives, y compris includes globaux/locaux et attributs. Un dépôt non approuvé reste en lecture sûre : pas de hooks/filtres/external diff/textconv/fsmonitor ni accès réseau automatique. L'adaptateur doit définir et tester une politique d'exécution de ces extensions ; refuser une capacité non sécurisée vaut mieux que supposer que `core.hooksPath` protège tout. Les composants système approuvés sont des dépendances à droits hôte et cette confiance est distincte des permissions du modèle.

Une seule opération mutative par dépôt, coordonnée avec le verrou Workspace. Sorties bornées, historique paginé, timeout et annulation avec inspection finale ; pas de kill prétendu transactionnel. Seuils initiaux à tester : 10 Mio de statut/diff, 200 commits/page, 30 s pour une opération locale et 5 min pour le réseau ; dépassement visible, limites ajustables dans une future recette, sans troncature interprétée comme liste complète. Les processus auxiliaires doivent également s'arrêter de façon qualifiée sur Windows/Linux/macOS.

## Confidentialité, IA et publication

Le `.gitignore` proposé exclut outputs/caches/checkpoints/conversations/logs privés, configuration locale, `.env` et ROM. `documents/` est privé par défaut ; l'utilisateur peut sélectionner des copies dont il souhaite versionner le contenu et confirme ce choix. Les sources, manifeste et recettes sont versionnables. Un document ignoré ne sera pas disponible à un collaborateur : avant push, montrer les pièces manquantes et choisir exclusion du manifeste partagé ou inclusion volontaire des originaux avec droits vérifiés. Aucun push ne prétend livrer un projet portable avec des pièces référencées absentes.

`.gitignore` ne retire pas un fichier déjà suivi ni un secret de l'historique. Avant publication, vérifier l'ensemble des nouveaux commits à envoyer, pas seulement le diff courant ; détecter au minimum chemins sensibles, ROM connues et motifs de secrets. Ce contrôle est une défense supplémentaire, pas une certification d'absence de secrets. Un contenu sensible détecté bloque et ouvre une procédure explicite de correction/rotation ; aucune réécriture d'historique partagée automatique. Export DSK et push du projet restent des livraisons distinctes.

L'agent commence sans outil Git. Une tranche ultérieure peut ajouter lecture de statut/diff/historique dans un scope séparé. Lecture/transmission de noms d'auteurs, messages et historique est également un consentement distinct du scope documentaire. Stage, branche locale et commit nécessitent une capacité locale explicitement accordée et des préconditions ; un commit IA ne remplace pas un checkpoint et ne doit pas embarquer le travail manuel sans sélection.

Push, création de dépôt distant, retrait/modification de remote, suppression de branche distante, changement de visibilité et toute réécriture publiée restent des actions humaines confirmées. Le modèle peut préparer une `PublicationRequest` (destination, refs, OIDs, fichiers et avertissements), mais pas l'approuver. Force-push et suppression destructive sont hors JG-A/B, indisponibles à l'agent. Rejouer un callId ne recrée pas un commit ; une publication au résultat réseau incertain n'est pas répétée sans inspection des références distantes.

## Recette et livraison

Les exigences REQ-GIT-001 à REQ-GIT-010 et scénarios ACC-31 à ACC-35 sont définis dans les registres 01/11. CI : dépôts temporaires originaux et remote bare local, deux clones pour avance/divergence, sans credentials personnels ni accès GitHub requis. Tester noms avec espaces/Unicode/newlines, noms commençant par tiret, renames, conflits, HEAD détaché, index partiel, absence Git, limites, symlinks, configuration malveillante et mission concurrente. Les fonctions de production réseau utilisent des tests de transport séparés pour HTTPS/SSH et rejets d'authentification ; le remote bare local ne les qualifie pas.

Chaque tranche fournit un parcours Electron sandboxé, preuve des octets avant/après, absence de secrets dans IPC/logs, rapport de plateformes et guide de récupération. Conception validée n'est pas fonction Git livrée ; la version applicative reste 0.10 pour cet ajout documentaire.

## Références techniques

Références officielles consultées le 2026-10-04 : [statut porcelain](https://git-scm.com/docs/git-status), [pull et stratégies](https://git-scm.com/docs/git-pull), [credentials](https://git-scm.com/docs/gitcredentials), [configuration](https://git-scm.com/docs/git-config), [hooks](https://git-scm.com/docs/githooks). Les politiques de confiance et de publication ci-dessus sont des décisions du produit, pas des garanties fournies par Git.
