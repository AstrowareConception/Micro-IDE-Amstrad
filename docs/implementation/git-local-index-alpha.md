# Dépôt Git et index locaux — alpha 0.13

Date : 2026-10-04. [ADR 0018](../adr/0018-git-init-et-index-isole.md), suite de la [lecture seule 0.12](git-alpha.md). Tranche partielle JG-A1/A2, pas Git complet.

## Créer un dépôt

Ouvrir/créer un projet valide dans un dossier hors dépôt parent. Installer Git séparément et redémarrer l'IDE si nécessaire. Enregistrer/arbitrer tous les brouillons ; les mutations sont bloquées s'il en reste, sans sauvegarde automatique. **Actualiser Git**, puis **Préparer la création Git** affiche dossier, branche `main` et contenu exact du futur `.gitignore`.

**Créer le dépôt Git local** demande une confirmation native montrant la racine exacte. Annuler n'écrit rien. Confirmer revérifie le plan, crée `.git` et `.gitignore` sans écrasement puis un dépôt vide, sans fichiers indexés ni commit. Documents, ROM, configuration locale, caches, checkpoints/conversations/logs, `.env` et artefacts sont ignorés par défaut. Les documents non suivis ne figurent plus dans le statut. Les règles proposées ne sont pas un détecteur exhaustif de secrets.

Dépôt existant ou parent, worktree lié/bare, `.gitignore` préexistant : refus explicite. Aucun fichier original n'est réécrit. Cette alpha ne fusionne pas les règles d'exclusion d'un projet existant et ne fournit pas de choix de racine monorepo. Échec après création partielle : conserver et examiner `.git`/`.gitignore`, un marqueur pending bloque la reprise non qualifiée. Ne pas supprimer de dossier pour « débloquer » automatiquement.

## Choisir les changements

Dans le statut, **Indexer** et **Retirer index** ne sont disponibles que pour sources BASIC déclarées, manifeste et `.gitignore`, avec snapshot qualifié. Chaque action ne prend qu'un fichier, confirme nativement son nom et rafraîchit le statut. Diff index/disque reste accessible séparément, en texte inerte ; les brouillons ne sont jamais intégrés implicitement. Unstage retire la sélection de l'index ou rétablit son entrée HEAD, **pas** le fichier sur disque. Cela fonctionne aussi avant le premier commit.

Conflits/renommages et autres contenus privés : statut seulement, indexation depuis l'IDE refusée. Si une source/path/index/config/HEAD change entre statut et confirmation, l'action échoue sans publier l'index candidat ; actualiser et examiner à nouveau. Un verrou `index.lock` existant est conservé. Une mission agent ou autre opération disque bloque ces commandes. Aucun outil Git n'est accordé au modèle.

Le manifeste peut référencer des documents ignorés : l'IDE l'annonce, sans prétendre qu'un futur clone sera complet. Ces originaux ne sont pas automatiquement indexés pour résoudre ce problème. Les opérations de publication et leur analyse de secrets/portabilité restent à construire.

## Sécurité et limites

Arguments typés et pathspecs littéraux ; exécutable/config/environnement contrôlés selon les ADR 0017/0018. Hooks, y compris `post-index-change`, neutralisés par commande ; filtres/includes/helpers/commandes auxiliaires non qualifiés toujours refusés. Init utilise un template vide. L'indexation prépare un index isolé, vérifie les empreintes et publie sous un `index.lock` détenu. HEAD et sources ne sont pas modifiés. Ce mécanisme n'est ni un sandbox OS, ni une transaction globale face à un client hostile, ni une récupération complète après crash.

1 Mio/fichier/index/sortie, 10 s/commande, 2 000 changements ; métadonnées bornées comme en 0.12. Source non qualifiée : statut en lecture seule sans snapshot mutatif. Blobs non référencés/lock temporaire peuvent rester après préparation interrompue ; un échec de refresh après publication indique explicitement « index modifié » et interdit le retry automatique. Windows/macOS, autres Git/stockages et processus concurrents hostiles non qualifiés.

## Recette

Sept nouveaux scénarios Node, en complément des huit lectures Git : init vide/main/exclusions/no-commit, plans périmés/exclusions existantes/dépôt parent/bare, stage/unstage unborn, préservation d'un autre fichier déjà indexé et des sources/HEAD/OID avec vrai hook exécutable inactif, changements source/index/HEAD et lock externes, contenus privés/configs malveillantes/concurrence/rejeu, échec natif avec rétention du dossier partiel/pending et refus de retry destructif. Le dernier utilise un transport Git synthétique original ne réussissant que la lecture de version ; les succès métier utilisent Git réel. Fixtures temporaires, aucun credential personnel ni remote public.

Le parcours Electron sandboxé utilise un second projet original : préparation sans écriture, annulation native, création **par l'IDE** en `main`, exclusions vérifiées, un seul fichier indexé puis retiré, diff réel, sources/HEAD/manifeste inchangés, hook absent des effets, modification externe pendant confirmation refusée, dirty state refusé par IPC main. Capture `out/git-local-index-alpha.png` ajoutée aux preuves desktop. Résultats effectifs et version Git CI consignés dans la PR après exécution, pas déduits de la présence des tests.

Pas de commit ou identité, historique, clone, branche mutable, remote, fetch/pull/push, GitHub API ou Git agent. Prochaine tranche : identité locale et commit du contenu exact de l'index, historique paginé, garde des fichiers privés déjà indexés, validation de projet et absence de signature silencieusement contournée. Ensuite synchronisation avec confirmation humaine et qualification HTTPS/SSH. Firmware/OpenAI réels restent reportés à la demande produit.
