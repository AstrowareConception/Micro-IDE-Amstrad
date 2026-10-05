# Reprise des mutations agent — alpha 0.21

Suite R2/J5. [ADR 0026](../adr/0026-journal-durable-des-mutations-agent.md), [roadmap](../specifications/17-roadmap-ide-complet.md).

## Utilisation

Les outils agent existants (remplacement, création, renumérotation) et le bouton de restauration de la mission courante passent par le même journal durable des sources/manifeste. Aucune confirmation supplémentaire pendant une mission autorisée. Avant écriture, le candidat complet est vérifié ; une destination occupée refuse toute mutation. Après publication du journal, une interruption bloque les opérations projet et conserve les versions pour reprise.

Rouvrir le dossier : le dialogue natif indique les sources/manifeste concernés. **Annuler** conserve tout et laisse le projet précédent ouvert. **Terminer la mutation agent** applique le snapshot préparé, avec création/déclaration éventuelle d’une source. **Rétablir les versions avant mutation** revient aux octets précédents, y compris CRLF, et retire un fichier dont la création était prévue par cette mutation. Une modification externe inconnue, y compris pendant la confirmation, refuse la reprise. Aucun appel API ni redémarrage automatique de mission.

Dans **Historique local**, retrouver **Avant mutation agent** et **Version proposée par l’agent** pour la source actuelle. Diff et restauration de buffer avec Ctrl Z restent disponibles ; une sauvegarde explicite écrit ensuite le buffer. Les versions proposées sont conservées même si une reprise choisit l’ancien état. Une source créée puis retirée reste archivée, mais le panneau ne permet pas encore de recréer une source absente du manifeste. L’historique source ne restaure pas le manifeste.

## Stockage et confidentialité

`.microide/agent-journal/current.json` contient versions avant/après avec SHA-256/base64, date, UUID, projet et phase pending/committed/restored. Un seul record courant ; snapshots de sources dans l’historique commun (20 / 64 Mio). Pas de prompt, clé, document ou ROM dans ce record. Le diagnostic de mission existant sous userData reste distinct, privé et sans navigateur de récupération de mission. Les dépôts créés dans l’IDE excluent `.microide` ; vérifier cette exclusion pour un dépôt existant. Aucun journal n’est ajouté au DSK ou au contexte IA automatiquement.

Bornes : 64 Kio/version/source, 256 Kio/ensemble, manifeste 1 Mio/version, JSON 4 Mio ; propriétés, identité et chemins strictement contrôlés. Les temporaires interrompus restent conservés et ne deviennent pas des transactions. Une copie corrompue/future, un lien ou un conflit n’est ni effacé ni réparé automatiquement.

## Vérification et limites

139 tests Node, dont sept nouveaux : onze vrais arrêts SIGKILL sur le chemin de mutation/restauration de production, reprise dans les deux sens, marqueur final, conflits, révisions/corruption/liens/hardlinks, déplacement, temporaires, blocs pending et tailles. Les tests contrôlent les frontières via hooks filesystem dans le processus enfant de test ; aucun hook/mode de simulation ajouté au produit. Les sept arrêts antérieurs de sauvegarde/brouillons restent testés. Typecheck/build desktop, smoke navigateur et schémas/documentation vérifiés selon résultats de PR.

La recette Electron native couvre Annuler par défaut, Terminer sources+manifeste+création, diff historique, Rétablir CRLF/retrait de création et conflit apparu pendant la confirmation. Les parcours agent avec Responses contrôlé restent exercés, sans API réelle facturée. Capture `out/agent-durability-alpha.png`, artefact Desktop editor sept jours ; résultats natifs attestés dans la PR.

Qualification arrêt de processus Linux ; pas de promesse panne électrique, verrou interprocessus, réseau FS ou Windows/macOS. Pas de reprise automatique de conversation, pause/reprise fournisseur ou restauration intégrale d’une ancienne mission après relancement. Les buffers non enregistrés restent distincts : une reprise disque ne récupère pas automatiquement les brouillons initiaux de mission. L’option de copie de brouillons et le diagnostic privé restent des moyens séparés. Les ajouts humains/imports ne sont pas encore journalisés ainsi. R2/IDE-007/008/009/010 et les scénarios globaux restent partiels ; la suite prioritaire est identité/commit Git local.
