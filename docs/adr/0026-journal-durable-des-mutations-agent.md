# ADR 0026 — Journal durable des mutations agent

- Statut : accepté
- Date : 2026-10-05
- Périmètre : alpha 0.21, R2 et J5 partiels

## Décision

Le checkpoint de mission sous userData reste un diagnostic privé et la restauration du bouton concerne toujours la mission courante. Les écritures réelles utilisent désormais un journal distinct, privé au projet : `.microide/agent-journal/current.json`. Il contient les octets du manifeste avant/après et l’union des sources avant/après ; une absence explicite permet de rejouer une création ou le retrait d’une source créée lors d’une restauration. Aucun prompt, clé, réponse fournisseur, document original ou ROM n’y est enregistré.

`ProjectStore.applyAgentState` valide le candidat entier, les destinations absentes, documents et hashes courants, puis prépare le journal avant toute écriture. Un candidat invalide/une collision est refusé avant publication. Une fois le journal publié, toute erreur d’application conserve la transaction pending et bloque le projet jusqu’à reprise ; le rollback automatique en cours de processus est remplacé par ce protocole explicite. Sources puis manifeste sont appliqués, chaque publication utilise fichier temporaire exclusif, fsync, rename et sync du dossier. La phase finale n’est publiée qu’après vérification de l’ensemble. Aucun verrou ni transaction atomique de tout le dossier n’est revendiqué.

À la réouverture, main examine ce journal avant le journal d’Enregistrer tout. Dialogue natif Annuler par défaut, Terminer la mutation ou Rétablir les versions avant mutation. La reprise n’exécute pas l’IA, ne relance pas une mission et n’a pas besoin de clé. Elle vérifie révision exacte du record, manifeste et chaque source : seules les valeurs avant/après (ou absence prévue) sont admissibles. Les conflits sont refusés avant modification ; ces préconditions sont répétées pendant la reprise, elle-même rejouable après interruption.

Les deux ensembles de sources sont conservés dans l’historique local avant les écritures de reprise/application. Raisons `before-agent` et `after-agent` ; la seconde désigne une version préparée, qui peut ne pas avoir été choisie/appliquée en cas de restauration. Rétention commune 20 snapshots / 64 Mio. Les sources retirées restent dans les snapshots ; le panneau courant ne restaure que les IDs/chemins encore déclarés. Le manifeste n’est pas restauré par ce panneau d’historique source.

## Bornes et limites

Journal v1 strict : identité de projet commune, propriétés exactes, base64 canonique/empreintes, UTF-8 sans BOM/NUL, manifeste 1 Mio/version, sources 64 Kio/version et 256 Kio/ensemble, union de 128 entrées maximum et record JSON 4 Mio. Les propriétés de projet hors sources/entrée restent identiques ; renommage agent refusé et création limitée aux sources plates. Dossiers/fichiers ordinaires, pas de liens/hardlinks ; chemins déclarés sous src uniquement. Une transaction courante, données inconnues/corrompues conservées ; temporaires non interprétés et nouvelle préparation bornée.

Une panne après publication peut laisser des fichiers/manifeste mixtes jusqu’au choix utilisateur. Un conflit externe ou historique corrompu empêche la reprise : préserver les données puis examiner les métadonnées. Pas de verrou interprocessus ni garantie contre une écriture externe entre dernier contrôle et rename/unlink. Linux/SIGKILL qualifié par tests ; panne électrique, réseau FS, Windows/macOS restent ouverts (sync des dossiers Windows non qualifié). Les brouillons non écrits sont distincts, sans reprise automatique du contexte IA ni navigateur de missions anciennes. Ajout humain/import documentaire restent hors ce journal ; R2/J1-03/ACC-02 ne sont pas clos. Prochaine tranche : identité et commit Git local.
