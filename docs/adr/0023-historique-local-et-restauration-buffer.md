# ADR 0023 — Historique local borné et restauration dans le buffer

Date : 2026-10-04. Statut : acceptée pour l’alpha 0.18 ; suite de R2, IDE-009/010 partiels.

## Décision

Un adaptateur main `LocalHistory` conserve les sources déclarées du projet dans `.microide/history/<uuid>.json`, indépendamment de Git. Les types `HistorySnapshot/HistoryVersion/HistoryPort` appartiennent à Workspace et n’importent ni Node ni Electron. Aucun moteur de base de données ou nouvelle dépendance.

Les sauvegardes locales actives et globales partagent désormais le pipeline journalisé de l’ADR 0022. Enregistrer actif construit son snapshot depuis le disque pour les autres sources : les autres brouillons renderer ne sont pas enregistrés. Toutes les sources et le manifeste sont contrôlés ; un conflit dans une source inactive bloque également la sauvegarde active. Un no-op ne crée ni journal ni historique et préserve les octets CRLF inchangés.

Un checkpoint des octets avant est publié avant de préparer le journal ; un checkpoint après suit les écritures et leur synchronisation, avant la phase committed du journal. Une erreur avant la préparation laisse les sources intactes. Une erreur de checkpoint après les écritures conserve le journal pending et bloque le store pour la reprise. Un checkpoint « avant » peut subsister après une sauvegarde échouée ; « après » désigne un snapshot écrit, pas une garantie d’absence de panne électrique. Les checkpoints identiques au plus récent, identités/chemins/empreintes compris, sont dédupliqués. Les horodatages sont monotones même si l’horloge revient en arrière.

L’UI présente l’historique de la source active, accessible depuis la barre, le menu Fichier, la palette et les contextes des sources. Un diff Monaco en lecture seule compare le buffer capturé à la version choisie ; les espaces ne sont pas ignorés, et le temps de calcul du diff est borné à une seconde. La restauration relit la version par UUID/révision exacte et contrôle source/manifeste courants. Elle remplace seulement le buffer avec une opération Monaco encadrée par deux arrêts undo. Le guard de modèle refuse un buffer modifié depuis l’aperçu. Une sauvegarde ultérieure explicite archive la version disque remplacée et utilise le journal normal.

## Format et rétention

Contrat strict v1 : UUID snapshot/projet, date ISO, raison `before-save/after-save`, sources `{id,path,sha256,content}` en base64 canonique. 1–64 sources, 1 Mio UTF-8 sans BOM/NUL par source, 8 Mio par snapshot, 12 Mio JSON par fichier. SHA-256 vérifiés ; chemins sous `src/`, IDs/chemins uniques. Des sources ajoutées ultérieurement n’invalident pas les anciennes versions ; une restauration exige néanmoins le même ID **et** chemin dans le manifeste courant. Aucun texte documentaire, ROM, secret de configuration ou artefact n’est ajouté ; les sources elles-mêmes peuvent évidemment contenir des données privées.

Rétention automatique : 20 snapshots et 64 Mio de JSON cumulés, la limite atteinte en premier l’emporte. Le nouveau snapshot est publié et synchronisé avant suppression des plus anciens déjà validés ; chaque ancien fichier est relu par empreinte avant suppression. L’arrêt pendant la purge peut laisser davantage de versions, jamais une suppression du nouveau checkpoint par cette purge. Le lecteur tolère jusqu’à 32 snapshots/128 Mio et 40 entrées de dossier pour permettre cette reprise bornée ; une accumulation supplémentaire bloque et exige examen. Les temporaires sont conservés, pas interprétés. Un fichier inconnu, corrompu, symbolique, hardlinké ou d’une autre version/projet bloque lecture/purge/écriture, sans effacement implicite. Après correction ou sauvegarde d’un historique à examiner, la sauvegarde peut être retentée.

Répertoires nouveaux 0700, snapshots 0600, remplacés via temporaire exclusif synchronisé et rename, répertoire synchronisé sous Linux. L’historique est privé et exclu par `.microide` du Git initialisé par l’IDE. Le renderer ne fournit aucun chemin de fichier hôte ; les routes sont liées à la session courante. Le snapshot déplacé avec le projet conserve son UUID et ses chemins relatifs.

## Limites et suite

Historique des sauvegardes locales du projet seulement : listings autonomes, ajouts/suppressions, mutations agent, documents, récupérations après interruption et brouillons jamais enregistrés ne sont pas systématiquement archivés. Pas de labels utilisateur, restauration de fragment ou restauration d’un projet complet. L’historique conserve les octets CRLF originaux ; sa restauration dans le buffer normalise les fins de ligne comme l’éditeur, puis une sauvegarde explicite produit du LF. Le rollback du journal reste la voie de reprise aux octets exacts.

La rétention n’est pas une sauvegarde externe. Aucune garantie panne électrique, réseau FS ou verrou interprocessus ; course contrôle/suppression ou contrôle/rename possible. Windows/macOS restent non qualifiés. R2, J1-03 et ACC-02 restent ouverts. Suite : récupération optionnelle des brouillons, watcher externe, puis extension aux mutations agent avant Git checkout.

## Preuves

Sept tests historiques avec vrais fichiers : persistance/déplacement, journal actif/no-op/CRLF, ordre et 20 snapshots, snapshots 8 Mio et rétention 64 Mio, corruption/version/projet/path/hash, révisions/disque/identité, liens/temporaires, conflit de source inactive. Recette Electron ajoutée : diff avant/après, altération historique et conflit disque après aperçu, restauration buffer sans écriture, undo/redo, sauvegarde explicite et réouverture ; résultats CI dans la PR. Les essais SIGKILL du journal 0.17 restent exécutés.
