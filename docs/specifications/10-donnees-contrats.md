# 10 — Données, persistence et contrats

## Dossier de projet

Un projet est un dossier contenant `microide.project.json`, des sources dans `src`, des originaux dans `documents`, des recettes et fichiers CPC dans `assets`. Les sorties de construction peuvent être dans `dist`, exclu de Git et jamais réimporté implicitement. `.microide` contient cache, journal de récupération et historique local choisis ; il n'est pas requis pour reconstruire le projet. La configuration de clé et les ROM restent dans les données applicatives de l'hôte.

Les noms de dossiers sont des conventions, pas un moyen de contourner les permissions : le manifeste énumère les fichiers autorisés. Les sources doivent être sous `src/`, les ressources sous `assets/`, les documents sous `documents/` au MVP. Les chemins sont relatifs, utilisent `/`, n'ont ni segment vide, ni `.`/`..`, ni préfixe absolu, lettre de lecteur ou UNC. Les caractères interdits des hôtes visés et collisions par casse sont contrôlés à l'import. Un contrôle par regex seul ne protège pas contre liens symboliques et jonctions ; le service fichier vérifie la résolution réelle.

## Manifeste version 1

Le [schéma de projet](../../contracts/project.schema.json) constitue le contrat structural. `schemaVersion` est entier, actuellement 1. `projectId` est stable et indépendant du chemin. `target` identifie profil et dialecte. `entryPoint` référence l'identifiant d'une source, pas un chemin libre. Chaque source possède identifiant, chemin et nom CPC. Les ressources déclarent type, sortie, nom CPC et métadonnées de chargement ; les documents portent rôle et empreinte de l'original.

La configuration de construction fixe format disque, système de fichiers, encodage, fin de ligne, EOF et ordre de fichiers. Une future version peut ajouter des codecs sans changer silencieusement l'interprétation de ces champs. Une option inconnue est une erreur dans la version courante. Le schéma refuse les propriétés supplémentaires pour rendre les changements explicites.

Le JSON Schema ne peut pas, à lui seul, prouver existence d'un fichier, unicité par un champ au sein d'un tableau, référence d'entrée valide ou droits d'accès. L'application contrôle ces invariants : identifiants uniques, chemins uniques, noms CPC uniques, entrée appartenant aux sources, profils compatibles, présence des fichiers, empreintes, recettes et régions mémoire sans débordement. Le vérificateur documentaire exerce aussi les invariants de l'exemple livré.

## Empreintes et révisions

`ContentHash` est SHA-256 sur les octets du contenu concerné. Pour une source, base64/UTF-8 ou normalisation différente ne doivent pas changer implicitement l'objet haché : le fichier source canonique est UTF-8 LF, sans BOM. L'empreinte précondition d'un remplacement désigne ces octets de source, pas la sortie CRLF CPC. Les originaux importés sont hachés sans transformation.

Une `projectRevision` est un compteur de révisions applicatives persistées dans l'état local ; il suffit à l'UI pour invalider une réponse, mais les empreintes vérifient le contenu réel et les modifications externes. Le compteur ne figure pas obligatoirement dans le manifeste partagé, afin de ne pas produire des conflits sans effet sur le programme. L'empreinte d'entrée de construction découle d'une représentation canonique documentée des paramètres et empreintes pertinentes, avec version d'algorithme. Une révision de projet n'est pas un commit Git.

## Sauvegarde et récupération

Édition manuelle : état dirty, sauvegarde explicite ou autosave activée par préférence. Un journal de récupération après frappe est debounced et indépendant de la sauvegarde. Lors d'une transaction multifichier : écrire journal avec base et destinations, écrire temporaires, vérifier, remplacer fichiers, marquer transaction complète puis purger. Si l'application s'arrête entre deux remplacements, le prochain démarrage propose finalisation ou restauration à partir du journal, et ne déclare pas un projet cohérent prématurément.

Un verrou applicatif évite deux instances écrivantes dans le même dossier. Une seconde instance ouvre en lecture seule ou passe par un changement de propriétaire explicite. Les watchers ignorent les writes identifiés de l'application mais détectent le contenu réel, pas uniquement les dates. Un antivirus ou un fichier verrouillé peut retarder un remplacement : l'échec laisse anciennes versions et journal exploitables.

## Mission agentique

Le [schéma de mission](../../contracts/agent-task.schema.json) définit le mode, le périmètre, les outils, les budgets, le corpus et l'état. Les identités d'outils sont une liste fermée ; l'adaptateur fournisseur n'ajoute pas des outils d'après le contenu d'un prompt. Les chemins de lecture/transmission ne sont pas des chemins d'écriture. Les documents et références sont en lecture seule ; les sources et sorties générées sont mutables selon la mission.

Les préfixes transmissibles doivent appartenir au périmètre lisible. Une ressource sous `documents/` doit aussi être identifiée dans `documentIds` ; un préfixe ne contourne pas cette sélection. Tous les outils de lecture, y compris la lecture générique de fichier, appliquent cette intersection. Les sorties d'assets créées par l'agent résident sous `assets/generated/`. Le scope et la liste d'outils sont validés par règles métier en complément du JSON Schema.

Le journal local `.microide/tasks/<taskId>` contient checkpoints et résultats d'outils. Il est exclu du projet partagé et ne stocke pas de secret. Les résultats de mutation portent callId, transactionId, révision et empreintes. Les checkpoints contiennent les contenus nécessaires à une restauration, avec quota et purge contrôlée. Un checkpoint référencé par une tâche active n'est pas supprimé automatiquement.

La réponse modèle est un flux de textes et d'appels d'outils ; le runner attend des arguments complets, valide chaque appel et journalise avant mutation. Une perte réseau ne doit pas réexécuter une mutation confirmée. La reprise vérifie le journal de fichiers et les hashes réels avant de continuer. Le compteur de révisions avance avec les étapes réussies ; la base de départ reste disponible pour le diff cumulé.

## Proposition IA — mode Revue

Le [schéma IA](../../contracts/ai-proposal.schema.json) définit `schemaVersion`, `proposalId`, `requestId`, `baseProjectRevision`, `summary`, `assumptions`, `operations`, `explanation`. Chaque opération est `create` ou `replace`, porte un chemin sous `src/`, le contenu complet et, pour remplacer, `baseSha256`. Les opérations de fichiers ressources pourront être ajoutées dans un contrat suivant après définition de leurs limites ; ce contrat de proposition porte le texte BASIC. Le mode Agent de J5 manipule aussi les ressources via les outils dédiés, distincts de ce schéma.

Limites locales : au plus 10 fichiers proposés, 256 K caractères par source et 1 Mio d'octets de texte au total. Le schéma borne la taille en caractères ; le service valide aussi les octets. Des sorties trop longues sont rejetées, pas tronquées. Les identifiants ont une syntaxe bornée, les chemins ne se répètent pas et le `requestId` doit correspondre à la requête active. Le schéma fournisseur est une aide, jamais la seule validation locale.

L'IA ne crée pas automatiquement une source inconnue dans le manifeste : le cas d'usage d'application présente la création et ajoute sa déclaration avec nom CPC choisi ou validé. Cette mise à jour est réalisée par l'application dans la même transaction, pas par une opération arbitraire renvoyée par le modèle.

## Rapport de construction

Le [schéma rapport](../../contracts/build-report.schema.json) fixe version, identifiant, nature `actual|illustrative`, statut, révision, empreinte d'entrée, profil, outils, catalogue, métriques, diagnostics et artefacts. Les empreintes d'artefacts sont des octets effectivement produits. Une construction `failed` ou `cancelled` n'a pas d'artefact valide. Un succès possède au moins le DSK et ne contient pas d'erreur bloquante.

`not-run` est réservé aux exemples `illustrative` du dossier de conception. L'application n'émet pas une réussite avec ce statut. [L'exemple de rapport](../../examples/build-report.json) expose des attentes de géométrie et aucun artefact, pour ne pas présenter une exécution inventée. La métrique `usableBytes` est capacité du format ; `allocatedBytes` est consommation des fichiers, quand connue. `basicMemoryEstimate` reste nullable et accompagnée d'hypothèses dans un rapport réel.

## Protocoles internes

| Commande | Entrées pertinentes | Retour |
| --- | --- | --- |
| `project.create/open/save` | Handle dossier, manifeste ou version document | Snapshot, révision, diagnostics |
| `language.analyze/renumber` | Document + version, dialecte, options | Diagnostics ou plan de transformation |
| `build.prepare/run` | Révision, sélection de ressources | Rapport + handles d'artefacts |
| `emulator.start/control` | Profil, build handle, commande | Session et observation |
| `asset.import/convert` | Handle choisi, recette | Métadonnées, preview, sortie |
| `agent.start/steer/pause/resume/cancel` | Mission, consigne, budget | Activité, appels, checkpoints et bilan |
| `ai.prepare/send/cancel` | Contexte accepté en mode Revue, modèle, requestId | Événements de texte puis proposition |
| `proposal.apply/undo` | Proposition + préconditions, sélection | Transaction appliquée ou conflit |
| `export.build/session` | Handle artefact/session, destination choisie | Chemin final et empreinte |

Enveloppe : `protocolVersion`, `requestId`, nom de commande, payload validé. Réponses : résultat ou erreur avec code stable, message français, détails publics et éventuel `retryable`. Les blobs sont des handles scoped à la session de projet avec durée de vie bornée. Les événements portent leur révision ; l'UI élimine les événements obsolètes. Une commande renderer ne désigne jamais une URL fournisseur à joindre ou un exécutable à lancer.

## Migrations et partage

### Contrat livré `project:save-all` — alpha 0.16

La route IPC alpha, distincte de l’enveloppe cible ci-dessus, reçoit `{sessionId, sources:[{id,source}]}` : session de projet courante, exactement les 1–64 identifiants déclarés, aucun doublon, 1 Mio UTF-8/source et 8 Mio au total, sans BOM/NUL. Aucune destination n’est fournie. Tous les chemins, octets originaux et empreintes sont résolus dans le main.

Succès : `{name,savedIds,changedCount}` ; `savedIds` contient toutes les sources vérifiées du snapshot (y compris inchangées), `changedCount` compte uniquement celles remplacées. Échec : `{error}` ; le renderer ne marque aucun buffer enregistré. Les erreurs après écriture déclenchent une compensation en mémoire, conditionnée aux octets encore présents ; une restauration incomplète bloque la session du ProjectStore. Les écritures conservent le manifeste. Cette route n’est ni un journal durable ni une transaction atomique de projet ; [ADR 0021](../adr/0021-enregistrer-tout-compensation.md).

### Journal local livré — alpha 0.17

L’ADR 0022 complète le contrat save-all 0.16 : journal `.microide/save/pending.json` version 1, transaction et projet UUID, SHA-256 du manifeste exact, date, phase `pending/committed/rolled-back`, toutes les sources `{id,path,before,after,beforeHash,afterHash}`. Avant/après sont des octets UTF-8 en base64 canonique ; le lecteur vérifie cardinalité, budgets, hash et chemins déclarés. Ce format local privé ne modifie pas le manifeste ni le DSK et n’est pas un format de partage.

La récupération n’ajoute pas de route renderer à chemins libres : le main intervient dans `project:open` après sélection native, inspecte puis confirme un choix, vérifie UUID/révision du journal, manifeste et toutes les sources, puis ouvre normalement. Annulation → null ; conflit/corruption/version inconnue → erreur, données conservées. [ADR 0022](../adr/0022-journal-sauvegarde-et-reprise.md). Ce mécanisme ne journalise pas encore les autres mutations.

### Historique local livré — alpha 0.18

`.microide/history/<UUID>.json` v1 conserve UUID snapshot/projet, date ISO, raison before-save/after-save et sources `{id,path,sha256,content}` en base64 canonique. Budgets/rétention : 1 Mio/source, 8 Mio/snapshot, 12 Mio JSON/fichier, 20 snapshots/64 Mio cumulés. [ADR 0023](../adr/0023-historique-local-et-restauration-buffer.md).

Routes `history:list({sessionId})` → `HistorySnapshot[]` (UUID, révision SHA du fichier exact, date, raison, métadonnées sources sans contenus) et `history:version({sessionId,snapshotId,id,revision})` → `HistoryVersion` (mêmes références, path/sha256 et source LF). Erreur → `{error}`. Sessions et IDs sont contrôlés côté main ; jamais de chemin hôte fourni. La restauration est une opération de buffer guardée, pas une route d’écriture disque. Enregistrer actif utilise désormais le contrat journalisé save-all sur un snapshot de fichiers disque avec remplacement du seul actif.

### Copie de brouillons livrée — alpha 0.19

`.microide/drafts/current.json` v1 : `{version,id,projectId,manifestHash,createdAt,files:[{id,path,base,baseHash,draft,draftHash}]}`, base/draft en base64 canonique. Budgets 1 Mio/version/source, 8 Mio par ensemble, 24 Mio JSON, 64 sources et huit temporaires conservés maximum. [ADR 0024](../adr/0024-copie-brouillons-et-reprise-buffers.md).

Routes liées à la session : `drafts:status({sessionId})` → `{revision,snapshot}` (nullable, métadonnées seules), `drafts:capture({sessionId,sources:[{id,source}],revision})` → même résumé, `drafts:read({sessionId,revision})` → `{revision,files:[{id,path,base,source}]}` en LF, `drafts:forget({sessionId,revision})` → résumé après confirmation native annulée par défaut. Erreur → `{error}`. Les IDs/chemins/bases sont résolus dans le main, jamais fournis comme destinations renderer. Le record vide signifie effacement explicite. Aucune route ne remplace une source BASIC pour reprendre un brouillon.

### Formats futurs de partage

Une migration est une fonction version N → N+1, testée sur fixtures, avec sauvegarde avant modification et rapport. Aucun downgrade implicite. Une version future inconnue peut être inspectée sans écriture si son contenu est accessible ; l'utilisateur ne reçoit pas une réécriture destructrice dans le schéma 1. Les versions de recette et de moteur évoluent séparément de la version de manifeste.

Partager un projet inclut manifeste, sources et ressources nécessaires ; documents de contexte sont sélectionnés, conversation et historique local exclus par défaut. Une archive future exige règles anti-traversal et quotas avant extraction. Le DSK exporté reste indépendant de ce partage et ne contient que son catalogue. Les formats publics pourront être documentés sans dépendre du code interne de l'UI.

## Inspection externe alpha 0.20

`external:status(sessionId)` retourne au plus 64 sources déclarées modifiées (`id`, `path`, SHA-256 `revision`) ou illisibles (`issue`). `external:read(sessionId,id,revision)` retourne texte LF, révision disque et `baseRevision` connue. `external:accept(sessionId,id,revision,baseRevision)` recontrôle manifeste/journal/version/base puis adopte la base en mémoire ; aucun fichier écrit. Session liée à la fenêtre et mêmes gardes main que les autres ports. Le renderer met à jour la référence enregistrée et conserve son buffer, ou applique le texte via les opérations Monaco guardées/undo. [ADR 0025](../adr/0025-revue-des-modifications-externes.md).

## Journal de mutation agent alpha 0.21

Record local privé v1 `.microide/agent-journal/current.json` : UUID/projet/date/phase, manifeste avant/après et union des sources avec contenu base64/SHA-256 ; null signifie absence prévue. Phases pending/committed/restored. Versions UTF-8, manifeste 1 Mio/version, sources 64 Kio/version et 256 Kio/ensemble, record 4 Mio. Lecture/reprise en main, aucun chemin libre renderer ; choix natif à l’ouverture. Révision SHA-256 des octets exacts du record contrôlée pendant la reprise. Historique source étend les raisons à `before-agent` et `after-agent` (version préparée, pas preuve d’application). [ADR 0026](../adr/0026-journal-durable-des-mutations-agent.md).
