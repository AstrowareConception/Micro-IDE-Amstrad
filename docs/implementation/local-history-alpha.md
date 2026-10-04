# Historique local — alpha 0.18

Suite R2, IDE-009/010 partiels. [ADR 0023](../adr/0023-historique-local-et-restauration-buffer.md), [roadmap](../specifications/17-roadmap-ide-complet.md).

## Utilisation

1. Ouvrir un projet et modifier une source. Enregistrer actif ou Enregistrer tout conserve les versions avant/après ; une opération sans changement ne grossit pas l’historique.
2. Cliquer **Historique local** dans la barre, ou utiliser Fichier, la palette ou le contexte d’une source. La fenêtre charge les versions de la source active. Actualiser les versions locales renouvelle la liste.
3. Choisir un snapshot « Avant sauvegarde » ou « Après sauvegarde ». À gauche : le buffer actuel capturé lors du choix ; à droite : la version historique. La coloration BASIC et le diff en lecture seule facilitent la revue.
4. **Restaurer cette version dans le buffer** remplace seulement la source choisie et la marque modifiée. Ctrl Z annule, Ctrl Maj Z rétablit. Enregistrer reste une action explicite ; les autres sources et le manifeste ne sont pas restaurés.

Le journal de reprise couvre désormais aussi Enregistrer actif et les sauvegardes via le contexte des sources. Les autres buffers modifiés restent dans l’éditeur ; leurs fichiers disque ne sont pas réécrits. Un conflit détecté dans une autre source du projet bloque également cette sauvegarde active : rouvrir après arbitrage. Les listings autonomes ouverts sans projet conservent leur fonctionnement antérieur.

## Conservation et protection

Les versions se trouvent dans `.microide/history`, indépendantes des commits Git et conservées après fermeture/réouverture ou déplacement du dossier. Le stockage garde les octets d’origine, CRLF compris ; le buffer et sa restauration utilisent des fins de ligne LF. Snapshots stricts v1, UUID projet/snapshot, date, raison, sources et SHA-256 ; budgets 1 Mio/source, 8 Mio/snapshot, 12 Mio de JSON/fichier.

La rétention conserve jusqu’à **20 snapshots et 64 Mio de JSON** pour tout le projet, pas 20 par fichier. Les plus anciens expirent automatiquement après publication du nouveau checkpoint. Les snapshots identiques au dernier sont dédupliqués ; les horodatages sont ordonnés. Une purge interrompue peut temporairement dépasser la rétention ; limites de lecture 32 snapshots/128 Mio/40 entrées, puis examen manuel. Les temporaires interrompus sont conservés. Ce n’est pas une sauvegarde externe : conserver un dépôt distant ou une sauvegarde séparée.

La restauration relit la version et refuse si l’historique, le disque, le manifeste ou le buffer a changé depuis l’aperçu. Une source n’est restaurable que si son ID et son chemin correspondent au projet courant. Les métadonnées corrompues, futures, d’un autre projet ou contenant des liens bloquent les opérations ; aucune réparation ni purge automatique de fichiers inconnus. Une erreur d’historique avant écriture bloque la sauvegarde sans modifier les sources ; après écriture, le journal pending conserve la reprise à l’ouverture.

L’historique est exclu par les règles Git créées par l’IDE ; dans un dépôt externe, vérifier ses propres règles `.gitignore`. Il contient du code potentiellement privé et reste local, sans transmission à l’IA. Répertoires nouveaux 0700 et snapshots 0600 sous les plateformes qui prennent ces permissions en charge.

## Vérification

118 tests Node, dont sept nouveaux historiques : déplacement/réouverture, no-op, journal actif et CRLF, 20 versions, 64 Mio avec snapshots de 8 Mio, révisions/conflits, corruption et liens. Typecheck, construction, recette navigateur et contrôle documentaire ; résultats Electron effectifs dans la PR. La recette native sandboxée Linux compare dans Monaco, refuse deux altérations après aperçu, restaure sans écrire, vérifie dirty/undo/redo puis sauvegarde et réouvre. Capture `out/local-history-alpha.png`, artefact Desktop editor conservé sept jours.

## Ce qui reste ouvert

Historique non systématique pour les mutations agent, ajouts/suppressions, documents et reprises du journal ; listings autonomes et brouillons non enregistrés non couverts. Pas de labels utilisateur, restauration de fragment ou de projet entier. Pas de qualification Windows/macOS, panne électrique ni course interprocessus ; les limites de l’ADR 0022 restent applicables. Ni R2, ni J1-03, ni ACC-02 ne sont clos.

Suite prioritaire : récupération des brouillons et watcher externe, avant les changements de branche Git ; extension des checkpoints aux mutations agent.
