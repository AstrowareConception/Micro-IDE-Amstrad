# ADR 0017 — Première tranche Git en lecture seule

Date : 2026-10-04. Statut : acceptée pour l'alpha 0.12. Complète l'[ADR 0015](0015-git-natif-et-publication-explicite.md), sans qualifier stage, commit ou réseau.

## Décision

Livrer découverte/version, statut et diff index/disque avant les mutations JG-A2. Le port TypeScript pur `VersionControlPort` ne possède que `status` et `diff` à cette étape. L'hôte associe une session Workspace à un adaptateur Git natif ; l'IPC accepte un ID de changement opaque, jamais un chemin libre, une CLI ou un exécutable. Les buffers restent inchangés. L'agent ne reçoit aucune capacité Git.

Le binaire provient des entrées absolues du PATH hôte, résolues, hors projet ; aucune recherche dans le dossier courant, aucun téléchargement ou Git embarqué. Les commandes sont asynchrones, sans shell, sans pager, bornées à 10 s et 1 Mio par sortie. UTF-8 invalide ou dépassement : refus sans liste tronquée. Statut : 2 000 changements ; métadonnées : 10 000 entrées et profondeur 32. Ces limites conservatrices remplacent les seuils indicatifs du document 16 pour cette alpha.

La lecture exige `.git` ordinaire à la racine exacte du projet. Un dépôt parent est seulement signalé. Worktree lié, liens/fichiers spéciaux internes, alternates, config worktree, gitlinks et configurations non qualifiées sont refusés. Un parcours borné examine les métadonnées avant lecture. La configuration locale est parsée sans includes ; seuls attributs core de base, identité, URLs/refspecs remotes et association de branche sont acceptés. Les valeurs privées ne sont pas renvoyées. Les includes, filtres, drivers, helpers, extensions et core.worktree restent bloqués, même si l'utilisateur les utilise légitimement ailleurs.

Environnement minimal : aucun `GIT_*` hérité, configs globale/système neutralisées, fsmonitor/untrackedCache désactivés, attributs globaux neutralisés, verrous optionnels désactivés, protocoles réseau interdits et lazy-fetch désactivé. Diff impose `--no-ext-diff`, `--no-textconv`, sans couleur et des pathspecs littéraux. Les lectures n'invoquent pas hooks, identité, credentials ou outils de publication. Les sources déclarées et le manifeste sont les seuls contenus consultables en diff ; les autres chemins apparaissent au statut, mais aucun de leurs contenus n'est renvoyé à l'interface. Git peut néanmoins lire/hacher les fichiers suivis pour calculer ce statut, dans son processus hôte. Fichiers non suivis/conflits : statut uniquement. Aucun contenu Git n'entre dans un prompt.

## Limites et conséquences

Git reste un processus à droits hôte : **ce n'est pas un sandbox OS**. Le binaire installé doit être maintenu ; les gardes ne protègent pas contre un processus hôte hostile remplaçant fichiers/configs entre validation et lecture ni contre une vulnérabilité native de Git. Les lectures ne constituent pas un snapshot transactionnel ; un autre client peut modifier le dépôt. Le diff est relu à la demande, pas figé au moment du statut. Une actualisation invalide les IDs précédents. Les préconditions HEAD/index/working tree pour mutations restent à réaliser avant stage/commit.

La politique refuse certains dépôts parfaitement valides plutôt que d'activer implicitement leurs extensions. Pas d'option « ignorer la sécurité ». L'absence de Git ou un refus n'empêche pas édition/DSK/IA. Pas d'init, clone, historique, staging, commit, remotes/branches mutables ou réseau. JG-A/ACC-31 restent partiels. Linux avec Git réel et Electron sandboxé constitue la recette de cette tranche ; Windows/macOS restent non qualifiés.
