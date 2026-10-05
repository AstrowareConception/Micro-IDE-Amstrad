# ADR 0024 — Copie optionnelle des brouillons et reprise dans les buffers

Date : 2026-10-05. Statut : acceptée pour l’alpha 0.19 ; R2 et IDE-011 partiels.

## Décision et parcours

Conserver une copie locale distincte des fichiers BASIC et de l’historique des sauvegardes. L’utilisateur active la copie automatique pour la session de projet : délai de deux secondes après une pause de saisie, contrôle périodique de quinze secondes pour une saisie continue. Un bouton copie immédiatement. Aucun buffer n’est marqué enregistré ; aucun fichier source, manifeste ou DSK n’est écrit par cette copie. Une seule copie courante, sans rétention de versions, évite de confondre récupération de brouillons et historique local.

À la réouverture, le panneau signale les brouillons disponibles, sans appliquer ni écraser la copie. Une copie héritée bloque les nouvelles captures jusqu’à revue/restauration complète, constat que tous les buffers lui correspondent, ou effacement explicite. L’utilisateur compare les sources dans Monaco puis sélectionne celles à reprendre. La restauration relit copie et bases disque, puis applique des opérations guardées dans les modèles ; undo/redo reste propre à chaque source. Une reprise partielle conserve les brouillons non sélectionnés et maintient la capture désactivée jusqu’à reprise du reste ou effacement. L’option est désactivée à chaque nouvelle session et à la relecture de copie.

Une fermeture normale ou un enregistrement n’efface pas implicitement la copie. Elle reste consultable tant qu’elle n’est pas remplacée par une nouvelle capture autorisée ou effacée explicitement. L’effacement natif est annulé par défaut, relit la révision après confirmation et publie un record sans fichiers ; les buffers et sources restent intacts. Il désactive aussi la copie automatique. Si des sources ont été enregistrées depuis la copie, leurs bases ne correspondent plus : l’IDE refuse la reprise, conserve la copie et permet son effacement explicite après examen. Pas de suppression opportuniste ni de faux statut « enregistré ».

## Architecture et contrat

Types `DraftSummary/DraftRecovery/DraftPort` dans Workspace ; adaptateur `DraftStore` dans le main. Routes liées à la session `drafts:status/capture/read/forget`, sans chemin hôte libre. Les captures contiennent exactement tous les IDs de sources déclarées dans leur requête, mais le stockage ne conserve que les buffers différents des bases LF. Le main résout tous les chemins et bases disque, vérifie manifeste, journal de sauvegarde résolu et empreintes de session. Les missions agent ou commandes terminal actives bloquent les routes ; aucune nouvelle capacité agent.

`.microide/drafts/current.json`, v1 strict : UUID copie/projet, SHA du manifeste exact, date ISO, fichiers `{id,path,base,baseHash,draft,draftHash}`. Base et draft sont base64 canonique, UTF-8 sans BOM/NUL ; la base conserve les octets disque CRLF et le draft est normalisé LF. SHA-256 et identité/chemin sont vérifiés. 64 sources au maximum, 1 Mio/version/source, 8 Mio par ensemble base/draft, 24 Mio JSON par record. La validation inclut les sources propres avant de filtrer. Copies inchangées dédupliquées, aucune écriture de métadonnées lors d’une simple inspection d’un projet sans copie.

Chaque remplacement exige la SHA du fichier exact attendu, ou null si absent. La révision est contrôlée avant publication, à la lecture et lors de l’effacement ; une altération rend l’aperçu périmé. Le record ne peut pas appartenir à un autre projet. La reprise exige le manifeste exact, les mêmes IDs/chemins et toutes les bases dirty encore identiques sur disque, y compris après réouverture. Le guard Monaco protège les buffers sélectionnés au moment d’appliquer. Une source externe inconnue bloque tout le lot avant la première modification de buffer.

Publication par temporaire exclusif synchronisé, rename et synchronisation du répertoire sous Linux. Répertoires nouveaux 0700, fichier 0600, métadonnées ordinaires sans symlink/hardlink. Huit temporaires maximum avant publication ; fichiers inconnus/corrompus/futurs conservés et refusés. Le journal de sauvegarde 0022 reste prioritaire à l’ouverture : une sauvegarde interrompue doit être résolue avant reprise des brouillons.

## Limites et suite

Copie opt-in des buffers chargés dans un projet. Listings autonomes, réglages persistants, brouillons de sources non déclarées, changements de structure et historique durable des missions agent restent ouverts. La suppression ou modification externe d’un fichier/manifeste ne déclenche pas encore de watcher : les guards la constatent pendant les opérations. Un conflit conserve les données, sans merge automatique ; l’arbitrage/diff externe appartient à IDE-012.

Fenêtre de perte possible avant la première capture ou pendant la saisie entre captures ; timer suspendu si atelier occupé, aperçu ouvert, copie héritée en attente ou requête en cours. Une erreur est affichée, jamais assimilée à une copie réussie. Pas de garantie de panne électrique, Windows/macOS ou filesystem réseau ; course externe entre contrôle et rename possible, pas de verrou interprocessus. La copie reste du code privé local, exclu de Git par `.microide` dans les dépôts initialisés par l’IDE et non transmis à l’IA par ce mécanisme.

Suite prioritaire : watcher et revue contrôlée des changements externes (IDE-012), puis extension des checkpoints aux mutations agent avant Git checkout. R2/J1-03/ACC-02 restent ouverts.

## Qualification

Huit nouveaux tests fichiers : base CRLF/source intacte, dirty-only/déduplication/déplacement, SIGKILL après publication dans un processus séparé utilisant `ProjectStore.captureDrafts`, révisions/effacement, conflits après réouverture/manifeste, corruption/version/projet/path/hash, budgets/snapshot/liens/temporaires et journal pending. La recette Electron ajoute un vrai SIGKILL/relaunch de l’application sandboxée après copie automatique, diff, refus de conflit après aperçu, reprise sélective sans perte des brouillons écartés, undo/redo et effacement annulé par défaut. Résultats effectifs dans la PR.
