# Atelier Git et GitHub — alpha 0.28

Date : 2026-10-06. [ADR 0035](../adr/0035-atelier-git-reseau-et-github.md), suite des [commits examinés](git-commit-alpha.md). Git doit être installé dans le PATH ; son adaptateur utilise `/dev/null`, reconnu nativement par Git for Windows, pour neutraliser configurations, attributs et hooks ; aucun outil Git ou shell n’est accordé à l’agent.

## Parcours

Le menu **Git**, la palette et le panneau gauche donnent accès à création de dépôt, index, commit, historique, branches, remotes, fetch/pull/push et GitHub. Init conserve désormais un `.gitignore` existant et installe les exclusions privées dans `.git/info/exclude`. Sans ignore existant, les exclusions partagées sont proposées comme auparavant. Aucun premier commit automatique.

Dans **Branches et synchronisation**, charger les références, ajouter/modifier/retirer un remote HTTPS ou SSH, créer une branche, basculer sur une branche locale/distante ou supprimer une branche locale fusionnée. Créer ne bascule pas automatiquement ; une branche distante peut créer sa branche locale suivie. Branches actives/non fusionnées refusées à la suppression. Les aperçus et confirmations natives montrent racine, branche locale/cible, URL, HEAD et cible.

Fetch actualise les références sans changer les sources. Pull commence par un fetch explicite puis prépare une avance fast-forward ; annuler conserve ce fetch. Divergence refusée, sans merge/rebase/stash automatique. Après pull/bascule, manifeste et sources sont rechargés avec une nouvelle session Workspace. Les buffers non enregistrés et les changements sur disque bloquent ces opérations. Un fichier local ignoré ne peut pas être écrasé par la cible. Projet cible invalide, liens et sous-modules sont refusés avant checkout.

Push prépare les commits nouveaux, vérifie la destination distante et examine tous leurs arbres, y compris un secret supprimé dans un commit ultérieur. ROM, disquettes, `.env`, stockage privé, contenu binaire ou motifs de secrets détectés bloquent la publication. Les projets avec documents référencés sont refusés : un manifeste partagé ne doit pas promettre des pièces privées absentes. Ce contrôle borné n’est pas une certification d’absence de secrets. Après premier push, l’upstream est configuré ; il peut aussi être sélectionné explicitement. Aucun force-push.

| Action | Raccourci atelier |
| --- | --- |
| Ouvrir Git | Ctrl/Cmd Maj G |
| Préparer Push | Ctrl/Cmd Alt K |
| Préparer Fetch | Ctrl/Cmd Alt G |
| Charger les branches | Ctrl/Cmd Alt B |

## GitHub privé et PR

**Git → Compte GitHub et dépôts privés** accepte un jeton personnel ou importe le compte GitHub CLI déjà connecté (`gh auth login --web`). Le jeton saisi est immédiatement effacé du champ ; il reste uniquement en mémoire côté main jusqu’à déconnexion/fermeture. Aucune persistance CPCéleste, écriture de credential dans le remote ou transmission du jeton à l’IA. Déconnecter CPCéleste ne déconnecte pas GitHub CLI.

Lister les dépôts accessibles, filtrer, sélectionner un dépôt privé/public, l’associer directement au projet ou le cloner dans un nouveau dossier. Pagination explicite : 100 dépôts/page, vingt pages maximum. Un clone ne remplace jamais un dossier existant ; il vérifie un projet CPCéleste avant ouverture. Un échec conserve le dossier partiel et le projet courant.

Créer un dépôt dans le compte personnel (privé par défaut), sans fichiers initiaux, puis l’associer et publier avec Push. Les droits requis sont expliqués : Contents lecture/écriture, Pull requests écriture et Repository creation ; restrictions d’organisation et approbations restent celles du compte GitHub. L’API utilise uniquement `api.github.com`, les credentials de transport uniquement HTTPS `github.com`, sans redirections. SSH utilise les clés et hôtes système déjà approuvés, en mode non interactif ; son authentification n’utilise pas le jeton GitHub.

Lister les cent premières PR ouvertes, créer une PR de la branche courante vers une base choisie (brouillon par défaut), puis ouvrir la PR ou la CI dans le navigateur. La branche doit être publiée au préalable. Création de dépôt/PR confirmée nativement ; aucune fusion ou publication automatique.

## Message de commit par IA

**Proposer le message par IA** utilise le modèle OpenAI choisi dans l’assistant et sa clé en mémoire. Une confirmation indique les fichiers indexés et le transfert facturable. Seul le diff exact de l’index est transmis : 128 Kio maximum, sans documents, auteur ou historique supplémentaires. Le diff est une donnée inerte ; aucun outil n’est disponible. Le message proposé reste modifiable, puis suit l’aperçu et la confirmation ordinaires du commit. La proposition ne crée ni commit ni push.

## Arrêt, confiance et limites

Une seule mutation main à la fois ; terminal/mission agent active et sessions périmées refusés. Plans consommés, révisions sources/index/config/refs revérifiées. Les configurations dangereuses, hooks, helpers de credential et protocoles arbitraires restent désactivés/refusés. Pas de désactivation TLS ; une autorité de certification configurée dans l’environnement hôte peut être utilisée. Pas de credential générique pour les autres hébergeurs HTTPS dans cette tranche.

Boutons **Arrêter l’opération Git / Arrêter le clone**, limites 15 s/commande locale et 120 s réseau. Le main termine uniquement son processus/groupe Git possédé et ses auxiliaires ; aucune commande/PID libre reçue du renderer. L’arrêt n’est pas une transaction : examiner HEAD, refs, index et dossier partiel avant de recommencer. Une publication distante peut avoir réussi avant l’interruption. Si une erreur a modifié les sources, l’ancienne session devient impropre aux écritures ; réouvrir explicitement le projet. Aucun verrou inconnu supprimé ni reprise automatique.

Bornes : SHA-1, arbre 256 fichiers/16 Mio, 1 Mio de sortie/blob, publication 200 nouveaux commits/32 Mio de blobs UTF-8, noms de branche conservateurs. Les limites produisent un refus explicite. Worktrees, sous-modules, merge/rebase/conflits, stash, tags, signatures, revert/cherry-pick et blame restent ouverts. Pas d’OAuth intégré ni stockage système de credentials CPCéleste. Pas de garantie de transaction globale contre un autre processus ou de récupération après panne électrique.

## Vérification

Treize tests Node supplémentaires : Git réel avec deux clones/bare, remotes/branches/upstream/push/fetch/pull, dirty/stale/replay/divergence, projet invalide, collision ignorée, liens, config dangereuse et secret historique. Transport HTTPS réel chiffré via `git http-backend` : authentification, certificats, push/clone/fetch/pull, mauvais identifiants et arrêt d’une connexion volontairement suspendue avec sources/HEAD conservés. API GitHub privée et OpenAI contrôlées sans credentials personnels ni appel facturé.

Recette navigateur : menus/raccourcis, compte privé/listing/association, sources rechargées, message IA relu, PR brouillon et refus de clone dirty. Recette Electron sandboxée : init préservant ignore, index/commit IA relu, annulation native, vrai réseau TLS, branches/pull et clone dans un nouveau dossier, compte/PR via API contrôlée, URLs natives et absence de jeton sur un autre hôte. Les captures sont conservées en artefacts CI. Windows couvre compilation propre et Git local ; TLS et Electron sont qualifiés séparément sous Linux. SSH, macOS, compte GitHub personnel et OpenAI facturé ne sont pas qualifiés par ces fixtures.

Références officielles consultées : [configuration Git](https://git-scm.com/docs/git-config), [pull](https://git-scm.com/docs/git-pull), [GitHub CLI auth](https://cli.github.com/manual/gh_auth_login), [création de dépôt](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user), [PR GitHub](https://docs.github.com/en/rest/pulls/pulls).
