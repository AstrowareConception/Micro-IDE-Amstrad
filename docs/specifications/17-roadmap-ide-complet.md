# 17 — Roadmap qualifiée d’un IDE CPCéleste abouti

Référence produit : 4 octobre 2026, état de départ alpha 0.14. Responsable : Térence FERUT / AstroWare Conception. Cette liste constitue le backlog produit à réaliser, pas une annonce de capacités futures déjà disponibles. La [feuille de route technique J0–J6/JG](12-feuille-de-route.md) reste la référence des dépendances d’architecture ; ce document précise les fonctionnalités et l’ordre de travail à la demande produit. Il remplace les listes succinctes « prochaine étape » des messages et guides historiques, sans effacer leurs preuves.

## Qualification et priorités

**L** : livré dans le périmètre étroit décrit, avec guide/test ; **P** : partiellement livré, travail restant explicité ; **N** : non réalisé ; **B** : réalisation/qualification dépendante d’un prérequis indisponible ou reporté. Aucun pourcentage global n’est déduit de ces états.

**P0** : indispensable à un IDE utilisable et à la protection du travail ; **P1** : socle attendu d’une version 1.0 cohérente ; **P2** : enrichissement après qualification du socle. Une priorité élevée n’annule pas une dépendance. **FW** : jeu firmware autorisé + go J0 ; **DUR** : durabilité/reprise qualifiées ; **NET** : transports Git/credentials qualifiés ; **WIN** : recette Windows propre.

Chaque ligne a un identifiant stable `IDE-*`, une capacité, un état, une priorité, un prérequis et un résultat vérifiable. Ces identifiants sont du backlog ; les exigences normatives et scénarios ACC restent définis aux documents 01/11 et seront étendus avec les réalisations correspondantes. « Livré » ne signifie pas qualifié Windows/macOS ni parser BASIC complet. Les preuves actuelles sont dans les [guides de réalisation](../README.md) et PR 4–15 ; tests ROM/OpenAI réels reportés à la demande du produit.

## 1. Projet et fichiers

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-001 | Créer/ouvrir un projet portable, manifeste et cible explicites | P | P0 | J1 | Déplacement/reprise sans perte ; migrations et versions inconnues conservées |
| IDE-002 | Explorateur sources/documents/ressources, filtre et états dirty/Git | P | P1 | IDE-001 | Sélection exacte ; aucune confusion entre original/document/artefact |
| IDE-003 | Ajouter, renommer, déplacer, supprimer des sources proprement | P | P1 | DUR | Manifeste cohérent ; collision/lien/annulation sans perte ; ajout seul livré |
| IDE-004 | Onglets, fermeture individuelle/tout/autres et fichiers épinglés | P | P1 | DUR | Brouillon arbitrable ; ordre et vue conservés ; onglets chargés déjà livrés |
| IDE-005 | Projets récents, modèles hello/graphismes/jeu et assistant de démarrage | N | P1 | IDE-001 | Chemins périmés gérés ; exemples fonctionnels sous profil qualifié |
| IDE-006 | Import listings ASCII/tokenisés et projets anciens | N | P2 | Codecs | Roundtrip et encodages CPC ; original jamais écrasé |

## 2. Sauvegarde, récupération et historique local

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-007 | Sauvegarder fichier actif, Enregistrer tout et conflits externes | P | P0 | J1-03 | 0.18 : actif/global partagent journal/historique et préconditions ; autres mutations et plateformes à qualifier |
| IDE-008 | Journal et reprise après crash de sauvegarde multifichier | P | P0 | IDE-007 | 0.17 : journal versionné, deux choix, SIGKILL Linux, conflits/revisions ; autres mutations, Windows et panne électrique encore non qualifiés |
| IDE-009 | Historique local durable indépendant de Git | P | P0 | IDE-008 | 0.18 : snapshots avant/après, 20/64 Mio, persistance/déplacement ; labels et autres mutations à venir |
| IDE-010 | Diff et restauration de fichier/fragment/version locale | P | P0 | IDE-009 | 0.18 : diff Monaco, buffer/revision/disque guards, undo et sauvegarde explicite ; fragments/projet entier à venir |
| IDE-011 | Autosauvegarde optionnelle et récupération des brouillons | P | P1 | DUR | 0.19 : copie opt-in/2 s/15 s, SIGKILL, reprise sélective/undo sans faux enregistré ; listings/réglages/plateformes à qualifier |
| IDE-012 | Watcher externe et rechargement/comparaison contrôlés | P | P1 | DUR | Notifications bornées ; dirty conservé ; rename/delete et clients Git testés |

## 3. Édition et compréhension de Locomotive BASIC

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-013 | Coloration, complétion contextuelle, aide sourcée | P | P0 | Corpus 15 | Fiches exhaustives et cas opaques/dialectes qualifiés ; sous-ensemble livré |
| IDE-014 | Lexer/parser et diagnostics fiables avec provenance | P | P0 | IDE-013 | Corpus réel, erreurs certaines vs avertissements ; aucune validation inventée |
| IDE-015 | Navigation définitions/cibles, usages et symboles BASIC | P | P1 | IDE-014 | F12 littéral livré ; lignes, variables, fonctions et usages calculés distingués |
| IDE-016 | Renumérotation sûre, plages et références | P | P0 | IDE-014 | Cibles couvertes réécrites ; formes ambiguës bloquées ; undo livré |
| IDE-017 | Renommage sémantique de variables/fonctions | N | P1 | IDE-014 | Suffixes/types, portée et chaînes/DATA/commentaires préservés |
| IDE-018 | Templates/snippets, insertion de lignes et conventions | N | P1 | IDE-014 | Numéros sans collision ; génération minimale conforme au profil |
| IDE-019 | Formatage optionnel et inspections/corrections ciblées | N | P2 | IDE-014 | Sémantique inchangée ; aperçu ; aucune casse/espacement opaque détruit |
| IDE-020 | Multi-curseurs, pliage, signets, navigation retour/avance | P | P1 | Monaco | Gestes repris explicitement en recette, sessions conservées ; capacité Monaco seule insuffisante |

## 4. Recherche et transformations textuelles

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-021 | Recherche/remplacement dans le listing | L | P0 | 0.14 | Monaco via menus/Ctrl F/H ; buffers/undo préservés |
| IDE-022 | Recherche globale des sources, y compris brouillons | P | P0 | IDE-001 | 0.15 : littéral/casse/mot, résultats/navigation et budgets ; filtres de chemins et scopes configurables restent ouverts |
| IDE-023 | Remplacement multifichier avec aperçu et préconditions | P | P1 | IDE-022 | 0.15 : fichiers choisis, aperçu borné, contrôle de contenu, aucune écriture implicite, undo par fichier ; aperçu diff complet et occurrences choisies restent ouverts |
| IDE-024 | Regex, exclusions et recherche structurelle BASIC | N | P2 | IDE-014/022 | Regex isolée/bornée ; chaînes et symboles distingués ; pas de regex hostile sur UI |
| IDE-025 | Recherche dans documents, assets et références | P | P1 | J4/Corpus | Outils agent TXT/MD/PDF livrés ; UI globale/filtrage/provenance à compléter |

## 5. Interface, outils et préférences

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-026 | Menus, palette, ouverture rapide, contextes CPC | L | P1 | 0.14 | Clavier, source ciblée, états désactivés et tests navigateur/Electron |
| IDE-027 | Panneaux redimensionnables, masquables et disposition persistée | N | P1 | IDE-026 | Petites fenêtres lisibles ; raccourci de restauration de layout |
| IDE-028 | Préférences police, thèmes clair/sombre, keymap | P | P1 | IDE-026 | Zoom/minimap session livrés ; persistance/migration et contraste à qualifier |
| IDE-029 | Centre de notifications, journal de tâches et annulation | P | P1 | J1/J5 | Opérations identifiées, erreurs actionnables, aucun secret dans logs |
| IDE-030 | Accessibilité, focus, lecteur écran et français/anglais | P | P0 | J6 | Parcours complet au clavier ; audits contraste/annonces/focus ; UI française livrée |

## 6. Git, versions et GitHub

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-031 | Découverte Git, init, exclusions, statut et diff | P | P0 | 0.12/13 | Sous-ensemble conservateur livré ; worktrees/configs usuelles à qualifier |
| IDE-032 | Index fichier/fragment et listes de changements | P | P0 | IDE-031 | Par fichier livré ; staging partiel, renommages/conflits et changelists à traiter |
| IDE-033 | Identité locale, aperçu et commit exact de l’index | P | P0 | IDE-032 | HEAD/index figés, fichiers privés exclus, hooks/signature explicites, premier commit |
| IDE-034 | Historique Git, diff de version, blame et restauration guidée | P | P1 | IDE-031/DUR | Pagination 0.14 livrée ; version/source/diff/blame/restauration à ajouter |
| IDE-035 | Branches locales, checkout, tags et stash | N | P1 | IDE-033/DUR | Dirty/conflicts gérés, nom/ref validés, manifeste rechargé sans perte |
| IDE-036 | Clone/remotes/upstream/fetch/pull/push HTTPS et SSH | N | P0 | IDE-033/NET | Deux clones + vrai transport ; divergence/rejet/credentials ; publication humaine |
| IDE-037 | Merge/rebase/conflits 3 versions, continue/abort | N | P1 | IDE-036/DUR | Rollback/reprise et conflits de manifestes/documents qualifiés |
| IDE-038 | Revert/cherry-pick et comparaison de branches | N | P2 | IDE-037 | Sélections exactes ; aucune réécriture publiée implicite |
| IDE-039 | GitHub : connexion, création remote, PR et checks | N | P2 | NET | OAuth/token sécurisé ; scope visible ; lien PR/CI ; Git reste utilisable sans API GitHub |

## 7. Terminal et tâches

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-040 | Terminal à commandes hôte avec sortie/arrêt | P | P1 | 0.14/WIN | Non interactif livré Linux, garde dirty/IA ; Windows/macOS encore non qualifiés |
| IDE-041 | PTY interactif, shells et sessions multiples | N | P1 | IDE-040/WIN | Resize/stdin/cancel/process trees ; SSH/REPL ; pas de capacité agent implicite |
| IDE-042 | Configurations de tâches/build, variables autorisées | N | P1 | IDE-040/J3 | Profils typés ; cwd, env et capacités explicités ; pas d’exécution automatique d’un projet ouvert |
| IDE-043 | Console CPC/BASIC distincte du shell hôte | P | P0 | FW/J3 | Entrées machine, sortie et interruptions sans confusion de clavier/plateforme |

## 8. Construction, supports et distribution CPC

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-044 | DSK DATA déterministe multifichier depuis buffers | P | P0 | J0/J3 | Codec/export livré ; résultat dans émulateur indépendant encore requis |
| IDE-045 | Rapport build, catalogue, capacité/noms 8.3 et erreurs | P | P0 | IDE-044 | Rapports visibles et source révisionnée ; quotas et erreur sans artefact ancien |
| IDE-046 | Import/inspection DSK standard/Extended et extraction | P | P1 | Codecs/DUR | Reader borné livré ; UI/import/écriture/extraction sûrs à compléter |
| IDE-047 | BASIC tokenisé, binaires AMSDOS et ressources CPC | P | P1 | Codecs/J4 | Types/EOF/adresses/checksum qualifiés ; tokenisation à construire |
| IDE-048 | Export dossier/ZIP projet, paquet CPC et README de lancement | N | P1 | J3/J4 | Projet complet avec originaux autorisés ; confidentialité ; RUN et profil exacts |
| IDE-049 | Tests reproductibles de programmes, captures de référence | P | P1 | FW | Builds sur révisions, attentes écran/sorties, limite temps et seeds |

## 9. Émulation et diagnostic CPC

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-050 | ROM locales, hashes, profils et diagnostic firmware | P | P0 | 0.7/FW | Import/vérification livrés ; vrais jeux/boot/droits qualifiés |
| IDE-051 | Moteur CPC 6128 intégré en worker, boot/run/reset/pause | P | P0 | FW/J0 | Boot BASIC réel, RAM/banques, temps/audio/vidéo et disque vérifiés |
| IDE-052 | Clavier/focus, joystick, écran pixel net et audio | P | P0 | IDE-051 | Relâchement touches, ESC et retour focus ; captures non altérées |
| IDE-053 | Disque mutable, OPENOUT, sauvegarde et export session | P | P0 | IDE-051 | Écriture relue par émulateur indépendant ; original DSK intact |
| IDE-054 | Breakpoints/pas à pas BASIC, variables et pile | B | P2 | FW/Instrumentation | État réel expliqué, pas de debugger simulé ; limites ROM visibles |
| IDE-055 | Mémoire, banques, désassemblage Z80 et snapshots | B | P2 | IDE-051 | Adresses/mappage/snapshots exacts, restauration révisionnée |
| IDE-056 | CPC 464/664 puis Plus et autres Amstrad | N | P2 | Profils qualifiés | Recette propre à chaque machine ; aucun support déduit du seul 6128 |

## 10. Images, son, sprites et pièces jointes

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-057 | Bibliothèque TXT/MD/PDF/images originale et portable | P | P0 | J4 | Imports livrés TXT/MD/PDF texte/PNG/JPEG ; quotas/hashes ; partage complet à traiter |
| IDE-058 | PDF rendu/pages, OCR explicite, annulation et WebP/EXIF | N | P1 | IDE-057 | Documents difficiles, budgets/isolation ; aucune extraction inventée |
| IDE-059 | Convertisseur écran modes 0/1/2, palette/tramage/cadrage | N | P1 | J4/Codecs | Recette déterministe, mire exacte, SCR/AMSDOS relus sur CPC qualifié |
| IDE-060 | Éditeur sprites/tilemaps et caractères personnalisés | N | P2 | IDE-059 | Données et code d’intégration concordants ; aperçu et export vérifiés |
| IDE-061 | Sons/enveloppes AY et outils de données BASIC | N | P2 | Corpus/FW | Paramètres BASIC conformes ; aperçu réel, données reproductibles |

## 11. Agent IA intégré

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-062 | Mission agent : explorer/créer/coder/construire/corriger | P | P0 | 0.6/J5 | Boucle/outils livrés ; vrai OpenAI, reprise et exécution CPC à qualifier |
| IDE-063 | Références BASIC et ressources progressivement consultées | P | P0 | Corpus/J4 | Provenance/fiches/outils livrés ; couverture du langage/vision réelle à qualifier |
| IDE-064 | Diff, checkpoints, undo mission, steering et budgets | P | P0 | DUR/J5 | Mission courante livrée ; reprise durable/rejeu/crash et restitution complète |
| IDE-065 | Clé API protégée, coffre système, choix modèles/coûts | P | P0 | J5/WIN | Clé mémoire livrée ; coffre, modèle/capacités et consommations vérifiées |
| IDE-066 | Modes Revue/Explication, contexte sélection/diagnostics | N | P1 | IDE-064 | Droits distincts, pas de mutation en explication, revue optionnelle |
| IDE-067 | Outils ressources/émulation/tests et corrections observées | B | P0 | FW/J4 | Exécution réelle, observations sourcées, budgets et arrêt/reprise |
| IDE-068 | Git agent limité et publication humaine | N | P2 | IDE-033/NET | Scope distinct ; pas de shell libre, push/PR jamais approuvés par le modèle |
| IDE-069 | Fournisseur alternatif/local et travail offline | N | P2 | Contrats qualifiés | Domaines indépendants du fournisseur ; dégradation utile sans IA |

## 12. Fiabilité, sécurité, livraison et aide

| ID | Fonction et qualification | État | Priorité | Dépendance | Critère de validation |
| --- | --- | --- | --- | --- | --- |
| IDE-070 | IPC, liens/chemins, documents inertes, budgets et secrets | P | P0 | Tous | Frontières déjà testées ; audit complet plateformes/codecs avant 1.0 |
| IDE-071 | Tests unitaires, intégration, Electron et matrice Windows/Linux/macOS | P | P0 | WIN/J6 | CI Linux livrée ; installation Windows propre, plateformes annoncées exactes |
| IDE-072 | Installateurs, signatures, notices et mises à jour contrôlées | N | P0 | IDE-071 | Installation/désinstallation/upgrade sans perte ; attestations et licences |
| IDE-073 | Performance, gros projets, travailleurs et accessibilité mesurées | P | P0 | J6 | Budgets mesurés sur matériel cible ; aucun gel UI ; limites visibles |
| IDE-074 | Guides intégrés, onboarding, exemples et diagnostic support | P | P1 | IDE-071 | Guides français livrés ; aide in-app/export diagnostic expurgé et exemples CPC qualifiés |
| IDE-075 | Identité CPCéleste, icônes et cohérence visuelle | L | P1 | PR 14 | Nom/logo intégrés, charte disponible ; déclinaisons packaging à compléter avec IDE-072 |

## Ordre des lots à réaliser

| Lot | Portée | Sortie attendue et justification |
| --- | --- | --- |
| R1 — Navigation et édition de projet | IDE-022/023, IDE-020 partiel | Recherche/remplacement sources avec aperçu et undo ; gain immédiat, sans ROM ni écriture disque |
| R2 — Sécuriser le travail | IDE-007/008/009/010/011/012 | 0.19 ajoute copie/récupération opt-in des brouillons ; suite watcher externe et autres mutations, avant checkout |
| R3 — Git local complet | IDE-033/034 puis IDE-035 | Commits exacts et versions inspectables ; durabilité avant mutations de branches |
| R4 — Connexion Git et GitHub | IDE-036/037, puis IDE-039 | HTTPS/SSH et conflits ; confirmations de publication ; pas de faux support via terminal |
| R5 — Langage et confort | IDE-013/014/015/017/018, IDE-002/004/027/028 | Références/parser renforcés, outils et layout utiles ; incréments parallèles conceptuellement, pas obligation d’agents multiples |
| R6 — Qualification et boucle CPC | IDE-050 à 053, IDE-043/044/045/049 | FW/J0 requis ; priorité P0 dès prérequis disponibles ; aucune date artificielle |
| R7 — Ressources et agent complet | IDE-057/058/059, IDE-062 à 067 | Création multimodale et correction sur observations CPC réelles ; recettes OpenAI choisies |
| R8 — Livraison 1.0 | IDE-030/070 à 074 | Windows prioritaire, sécurité, accessibilité, performances, installeur et aide |
| R9 — Outils avancés | IDE-006/019/024/038/041/054/055/056/060/061/068/069 | PTY en incrément indépendant dès dépendance viable ; debugger/assembleur/extensions seulement sur preuves |

L’ordre R1–R3 ajuste la priorité précédente « Git puis recherche » : finir d’abord l’édition globale utile, ensuite les garde-fous de durabilité, puis les commits/restaurations. R6 n’attend pas mécaniquement R5 si les ROM et recettes deviennent disponibles. Tous les P0 ouverts doivent être traités ou explicitement dérogés avant 1.0 ; le tableau n’autorise pas un MVP sans émulation et IA.

## Suivi et définition de terminé

À chaque incrément : actualiser les lignes touchées avec version/PR/preuve, mettre à jour document 12/guide/ADR si nécessaire, tester le périmètre complet affecté, publier puis fusionner après checks verts. Aucun feature flag/case cochée ne constitue une preuve. Les listes initiales restent une photographie ; seule une nouvelle qualification peut changer P/N/B en L.

R1 a commencé en alpha 0.15 : recherche dans buffers chargés, navigation exacte, options explicites, refus de contenu périmé, aperçu borné des remplacements, fichiers choisis seulement, aucune sauvegarde implicite et Ctrl Z propre à chaque fichier. [Guide et recette](../implementation/search-alpha.md), [ADR 0020](../adr/0020-recherche-sources-et-remplacement-buffers.md). Les regex, refactorings sémantiques et documents privés sont exclus de ce premier sous-ensemble. IDE-022/023 restent P : filtres/scopes et revue complète restent à enrichir. La prochaine priorité structurante est R2, sauvegarde coordonnée, journal et historique local durable.

Sources d’inspiration, consultées le 4 octobre 2026 : [recherche projet JetBrains](https://www.jetbrains.com/help/idea/finding-and-replacing-text-in-project.html), [historique local JetBrains](https://www.jetbrains.com/help/idea/local-history.html). L’historique local est distinct de Git ; l’objectif est un IDE adapté au CPC, pas une reproduction exhaustive de tous les produits JetBrains.

## Avancement R2 — alpha 0.16

IDE-007 avance avec **Enregistrer tout** : snapshot complet, préconditions de toutes les sources/manifeste, absence de réécriture des sources propres, compensation des écritures sur erreur en cours de processus et conservation des piles Monaco. [Guide et preuves](../implementation/save-all-alpha.md), [ADR 0021](../adr/0021-enregistrer-tout-compensation.md). IDE-007 reste P, IDE-008/009/010 restent N : aucun journal ni historique durable n’est livré. Prochain incrément : journal de sauvegarde versionné et récupération après interruption, puis historique local. Les limites de concurrence externe et de panne électrique sont explicites dans l’ADR.

## Avancement R2 — alpha 0.17

IDE-008 passe de N à P : journal d’Enregistrer tout publié avant les sources, phases persistantes, contrôles de versions/empreintes/révisions, ouverture avec Annuler/Terminer/Rétablir et refus des conflits. [Guide et preuves](../implementation/recovery-alpha.md), [ADR 0022](../adr/0022-journal-sauvegarde-et-reprise.md). Tests d’arrêt SIGKILL Linux et recette Electron ; pas de qualification panne électrique, Windows/macOS ou verrou interprocessus. IDE-007/008 restent P, IDE-009/010 restent N. Suite prioritaire : historique local durable/comparaison/restauration et journalisation des autres mutations. Les brouillons non soumis à une sauvegarde restent volatils.

## Avancement R2 — alpha 0.18

IDE-009/010 passent de N à P : versions avant/après des sauvegardes locales de projet, rétention 20 snapshots/64 Mio, persistance/déplacement, diff Monaco et restauration de la source dans le buffer avec Ctrl Z et guards de contenu/révision/disque. Enregistrer actif partage désormais journal et contrôle global avec Enregistrer tout, sans enregistrer les autres brouillons. [Guide et preuves](../implementation/local-history-alpha.md), [ADR 0023](../adr/0023-historique-local-et-restauration-buffer.md). 118 tests Node et recette Electron ; historique fragment/projet, labels et mutations agent restent ouverts. Suite prioritaire : IDE-011 récupération des brouillons et IDE-012 watcher externe, puis extension aux autres mutations, avant checkout Git. R2 reste ouvert.

## Avancement R2 — alpha 0.19

IDE-011 passe de N à P : copie de récupération opt-in distincte des fichiers BASIC, automatique après 2 s de pause et contrôlée toutes les 15 s, protection d’une copie héritée, diff et reprise sélective des buffers avec undo. Révisions/manifeste/bases disque guardés ; aucun statut enregistré implicite ni perte d’un brouillon non sélectionné. [Guide](../implementation/drafts-alpha.md), [ADR 0024](../adr/0024-copie-brouillons-et-reprise-buffers.md). 126 tests Node et recette SIGKILL/relaunch Electron ; limites Linux/processus explicites. IDE-012 reste N : prochaine tranche watcher et revue des modifications externes. Nettoyage automatique/réglage persistant/listings autonomes et mutations agent restent ouverts ; R2/J1-03/ACC-02 non clos.

## Avancement alpha 0.20 — 5 octobre 2026

IDE-012 passe de N à P : inspection automatique par empreinte des sources déclarées, alertes modification/absence/manifeste, diff et adoption explicite. Chargement avec undo ou conservation du buffer sans écriture, contrôle version/base et protection des copies de brouillons. [Guide](../implementation/external-alpha.md), [ADR 0025](../adr/0025-revue-des-modifications-externes.md). 132 tests Node et parcours Electron selon preuves de PR. Polling initial ; watcher événementiel, fusion/rename et Windows/macOS restent ouverts. Suite : checkpoints durables et historique des mutations agent, puis identité/commit Git. R2 reste ouvert.

## Avancement alpha 0.21 — 5 octobre 2026

IDE-007/008/009/010 progressent avec le journal durable des mutations agent : sources/manifeste/création et retrait lors de restauration, reprise native terminer/rétablir, refus des conflits et snapshots avant/proposés dans l’historique. [Guide](../implementation/agent-durability-alpha.md), [ADR 0026](../adr/0026-journal-durable-des-mutations-agent.md). 139 tests Node, dont onze SIGKILL agent supplémentaires ; recette Electron attestée selon PR. Tous ces items restent P : ajout humain/imports, historique projet complet, panne électrique, Windows/macOS et anciennes missions restent ouverts. R2 ne ferme pas J1-03/ACC-02. Prochain lot : identité et commit Git local, puis branches et synchronisation selon préconditions JG.


## Avancement alpha 0.22 — 5 octobre 2026

R3 commence avec [identité explicite et commits locaux](../implementation/git-commit-alpha.md), [ADR 0027](../adr/0027-commit-git-index-exact.md). Aperçu exact de l’index, confirmation native, premiers/seconds commits, préconditions sous verrou et conservation du disque/index/configuration. Git 2.48+, commits non signés et hooks désactivés ; identité persistante, branches et réseau restent ouverts. IDE-033 passe à P ; R3/JG-A/ACC-31 ne sont pas clos. 146 tests Node ; recette Electron et capture attestées dans la PR.


## Avancement alpha 0.23 — 5 octobre 2026

Le [profil privé d’identité Git](../implementation/git-identity-alpha.md), [ADR 0028](../adr/0028-profil-prive-identite-git.md), complète R3 avec mémorisation opt-in, chargement initial/explicite, oubli et protection des révisions. La préférence est commune aux projets CPCéleste et ne modifie pas la configuration Git ; le réglage par dépôt du document 16 reste ouvert. IDE-033 reste P, R3/JG-A/ACC-31 ne sont pas clos. 152 tests Node ; recette Electron de persistance après SIGKILL et capture attestées dans la PR. Suite prioritaire : liste/création de branches locales, puis bascule protégée avant réseau.


## Priorité Exécuter — alpha 0.24, 5 octobre 2026

À la demande utilisateur, [Exécuter/F5 dans le CPC intégré](../implementation/emulator-run-alpha.md) passe avant la suite Git. [ADR 0029](../adr/0029-executer-buffers-cpc-integre.md) : worker chips/WASM, DSK des buffers, trois ROM privées, écran/clavier/pause/arrêt/son/export session et RUN automatique pour le jeu anglais reconnu (Ready manuel sinon). Boot BASIC 1.1, RUN disque et POKE sont prouvés sur le jeu identifié ; pixels PRINT vérifiés par recette UI. 157 tests Node ; preuves Electron dans la PR. J0/J3 restent partiels, oracle indépendant/OPENOUT/audio audible/autres plateformes ouverts ; aucun CPC physique qualifié. Suite immédiate : renforcer les recettes CPC, avant branches Git et outils d’exécution IA.
