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

## Proposition IA

Le [schéma IA](../../contracts/ai-proposal.schema.json) définit `schemaVersion`, `proposalId`, `requestId`, `baseProjectRevision`, `summary`, `assumptions`, `operations`, `explanation`. Chaque opération est `create` ou `replace`, porte un chemin sous `src/`, le contenu complet et, pour remplacer, `baseSha256`. Les opérations de fichiers ressources pourront être ajoutées dans un contrat suivant après définition de leurs limites ; J5 limite l'IA au texte BASIC.

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
| `ai.prepare/send/cancel` | Contexte accepté, modèle, requestId | Événements de texte puis proposition |
| `proposal.apply/undo` | Proposition + préconditions, sélection | Transaction appliquée ou conflit |
| `export.build/session` | Handle artefact/session, destination choisie | Chemin final et empreinte |

Enveloppe : `protocolVersion`, `requestId`, nom de commande, payload validé. Réponses : résultat ou erreur avec code stable, message français, détails publics et éventuel `retryable`. Les blobs sont des handles scoped à la session de projet avec durée de vie bornée. Les événements portent leur révision ; l'UI élimine les événements obsolètes. Une commande renderer ne désigne jamais une URL fournisseur à joindre ou un exécutable à lancer.

## Migrations et partage

Une migration est une fonction version N → N+1, testée sur fixtures, avec sauvegarde avant modification et rapport. Aucun downgrade implicite. Une version future inconnue peut être inspectée sans écriture si son contenu est accessible ; l'utilisateur ne reçoit pas une réécriture destructrice dans le schéma 1. Les versions de recette et de moteur évoluent séparément de la version de manifeste.

Partager un projet inclut manifeste, sources et ressources nécessaires ; documents de contexte sont sélectionnés, conversation et historique local exclus par défaut. Une archive future exige règles anti-traversal et quotas avant extraction. Le DSK exporté reste indépendant de ce partage et ne contient que son catalogue. Les formats publics pourront être documentés sans dépendre du code interne de l'UI.
