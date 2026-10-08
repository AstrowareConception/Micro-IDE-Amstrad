# CPCéleste — Diagnostics et performance alpha 0.34

Date : 6 octobre 2026. Tranche du lot 2 et d’IDE-073 ; IDE-013/014/015 restent partiels. [ADR 0041](../adr/0041-analyse-basic-worker-monitoring.md).

## Utilisation

Problèmes rassemble les diagnostics des sources chargées, y compris un onglet masqué dont le buffer est conservé. Chaque ligne indique fichier, ligne physique, colonne/plage, numéro BASIC lorsqu’il existe, gravité et code. Rechercher, Gravité et Source se combinent. Un clic/Entrée sélectionne la plage dans sa source ; F8/Maj F8 passent au diagnostic suivant/précédent entre sources. Les marqueurs de code, gouttière et onglet suivent les mêmes résultats.

Pendant la saisie, les anciens diagnostics sont retirés et le panneau indique les analyses en attente. Après une pause de 200 ms, un worker traite les sources modifiées, avec priorité à la source active. Les sources inchangées ne sont pas reparsées par changement de curseur, de panneau ou par complétion. F12 peut attendre le résultat courant ; les mots-clés se complètent immédiatement, les cibles et variables lorsque l’index de la version courante est disponible.

« Zones non couvertes et couverture par source » indique les productions inspectées et les zones partielles. Un listing sans erreur peut encore échouer sur CPC : cette tranche ne vérifie pas tous les types, fonctions, flux et comportements. Chaîne ouverte conserve un avertissement ; contrainte ASCII reste une erreur d’export identifiée par son code. Les zones opaques ne deviennent pas des erreurs simplement parce qu’elles sont non prises en charge.

Affichage → Afficher les mesures de performance, palette ou onglet Performance affichent durées par source, réutilisation du cache, révisions et compteurs envoyées/acceptées/périmées. Les mesures de réactivité se limitent au temps où le panneau et la fenêtre sont visibles. Le bouton Recommencer repart à zéro pour cette observation, sans relancer le parser. Fermer les sorties ou choisir un autre onglet arrête le minuteur et l’observateur. Les résultats restent locaux en mémoire, sans fichier ni transmission. Ce panneau ne mesure pas le CPU ni la mémoire complète d’Electron.

Une limite est annoncée ; aucun « programme valide » implicite. Un worker en panne ou un travail de plus de 5 s affiche un échec et Réessayer l’analyse. Les buffers et leur undo sont conservés. La fenêtre masquée suspend les nouveaux travaux, sans arrêter les sessions CPC ou terminal selon leurs règles propres.

## Matrice structurelle et corpus

Les signatures sont confrontées au corpus fourni et au chapitre BASIC du manuel utilisateur Amstrad CPC 6128, [transcription identifiée](https://www.cpcalive.com/docs/basic_doc.html). Les originaux de connaissance restent inchangés. Statut **documenté/testé statiquement**, sans qualification ROM exhaustive. Les fiches d’aide ne sont pas promues en fiches complètes par cette tranche.

| Production | Contrôle livré | Limite visible |
| --- | --- | --- |
| Numéros, ordre, cibles littérales | Diagnostic et index physique/BASIC, cibles absentes par listing | Expressions de cible et chargement d’un autre fichier non résolus |
| Expressions ordinaires | Opérateurs, valeurs, groupement, virgules, opérateur manquant ; mots-clés d’instruction refusés comme valeurs | Types et arité des fonctions non vérifiés ; FN séparé, adresse/flux et profondeur bornée partiels |
| Affectation/LET, tableaux, DIM, READ, NEXT | Cible, signe égal, dimensions et expressions/liste de variables | MID$ à gauche et DEF FN opaques ; aucune preuve de boucle terminée |
| IF simple et imbriqué (0.40.1) | Condition, THEN/GOTO, corps après THEN/ELSE, association des ELSE et instructions séparées par deux-points | Limite de 16 niveaux ; types/effets d’exécution non déduits |
| FOR, WHILE | Borne initiale/finale, STEP, expression de condition | Pas de pile d’exécution ni d’analyse complète de contrôle calculé |
| ON, AFTER/EVERY | Sélecteur, GOTO/GOSUB, listes et arguments ; ON ERROR GOTO 0 préservé | ON SQ/BREAK événementiels partiels |
| MODE/MEMORY/ERROR, graphisme, mémoire/I/O, SOUND, WAIT, KEY, fichiers simples | Nombres d’arguments, groupes et expressions ; LOCATE avec flux ; ORIGIN à 2/6 arguments | Valeurs matérielles et options complexes non qualifiées ; paramètres omis autorisés dans graphisme/SOUND |
| SPEED, commandes sans argument | Variante INK/KEY/WRITE et arguments ; surplus après END/RETURN/etc. | Autres commandes contextuelles reconnues lexicalement et laissées partielles |
| PRINT/WRITE/INPUT | Parenthèses, certaines terminaisons/opérateurs, WRITE ordinaire et INPUT sans variable | Expressions PRINT adjacentes natives préservées ; USING/TAB/SPC/flux/prompts partiels |
| DATA, commentaires, RSX, orthographes compactes | Conservés, opaques selon leur contexte | Aucun diagnostic de grammaire inventé pour la charge DATA/RSX |

`tests/basic-analysis-service.test.ts` contient corpus positif/négatif, options graphiques omises, PRINT adjacent, événements, fichiers, tableaux, IF imbriqués et limites. Les tests historiques restent actifs. Le cache est comparé à une analyse fraîche après édition et insertion de ligne ; références recalculées après retrait de cible. L’ordonnanceur est éprouvé sans temps réel : coalescence, une demande en vol, révisions tardives, undo, changement de source, fenêtre masquée, dépassement/panne et relance. L’index Monaco a une recette de changement de version et destruction.

## Ressources et mesure exécutée

Bornes détaillées dans l’ADR : 1 Mio de caractères et 10 000 lignes par source, sorties et lexification bornées. Aucun polling d’analyse au repos. Le cache lexical réutilise les tokens, mais les diagnostics et références sont recalculés pour le texte courant. Le coût n’est donc pas supposé constant sur tous les programmes.

Mesure locale reproductible : `node scripts/benchmark-basic-analysis.mjs`, Linux x64, Node 24.19.0, CPU rapporté AMD EPYC 9V74 80-Core Processor, conteneur partagé ; 5 000 lignes / 79 654 caractères / 12 essais. Médiane à froid 18,13 ms, p95 30,77 ms ; modification d’une ligne médiane 8,42 ms, p95 17,33 ms, 4 999 lignes réutilisées. Ces durées excluent transport, démarrage du worker, rendu Monaco et pause de 200 ms. **La cible produit de 300 ms de bout en bout sur matériel de référence n’est pas qualifiée par ce benchmark.**

La recette navigateur vérifie sources/filtres/plages, F8 entre sources, undo/redo, coalescence, absence d’envoi au worker au repos, démontage du monitoring et panne/reprise du worker. 245 tests Node passent localement, ainsi que typage strict, builds renderer/main, recette navigateur complète et contrôles documentaires (109 fichiers Markdown / 4 schémas). Recettes Windows et Electron/Linux restent les gates CI avant fusion ; aucune qualification macOS ou session longue n’est déduite du conteneur.

## Suite

Aide des paramètres, fiches natives exhaustives, types/arité, renommage sémantique et coûts sur grands projets/matériel cible restent ouverts. Le [plan de débogueur BASIC](basic-debugger-plan.md) distingue trace native, hooks réels, points d’arrêt et variables ; aucun état BASIC n’est simulé dans cette tranche.

Extension 0.40.1 : [qualification des IF et limites du flux](basic-control-flow-alpha.md#qualification-0401). Les noms GOTO100/THEN100 restent des identifiants ; un GOTO100 employé comme instruction reçoit un diagnostic demandant l’espace.
