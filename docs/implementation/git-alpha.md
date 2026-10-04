# Git local en lecture seule — alpha 0.12

Date : 2026-10-04. [ADR 0017](../adr/0017-git-inspection-conservatrice.md), contribution à JG-A1 et à la lecture de JG-A2, pas clôture de JG-A ni d'ACC-31.

## Utilisation

Installer Git séparément puis redémarrer l'IDE pour actualiser son PATH. Ouvrir un projet valide dont la racine contient un dossier `.git` ordinaire. Dans **Git · lecture seule**, **Actualiser Git** affiche version, branche, HEAD et changements. `.` signifie inchangé ; les deux codes indiquent index puis disque. Dépôt sans premier commit et HEAD détaché sont identifiés. L'IDE ne crée pas encore de dépôt et ne clone rien.

**Index** compare la version indexée à HEAD ; **Disque** compare le fichier enregistré à l'index. Le diff est du texte inerte en lecture seule. Les brouillons Monaco ont leur avertissement distinct et ne sont jamais sauvegardés pour consulter Git. Le contenu peut changer entre statut et diff si un autre client intervient : le diff correspond à la lecture courante, pas à un snapshot atomique. Actualiser invalide les anciennes sélections.

Seuls manifeste et sources BASIC déclarées sont consultables en diff. Autres fichiers, pièces jointes, ROM et configurations privées : noms au statut local, contenu non renvoyé à l'interface. Git peut lire/hacher les fichiers suivis pour calculer le statut dans son processus hôte ; ce périmètre n'est pas un sandbox de lecture disque. Fichiers non suivis et conflits : statut seulement. Aucun contenu n'est envoyé à l'IA ou au réseau. Statut et diff sont indisponibles pendant une mission agent ou une autre opération disque. Une session périmée est refusée côté main.

Un dépôt parent est signalé sans être adopté : cette alpha exige une racine de projet égale à celle du dépôt, donc ne couvre pas encore les projets dans un monorepo. Worktrees liés, bare, sous-modules, alternates, Git LFS et configurations non qualifiées sont refusés. Git absent, sortie non UTF-8, quota ou erreur ne bloque pas les fonctions BASIC ; le message n'expose pas stderr/config/credentials.

## Protections et limites

Git natif asynchrone, arguments typés, pas de shell ni d'exécutable choisi par le renderer. Configuration locale restrictive, includes/commandes auxiliaires refusés, environnement Git hérité neutralisé, pas de pager/external diff/textconv/fsmonitor, pas de réseau automatique ou locks optionnels. Détails dans l'ADR 0017. Ce n'est pas un sandbox OS ; un processus hôte hostile concurrent ou une faille de Git reste hors garantie. Ne pas présenter cette inspection comme une autorisation générale d'exécuter les hooks d'un dépôt.

Bornes alpha : 10 s / 1 Mio par commande, 2 000 changements ; 10 000 entrées et profondeur 32 dans `.git`. Pas de troncature silencieuse. Les erreurs imposent de réduire le dépôt ou d'attendre une évolution qualifiée, pas de désactiver une protection. Git n'est pas embarqué ni téléchargé ; aucune dépendance/npm supplémentaire.

## Vérifications

Huit scénarios Node Git utilisent des dépôts temporaires originaux : parsing NUL/renames/quotas, index et disque distincts, octets HEAD/index/source et mtime index préservés, unborn/detached/conflits, configurations malveillantes et sentinel jamais exécuté, absence/dépôt parent/worktree/liens/alternates, contenus privés/symlinks refusés, sorties bornées/environnement neutralisé, vrais noms Unicode/newline/tiret/glob littéral et gitlinks. Fixtures et commits n'utilisent aucun credential ni remote public. Hôte local : Git 2.51.1 ; version CI native imprimée dans le journal du parcours.

Le parcours Electron sandboxé étend les recettes existantes : dépôt créé **par la fixture de test**, diff index/disque par IPC réel, brouillon conservé, aucun octet HEAD/index/source/manifeste modifié et session invalide rejetée. Capture `out/git-alpha.png` dans les artefacts du workflow desktop. Réussites effectives et liens CI consignés dans la PR après exécution, pas déduits de la présence du scénario. L'exécution Electron native locale n'est pas revendiquée sur l'hôte root sans Xvfb.

Suite : init avec exclusions/confidentialité, stage/unstage explicitement sélectionnés, identité locale, commit/historique, préconditions et confiance mutative. Puis branches/remotes, clone/fetch/pull fast-forward/push confirmé et qualification HTTPS/SSH. Réparation du manifeste après Git et reprise après incident restent indispensables. Windows/macOS, Git complet, connexion GitHub et qualification CPC ne sont pas annoncés par cette tranche.
