# Commit Git local — alpha 0.22

## Parcours livré

Ouvrir un projet versionné, enregistrer les brouillons et actualiser Git. Indexer les fichiers souhaités, saisir nom, email et message, puis **Préparer le commit de l’index**. L’aperçu montre branche, parent (ou premier commit), auteur, message, fichiers et diff exact de l’index. **Créer le commit local** ouvre une confirmation native avec Annuler par défaut. Après succès, consulter l’historique ; les modifications du disque non indexées restent intactes.

L’identité vaut pour ce commit (auteur et committer identiques) et reste dans le panneau pendant la session ; aucune écriture de configuration Git ni mémorisation persistante. Message multiligne UTF-8, fins de ligne normalisées. Commits locaux non signés, hooks désactivés, aucun push ni outil Git agent.

## Préconditions et protocole

Git natif 2.48 minimum pour cette mutation, dépôt SHA-1 ordinaire à racine exacte, branche locale attachée, aucune fusion/rebase/cherry-pick/revert/bisect en cours. Les restrictions de configuration, liens, worktrees, sous-modules et objets externes des alpha précédentes restent applicables. Les buffers dirty, session périmée, terminal/mission active et état projet non courant bloquent la publication.

Le plan opaque conserve HEAD, référence symbolique, empreintes index/config/fichiers et arbre issu d’une copie isolée de l’index. Seuls les changements indexés A/M/D de sources déclarées, du manifeste et de `.gitignore` sont admissibles. Les autres fichiers déjà suivis et inchangés sont conservés dans l’arbre ; toute modification indexée d’un document privé ou chemin non autorisé est refusée. Ces exclusions ne détectent pas un secret dans une source autorisée. Renommages représentés par suppression/ajout ; blobs modifiés réguliers UTF-8, sans NUL/BOM.

La publication prend un verrou exclusif de l’index, revérifie le plan et crée un objet par `commit-tree`. `update-ref --stdin` compare l’ancien HEAD, prépare la transaction et verrouille les références. L’hôte répète ses contrôles pendant cette préparation, notamment la branche symbolique, avant d’envoyer commit ou abort. L’index réel n’est pas réécrit ; la configuration et les sources ne sont pas modifiées. L’aperçu est consommé à la tentative de publication, sauf annulation native ; après conflit, actualiser et préparer à nouveau.

## Bornes et récupération

66 changements maximum, 1 Mio par sortie Git/blob, 8 Mio cumulés de blobs modifiés, 10 secondes par commande. Nom 100 caractères, email 254, message 8 192, branche 240 ; contrôles interdits et propriétés inconnues refusés. Aucun amend, signature, hooks, identité persistante, restauration de commit, checkout ou réseau intégré.

La préparation peut créer des objets arbre ; une erreur après création du commit peut laisser un objet non référencé. Un résultat de publication incertain demande une inspection de l’historique avant reprise, sans répétition automatique. Une interruption brutale peut laisser fichiers temporaires/verrous : les conserver et examiner Git ; aucun nettoyage automatique d’un verrou externe. La transaction Git ne verrouille pas les sources contre une écriture externe après le dernier contrôle. Panne électrique, Windows/macOS et systèmes de fichiers réseau restent non qualifiés.

## Vérification

146 tests Node, dont sept nouveaux tests avec Git réel : premiers/seconds commits, octets indexés distincts du disque, identité/message, parents/reflogs, index/config inchangés, conflits HEAD/branche/index/source/config, fichiers privés/binaires/liens, hooks et verrous externes, refus après préparation sous verrou Git. Recette Electron ajoutée : aperçu, annulation native, deux commits, historique, conflit pendant confirmation, buffers dirty et session périmée. Son exécution effective et la capture sont attestées dans la PR de cet incrément.

[ADR 0027](../adr/0027-commit-git-index-exact.md). IDE-033 devient partiel ; R3/JG-A/ACC-31 restent ouverts. Suite : identité persistante qualifiée et branches locales avec protection des buffers/projet avant synchronisation réseau.

L’[alpha 0.23](git-identity-alpha.md) ajoute un profil privé d’identité facultatif ; la configuration Git reste inchangée.
