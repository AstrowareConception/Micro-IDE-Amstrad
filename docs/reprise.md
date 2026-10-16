# CPCéleste — Point de reprise du développement

## Incrément du 16 octobre — renommage FN/paramètres 0.41.15

Base : main `55722797e5ed5fac524ade4f8d4a457541961323`, PR #76 fusionnée après CI verte sur `1532b17` : Specifications 38810588488, J0 38810588510, Desktop Windows/Linux 38810588508 ; Linux 116682688144 confirme 461 tests et 16 recettes de renommage. Branche `feat/basic-fn-rename` ; vérifier sa PR et la CI de sa tête avant d’annoncer la fusion. Installateurs publiés 0.41.10 ; aucun packaging supplémentaire déclenché.

Réalisé : F2 fonctions et paramètres locaux via un profil dédié, définitions initiales uniques, appels/arité/suffixes couverts, absence de récursion et de types dynamiques. Collisions conservatrices dans toutes les portées, nouveau contrôle après transformation, conservation des globales/tableaux homonymes et des autres paramètres. Panneau « Renommer un symbole » avec nature/portée et focus initial pour Échap ; worker, aperçu et gardes de révision/undo inchangés. Guide illustré, exemple repris exactement d’un témoin firmware, ADR 0074 et priorités validées intégrés. Aucun outil agent ou droit documentaire supplémentaire ; contrat SymbolReport et obfuscateur inchangés.

Vérifications locales : TypeScript, 468 tests Node, builds renderer/main et 46 recettes firmware avant/après réussis (30 nouvelles exécutions FN, 16 précédentes). Quinze témoins indépendants couvrent noms FN, suffixes, paramètres, homonymes globaux/tableaux, imbrication, arguments et paramètres inutilisés. Parcours navigateur complet réussi : paramètres locaux, homonymes libres/globaux, collision, renommage depuis un appel, aperçu exact, export du buffer, undo, obsolescence et Échap sur refus ; non-régression variables/navigation également réussie. Capture réelle inspectée et intégrée. Contrôle documentaire réussi : 171 Markdown, 21 JSON, 84 exigences, 37 scénarios, six schémas et six exemples. Vérifier la CI de la tête publiée avant fusion. Aucun appel IA facturé, ROM ni document personnel ajouté.

Limites : bloc initial de définitions, une par ligne ; suffixes identiques entre définition/appels ; doublons, alias, récursion, directives de type, effets opaques et segments non couverts refusés. Les globales des fichiers FN restent exclues du renommage. Budgets communs et du collecteur conservés ; troncature de couverture bloquante. Mémoire/timing peuvent changer, aucune équivalence universelle ni qualification matérielle/indépendante. Suite prioritaire : relier les tests aux sources réellement transformées, puis intégrer les transformations déterministes à la lisibilité IA. Types dynamiques, redéfinitions et découpage restent ouverts.

## Incrément du 15 octobre — renommage de variables 0.41.14

Base : main `73c3da83825fc912dad51a83c1df8ae649fabc7e`, PR #75 fusionnée après CI verte sur `2344c38` (Specifications 38806296266, J0 38806296219, Desktop 38806296196 ; Linux 116667924344 confirme 455 tests et 42 recettes FN). Branche `feat/basic-variable-rename` ; vérifier sa PR et la CI de sa tête avant d’annoncer la fusion. Installateurs publiés 0.41.10 ; aucun packaging supplémentaire déclenché.

Réalisé : premier renommage déterministe de variables/tableaux par F2, menus et palette, calcul explicite en worker, aperçu avant/après et positions, refus des collisions/alias/types dynamiques/FN/accès opaques, suffixes conservés et un undo. Application uniquement au buffer courant après contrôle exact du texte, de la session, du modèle et de sa révision, même après une modification annulée. Guide illustré, ADR 0073, roadmaps et banc firmware avant/après ajoutés. Contrat SymbolReport, obfuscateur et outils agent inchangés.

Vérifications locales : TypeScript, 461 tests Node et builds renderer/main réussis. Parcours navigateur ciblé réussi : F2/menu, vrai worker, noms/suffixes et scalaire/tableau, collision, aperçu exact, export des buffers courants vers port contrôlé, undo/redo, texte modifié puis annulé, changement de source/projet, annulation/réponse tardive et fenêtre étroite. Huit paires indépendantes avant/après, soit 16 recettes firmware CPC réussies. Suite navigateur complète réussie ; capture réelle inspectée et versionnée. Contrôle documentaire réussi : 169 Markdown, 21 JSON, six schémas et six exemples. Vérifier ensuite la CI de la tête publiée avant fusion. Aucun appel IA facturé, ROM ou fichier personnel ajouté.

Première CI de PR #76 sur `81a672f` : Specifications et J0 réussis ; Linux a échoué dans le test HTTPS Git préexistant, avant build/UI. Un commit de la fixture lançait la maintenance Git en arrière-plan ; son fichier `objects/maintenance.lock` disparaissait pendant l’inspection. Désactivation de la maintenance automatique uniquement pour les commandes de préparation de cette fixture, comme dans les commandes de production ; aucune garde ni assertion retirée. Les 17 tests ciblés Git réseau/inspection/index ont réussi après correction ; vérifier la CI de la nouvelle tête avant fusion.

Limites : fichier autonome ASCII exécuté depuis le début, 65 535 caractères, 255 par ligne et 2 000 occurrences. FN, directives de type, alias suffixés et accès machine/mémoire/temps/externes exclus ; les autres sources ne sont pas renommées. Les noms peuvent modifier consommation mémoire et timing. IDE-017 partiel, aucune équivalence universelle ni nouveau matériel/émulateur indépendant qualifié. Suite : témoins supplémentaires pour étendre les identités, puis FN/types dynamiques ; découpage multifichier toujours à concevoir.

## Incrément du 15 octobre — navigation au curseur 0.41.13

Base : main `9b2db1768aab2f310356f755ea796b2336f62c9f`, PR #74 fusionnée après CI verte (Specifications 38802392944, J0 38802392762, Desktop 38802393111) sur `7102b4d`. Branche `feat/basic-cursor-navigation` ; vérifier sa PR et la CI de sa tête avant d’annoncer la fusion. Installateurs publiés 0.41.10 ; aucun packaging supplémentaire déclenché.

Réalisé : F12 sur un nom ouvre les déclarations/affectations possibles ; Maj+F12 ouvre les usages. Menus BASIC, palette et contexte ; saut F12 vers numéro BASIC conservé. Nouveau résolveur pur dans le worker Symboles, une source exacte par demande, 200 résultats affichés avec total, séparation paramètres/variables libres, ambiguïtés et absence de couverture explicites. Résultats au curseur dans Symboles, garde des snapshots, annulation/remplacement et refus des réponses tardives. Contrat d’export 3 et outils agent inchangés. Guide illustré, ADR 0072 et roadmaps mis à jour.

Vérifications locales : TypeScript, 455 tests Node, builds renderer/main et parcours navigateur ciblé réussis. Clavier/menu, coordonnées exactes, candidats multiples, frappe sans indexation, modification pendant/après calcul, réponse remplacée et changement de projet testés avec worker réel. Capture inspectée et versionnée. Suite navigateur complète réussie. Contrôle documentaire réussi : 167 Markdown, 21 JSON, six schémas et six exemples. Vérifier la CI de la tête publiée avant fusion. Aucun appel IA facturé ni ROM ou projet personnel ajouté.

Limites : rapprochement textuel des variables (suffixes/scalaire/tableau séparés), candidats FN sans définition active ni validation d’arité, sous-ensemble syntaxique de l’index conservé. Pas de liens intersources, recherche dans texte arbitraire ni renommage. Les appels sans candidat ne sont pas regroupés ; les usages partageant un candidat FN ne forment pas une identité sémantique. Prochaine tranche : cadrer le renommage sûr avec aperçu, collisions, suffixes/types, révisions et undo, en commençant par les formes dont l’identité peut être suffisamment établie. IDE-015 partiel, IDE-017 non réalisé. Aucune nouvelle qualification firmware/matérielle.

## Incrément du 15 octobre au soir — index FN 0.41.12

Base : main `d6ebc8de14386824c0a159218f83be926cd924b7`, PR #73 fusionnée après CI verte et 42 recettes FN firmware réussies. Branche `feat/basic-fn-symbols` ; vérifier sa PR et la CI de sa tête avant d’annoncer la fusion. Installateurs publiés 0.41.10, aucun packaging supplémentaire déclenché.

Réalisé : vue Fonctions FN et paramètres dans Symboles, définitions séparées, paramètres locaux/variables libres/liaisons ambiguës, appels avec candidats sans preuve de définition active, recherche et navigation exacte avec garde des snapshots. Collecteur TypeScript borné dans le worker existant ; types implicites conservateurs, budgets communs et retrait complet sur dépassement. Rapport JSON 3 et Markdown sans expressions/valeurs ; guide illustré, exemple, ADR 0071 et roadmaps actualisés. L’outil agent de symboles conserve son périmètre variables/types ; aucun renommage FN automatique.

Vérifications locales : TypeScript, 450 tests Node et builds renderer/main réussis. Suite navigateur complète réussie, dont worker FN réel, navigation, ambiguïtés, export, obsolescence et fenêtre étroite. Capture réelle inspectée et intégrée au guide. Contrôle documentaire réussi : 166 Markdown, 21 JSON, six schémas et six exemples. Vérifier la CI de la tête publiée avant fusion. Aucun appel IA facturé, ROM ou projet personnel ajouté.

Limites : reconnaissance d’un sous-ensemble d’expressions et de contextes d’appel ; segments FN exclus de la liste globale. Les liens ne prouvent ni l’exécution ni l’arité valide. Types actifs/caches firmware, redéfinitions conditionnelles et formes opaques non résolus. Pas de qualification d’un nouveau firmware, matériel ou émulateur indépendant. Suite : accès explicite depuis le curseur aux usages/déclarations reconnus, puis renommage avec aperçu et révisions après résolution suffisante des identités. IDE-015 partiel, IDE-017 non réalisé.

## Incrément du 15 octobre — qualification DEF FN

Base : `main` à `5b564d6f00ee6a0ff42e2d952928ab1371d2a53a`, PR #72 fusionnée après succès des trois workflows sur `0c8917c7d721e150e3521656167d8ea83f112207`. Les réserves CI du compte rendu précédent sont donc levées. Version applicative 0.41.11 ; installateurs publiés 0.41.10. Branche `test/basic-fn-qualification` ; vérifier sa PR et les contrôles de sa tête avant d’annoncer la fusion. Aucun packaging supplémentaire déclenché.

Réalisé : 41 témoins FN et un exemple exécutable, recette WASM dédiée et bloquante dans la CI Linux, rapport avec ROM/source/DSK/moteur/fixtures identifiés, codes ERR/ERL et bornes. Paramètres/globaux, variables libres imbriquées, tableaux, suffixes/alias, types au moment de l’appel, redéfinitions et erreurs avec effets partiels sont confrontés au firmware. [Matrice et contre-exemples](implementation/basic-fn-qualification.md), [ADR 0070](adr/0070-qualification-fn-avant-renommage.md). Aucun changement au domaine Symboles, contrat d’export, UI ou permissions IA.

Vérifications : TypeScript et 439 tests Node réussis localement. 42 recettes firmware réussies dans la matrice complète, dont les deux témoins supplémentaires sur les changements de type entre appels et la séquence 6/102/103 confirmée par sondes RAM. Contrôle documentaire réussi : 165 Markdown, 21 JSON, six schémas et six exemples. Le premier passage expérimental a réfuté cinq attentes ; sondes RAM ciblées pour les valeurs litigieuses, résultats précis consignés puis fixés en assertions. Aucun échec transformé en succès par timeout. ROM de référence et outils de construction conservés hors Git ; aucun appel IA facturé.

Suite immédiate : après validation de cette tranche, réaliser l’index FN/portées borné à partir de la matrice, avec fonctions/paramètres/variables libres distincts, ambiguïtés visibles, coordonnées/navigation, exports et garde des snapshots. Les types implicites et définitions actives dépendent de l’exécution. Conserver les cas non prouvés en omissions ; ensuite accès depuis le curseur puis renommage avec diff préalable, collisions, révisions et undo. IDE-015 reste partiel, IDE-017 non réalisé. Ni firmware différent, ni matériel, ni émulateur indépendant qualifié par ce lot.

## Incrément du 14 octobre — Lisibilité et tests agent 0.41.11

Base : main `729ba9fca150d1ad27d9c952fccb5cf18da0692c`, PR #71 fusionnée, CI main réussie. Installateurs **0.41.10 publiés** par le run `38644488916`, Windows/Linux, neuf assets dont checksums/provenance. Branche `feat/agent-readability-tests` ; vérifier sa PR et sa CI avant d’annoncer la fusion. Aucun second packaging déclenché.

Réalisé : préparation d’une mission de lisibilité avec traitements et périmètre, consigne éditable et précédente restaurable ; consultation agent des symboles/types possibles. Noms, commentaires, présentation et note Markdown demandés à l’IA ; FN reste une proposition et découpage un plan sans déplacement automatique. Suites existantes accessibles à l’agent BASIC avec révision, buffers courants, worker CPC jetable et ROM locales. 5 exécutions/mission, 60 s/suite ; rapports avant/après et historique, dernier essai de chaque suite non réussi/périmé bloquant. [Guide](implementation/agent-readability-alpha.md), [ADR 0069](adr/0069-lisibilite-et-tests-agent.md).

Vérifications locales : 439 tests Node réussis, TypeScript et builds renderer/main réussis. Parcours navigateur complet réussi, capture réelle inspectée ; contrôle documentaire 163 Markdown, 21 JSON, six schémas et six exemples réussi. Recettes firmware/IPC et CI à confirmer avant publication. Aucun appel IA facturé. Les tests UI simulent le modèle et le runtime ; ils ne prouvent pas la ROM. La nouvelle recette firmware utilise le vrai worker et sera exécutée en CI.

Première CI de PR #72 (`aa260bb98f923dc1c04d75c4826b291138a1496a`) : spécifications, moteurs natif/WASM, build et navigateur Windows réussis. Linux : tests Node, navigateur, vraie recette firmware et worker CPC avant/après/régression réussis. La nouvelle sonde Electron a échoué sur un import dynamique dans le contexte VM Playwright, avant de lancer le worker. Correction du chargement de modules dans la sonde via le chargeur synchrone Node ; application inchangée. Vérifier la CI de cette correction avant fusion. Les tests Electron natifs sont exécutés sous Linux, pas Windows.

Limites : ni renommage sémantique déterministe, ni fonctions/portées FN qualifiées, ni extraction automatique de modules. L’aperçu est celui de la consigne ; les changements agent sont enregistrés et restaurables. Chaque test est autonome : une copie de routine ne couvre pas le programme principal. Pas de génération de suites ni tests Z80, pas de preuve universelle de conservation du comportement/mémoire/timing. Suite : lier tests et sources, qualifier FN puis renommage avec diff préalable et découpage contrôlé.

**Pause demandée le 8 octobre 2026.** Ce document conserve l’état vérifié, les décisions et la suite ; il n’archive pas les conversations. Confronter son contenu au `main` distant avant toute reprise.

## Incrément du 14 octobre — rédaction documentaire agent 0.41.10

Base : `main` à `9c33be45f8ad1ebfa5ef774e2afce2c36f4e7e2e`, PR #70 fusionnée après succès des trois workflows. Code 0.41.9, installateurs publiés 0.41.7. Branche `feat/agent-knowledge-writing` ; vérifier sa PR et les contrôles de sa tête avant d’annoncer la fusion. Aucun packaging supplémentaire déclenché.

Réalisé : outils `documents_create_note` et `documents_replace_note` communs aux agents BASIC/Z80 ; lecture réelle et révision exacte pour remplacer, scope éditable/autorisé, imports et droits immuables, publication des versions Markdown via le stockage existant. Le checkpoint complet restaure notes et sources/analyse ; extension bornée du journal de récupération pour les pointeurs de notes et l’analyse Z80. Les versions documentaires physiques restent conservées. Refus des modifications manuelles ultérieures avant restauration. Corpus de mission actualisé, pause/reprise conservée. UI : Documenter avec l’IA prépare une consigne sans appel, notes créées/révisées et comparaisons dans le bilan, lecture directe, actualisation du manifeste et du lecteur, garde des brouillons. [Guide](implementation/knowledge-alpha.md), [ADR 0068](adr/0068-redaction-documentaire-agent.md), contrat AgentTask et roadmaps actualisés.

Vérifications locales : 436 tests réussis ; 11 tests ciblés agent documentaire/Z80 rejoués après ajustements. TypeScript, builds renderer/main et suite navigateur complète de l’éditeur réussis. Parcours documentaire avec vrai contrôleur et stockage sur disque, fournisseur simulé : création/révision, pause/reprise, secrets exclus, comparaison, restauration complète, conflits et journal interrompu. Capture réelle inspectée et intégrée au guide. Contrôle documentaire réussi : 161 Markdown, 21 JSON, six schémas et six exemples. Recette Electron IPC ajoutée ; résultat Windows/Linux natif à vérifier en CI. Aucun appel IA facturé, ROM ni document privé ajouté.

Limites : 10 documents actifs/4 Mio, notes 64 Kio, dix versions antérieures proposées ; pas de purge des fichiers archivés. Le checkpoint global est restaurable dans la session ; la récupération après crash concerne la transaction interrompue, pas la conversation IA. Toute mission reste soumise à la construction DSK finale ; le contenu Markdown n’est pas validé sémantiquement. Projet Z80 : une zone enregistrée requise. Pas de suppression/renommage documentaire agent, modification des politiques, recherche humaine plein texte, onglets documentaires multiples ni qualification multi-fenêtres. Suite : tests CPC agent selon la roadmap, puis enrichissement du corpus et recherche documentaire. Les trois pièces jointes de référence étaient déjà conservées dans le corpus initial ; elles ne sont pas recopiées ni modifiées.

## Incrément du 14 octobre — Connaissances et Markdown 0.41.9

Base : `main` à `352700c3be610c2554992c15bab8dc45cec08ff5`, PR #69 fusionnée après réussite des trois workflows ; code 0.41.8, installateurs publiés 0.41.7. Branche `feat/project-knowledge`. Vérifier sa PR et ses contrôles avant d’annoncer la fusion. Aucun packaging supplémentaire déclenché.

Réalisé : espace Connaissances à gauche, catégories et recherche par titre ; lecture Markdown/GFM au centre, source et vue partagée, templates de notes, copie des références importées, éditions humaines et dix versions précédentes restaurables. Sources BASIC préservées, brouillons documentaires signalés, Ctrl/Cmd S et bouton général orientés vers le lecteur actif. Extension optionnelle du manifeste par document, publication de versions Markdown immuables puis du pointeur de manifeste. Accès Exclu/Consultable/Essentiel persistant ; contexte essentiel borné 4 K/document et 12 K total, lectures partagées BASIC/Z80. [Guide](implementation/knowledge-alpha.md), [ADR 0067](adr/0067-espace-connaissances-markdown.md).

Vérifications locales : 431 tests réussis, dont store réel et contexte du contrôleur avec fournisseur simulé. TypeScript et builds renderer/main réussis. Parcours navigateur complet de l’éditeur réussi ; parcours ciblé Connaissances/agent BASIC/Z80 repassé après les derniers ajustements. Capture réelle inspectée et copiée dans le guide. Contrôle documentaire réussi : 160 Markdown, 21 JSON, six schémas et six exemples. Régression native des imports et nouvelle recette IPC ajoutées à la suite Desktop ; qualification Windows/Linux à vérifier en CI. Aucun appel IA payant, ROM ni document privé ajouté.

Limites : dix documents actifs/4 Mio, notes 64 Kio, versions archivées conservées sans purge automatique. Rendu Markdown 64 K caractères, HTML brut inerte, pas d’images externes automatiques, liens externes à copier. Pas de Mermaid/mathématiques/coloration de code, glisser-déposer, onglets documentaires multiples ou récupération du brouillon après crash. La génération et modification automatique du Markdown par l’agent restent à réaliser avec checkpoints cohérents ; la consultation persistante est livrée. Pas de transaction multi-fenêtres ni garantie universelle de panne matérielle. Les anciens exécutables refusent les nouveaux champs de manifeste : conserver une version Git avant retour à un ancien IDE. Suite : outils documentaires mutatifs, recherche plein texte, puis tests CPC agent selon la roadmap.

## Incrément du 14 octobre — bibliothèque de missions 0.41.8

Base : `main` à `b283e2b4d7c982da26145ed7012f8751301a47da`, PR #68 fusionnée, préversion 0.41.7 publiée par le workflow 38616060931. Branche `feat/agent-mission-library`. Vérifier sa PR et ses contrôles avant d’annoncer sa fusion ; aucun packaging supplémentaire déclenché par cet incrément.

Réalisé : sept modèles originaux adaptés au type de projet, paramètres littéraux, recherche/catégories, résultat attendu et limites, aperçu modifiable, ajout/remplacement explicite avec retour à la consigne précédente. Modèles personnels locaux versionnés : copie, mise à jour, suppression/rétablissement, bornes et garde contre données invalides ou périmées. Dialogue natif accessible, petite largeur, documentation illustrée et attribution de l’inspiration Portage_Opti. Aucun outil agent ni dépendance supplémentaire. [Guide](implementation/mission-library-alpha.md), [ADR 0066](adr/0066-bibliotheque-missions.md).

Vérifications locales : 427 tests réussis ; parcours Chromium BASIC et Z80 avec fournisseur contrôlé, persistance après rechargement, focus, recherche, paramètres, sauvegarde et restauration, absence d’appel IA pendant la préparation. Fenêtres 420 et 1440 pixels contrôlées. Capture réelle inspectée ; aucun fichier de jeu ni ROM incorporé. TypeScript et builds renderer/main réussis ; contrôle documentaire réussi (158 Markdown, 21 JSON, six schémas/six exemples). Qualification complète Windows/Linux, natif et WASM à vérifier dans la CI de cette branche.

Limites : stockage local non chiffré, vingt modèles/200 000 caractères sérialisés, pas de synchronisation/export ni verrou interfenêtres transactionnel. Les consignes d’analyse ne constituent pas un mode lecture seule imposé. Les missions ne donnent pas accès au RUN CPC, aux conversions d’images ou au portage automatique. Suite : outils d’exécution/tests CPC pour l’agent, conversion graphique puis traces/profilage ; conserver FN/portées, retokenisation et qualification assembleur au backlog.

## Correctif du 14 octobre — import historique 0.41.7

Base : `main` à `1fdb4a59ae342fff76402e2e3d38f2b58c711430`, PR #67 fusionnée et préversion 0.41.6 publiée par le workflow 38475890518. Branche `fix/dsk-fer-flamme`. Demande : corriger le refus d’import sur Fer & Flamme, disquette 1 fournie localement.

Réalisé : ST1=&80 seul accepté avec avertissement, Extended DATA/SYSTEM à neuf secteurs 512 octets et un secteur supplémentaire CA/4A de 256 octets accepté, indépendamment de l’interleave. Autres statuts, doublons, tailles faibles/tronquées et allocations invalides toujours refusés. Noms avec `&` conservés dans le lecteur/writer, manifeste, contrats, récupération isolée et commande RUN. Avertissements dans l’aperçu et le rapport ; calcul de capacité ASCII selon sélection avant import. Documentation et ADR 0065 actualisés.

Preuves locales : 425 tests réussis, TypeScript, builds renderer/main ; contrôle documentaire (156 Markdown, 21 JSON, six schémas/six exemples) réussi. Parcours Chromium avec vrai worker/stockage réussi : avertissements historiques, noms avec `&`, création/réouverture, garde des brouillons, capacité et import toujours disponible si dépassement. Capture synthétique inspectée, non ajoutée au guide. Aucune nouvelle dépendance applicative.

Fichier réel : 47 fichiers extraits, comparés octet par octet à un parcours de secteurs indépendant ; cinq BASIC convertibles et 42 ressources. Projet créé/rouvert, DSK et enregistrements d’origine préservés. Tous les BASIC en ASCII : 183 blocs pour 178, refus de build attendu. Seulement `F&F.BAS` converti : 178 blocs, reconstruction de 47 fichiers, 46 ressources identiques. `DEF1.BAS` reste brut (structure tokenisée non validée). Aucune exécution du jeu ni de ses protections, aucune qualification des trois autres disquettes ; les secteurs supplémentaires sont préservés seulement dans l’original. DSK, fichiers extraits et projets privés hors Git.

Suite immédiate : vérifier la CI de la PR, fusionner après succès et publier un unique packaging 0.41.7 pour le retest utilisateur. Ne pas annoncer l’installateur avant la publication effective. Au-delà : retokenisation de reconstruction pour les disques pleins, caractères CPC, autres profils et protection particulière de DEF1 ; la roadmap Z80/FN existante reste ouverte.

## Incrément du 13 octobre — agent Z80 et UX 0.41.6

Base : `main` à `11bd3f817b8118f862f1a726855dae0613714393`, PR #66 fusionnée après succès des contrôles Windows/Linux, moteur natif, WASM et spécifications. Branche `feat/z80-agent-workbench`. Vérifier sa PR et la CI de sa tête avant d’annoncer la fusion ; aucun installateur déclenché.

Réalisé : catalogue agent Z80 distinct, instructions dédiées, lecture bornée des zones enregistrées, hash et consultation du dialecte avant édition, assemblage à taille/origine fixes, checkpoint, pause/reprise et restauration en session. Pas de binaire brut ni ROM/document externe transmis au modèle. Révisions contrôlées aux écritures, reprise, restauration et fin de mission. Statut renderer sans snapshots d’octets bruts. Les projets BASIC gardent leur catalogue.

UX : cartes ressources/zones/octets, formulaire repliable, styles de code/thèmes, actions accessibles pendant le défilement, raccourci de mission « Expliquer cette zone avec l’IA », brouillons protégés, synchronisation des résultats dans l’atelier, avant/après des notes et listings, comparaison de 128 octets maximum avec total exact. [Guide illustré](implementation/binary-agent-alpha.md), [ADR 0064](adr/0064-agent-z80-et-comparaison.md), notice, roadmaps et provenance des captures mis à jour.

Vérifications locales : 421 tests unitaires réussis, TypeScript, builds renderer/main ; contrôle documentaire réussi (155 Markdown, 21 JSON, six schémas et six exemples), deux captures inspectées et versionnées ; parcours navigateur complet de l’éditeur puis recette Z80 ciblée avec véritable contrôleur/stockage et fournisseur simulé (aucun appel facturé). Mutation par binary_replace_region, construction et comparaison, blocage des brouillons, restauration du checkpoint et réouverture vérifiés. Recette native CPC avec ROM identifiées : l’outil agent change la valeur de 77 à 78, RAM &9000 observée à ces valeurs, originaux inchangés. Recette IPC Electron enrichie (garde dirty, mission Z80, sauvegarde et restauration) : qualification distante à vérifier. Pas de nouveau build WASM local, qualification complète attendue en CI.

Limites : périmètre de mission = toutes les zones déjà enregistrées, pas de création/suppression de zones ni de documents externes ; 64 K caractères par remplacement IA, 4 K pour les notes. Les faits/hypothèses sont demandés au modèle, sans oracle sémantique. Aucun test CPC automatique par l’agent ni de corpus firmware Z80 qualifié. La restauration automatique après redémarrage et les projets mixtes restent absents. Suite : assembleur indépendant, projets mixtes, références firmware et tests comportementaux ; poursuivre ensuite FN/portées BASIC. Captures de programme témoin uniquement, jeux/ROM privés hors Git.

## Incrément du 13 octobre — atelier binaire 0.41.5

Base distante : `main` à `5ad4d90ad86aa48443c0dbd5157f2681da7bd398`, PR #65 fusionnée après tous les contrôles réussis. Branche `feat/binary-workbench`. Vérifier la PR de cette branche avant d’annoncer sa fusion ; aucun installateur déclenché.

Réalisé : mode explicite de projet binaire sans faux BASIC ; import DSK/fichier CPC, choix d’entrée, ressources immuables, atelier central avec plages code/données, notes et copies assembleur persistantes dans binary-z80.json, révision et empreintes contrôlées. Assembleur local borné, aller-retour identique avant édition, tailles/origines fixes, export DSK modifié et bouton Tester la copie modifiée ; F5 utilise les ressources originales. [Guide](implementation/binary-workbench-alpha.md), [ADR 0063](adr/0063-atelier-projets-binaires.md).

Preuves : 415 tests unitaires, TypeScript, builds renderer/main et contrôle documentaire réussis (153 Markdown, 21 JSON, six schémas/six exemples). Parcours Chromium réel worker/stockage : import, annotation, Ctrl S, vérification 0 puis 1 octet modifié, export, préparation d’exécution et réouverture ; capture inspectée. Recette native avec ROM contrôlées : binaire de sept octets importé/réassemblé, LD A,77 changé en LD A,78, RAM &9000 observée à 77 puis 78. Deflektor : trois ressources, chargeur de 190 octets réassemblé à l’identique et menu atteint depuis la disquette reconstruite ; aucune partie complète revendiquée. Tests IPC ajoutés à la suite existante, résultat CI de cette tête à vérifier.

Correction après première CI : l’affichage de l’entrée consultait aussi les ressources des projets BASIC sans tableau assets. Sélection de la collection selon le mode ; parcours navigateur complet réussi localement après correction. Contrôles distants de la nouvelle tête encore à vérifier.

Limites : assembleur lié aux tables du décodeur (pas une preuve indépendante complète), 16 Kio par zone, pas de macros/expressions/relocalisation ; annotations des ressources dans projets BASIC mixtes et agent IA binaire non réalisés. Labels manuels, classement humain, aucun graphe/trace/banque ni décompilation BASIC. Brouillons non enregistrés protégés à la fermeture, sans récupération après crash. Suite : qualification assembleur indépendante et projets mixtes, puis routines expliquées/éditées par IA avec tests. Les jeux/ROM/captures commerciales et projets d’essai restent hors Git.

## Incrément du 13 octobre — compatibilité réelle 0.41.4

Base distante : PR #64 fusionnée après réussite des trois workflows, commit `9ef09cb84d05136cedf2140e42f0455c5c96f51e`. Branche `fix/dsk-historical-compatibility`. Le build WASM et les contrôles éditeur Windows/Linux de 0.41.3 sont donc validés en CI, malgré le blocage local du SDK décrit dans l'historique. Vérifier la PR de cette nouvelle branche avant d'annoncer sa fusion.

Trois images réelles étudiées localement sans publication : Nebulus et Vindicator contiennent chacun un chargeur BASIC récupérable et sept ressources ; Deflektor ne fournit aucun BASIC reconnu, seulement trois binaires. Correction ciblée : accepter les signatures standard exactement complétées d'espaces (Vindicator), en conservant tous les contrôles de secteurs/allocations et les originaux. Writer et montage natif inchangés. 409 tests unitaires, vérification TypeScript et contrôle documentaire/schémas réussis. [Guide et recette manuelle](implementation/recovery-protection-alpha.md#compatibilité-historique-et-essais-réels--0414).

Deux projets réellement créés/rouverts/reconstruits ; sept ressources chacun conservées à l'identique. Comparaison native initial/reconstruit avec ROM contrôlées : question du chargeur puis menu Nebulus, illustration puis menu Vindicator atteints. Captures inspectées ; aucune partie complète ni nouvelle validation indépendante revendiquée. Script `qualify-real-disk.mjs` reproductible avec fichiers/ROM locaux ; captures, DSK et projets hors Git, aucune nouvelle CI de jeu ni installation déclenchée.

Suite : projets entièrement binaires persistants (cas Deflektor), annotations code/données puis assembleur avec aller-retour prouvé. Pas de reconstitution universelle BASIC ; tester parties/émulateur indépendant et étendre caractères/profils. Ne pas confondre source du chargeur et source complète du jeu.

## Incrément du 13 octobre — récupération et distribution 0.41.3

Base distante : `main` à `93b4237801b9c446d678ccb74170b6a5a6586479`, PR #63 fusionnée après succès des contrôles spécifications, natif/disque, WASM, éditeur Linux et Windows. Branche de cette tranche : `feat/dsk-recovery-protection`. Vérifier sa PR et ses contrôles avant d'annoncer la fusion de 0.41.3.

Demande prioritaire : aller jusqu'au parcours utilisable de récupération et ajouter les trois modes de distribution. Réalisé : BASIC tokenisé/protégé via codec local MIT, détection indépendante des extensions, import isolé BAS/BIN, DATA/SYSTEM standard/Extended ordinaires 40 pistes, ressources déclarées et réintégrées au build/F5/agent, extraction brute, lecture linéaire Z80 annotable/exportable, obfuscation/protection/combinaison sur copies avec aperçu. [Guide et compatibilité exacte](implementation/recovery-protection-alpha.md), [ADR 0062](adr/0062-recuperation-distribution-basic.md).

Preuves locales : 407 tests réussis, TypeScript, renderer/main, parcours Chromium réel UI → worker/stockage → trois DSK ; sources claires inchangées. Recette native du moteur CPC et trois ROM 6128 anglaises explicitement contrôlées : résultats identiques pour clair/obfusqué/protégé/combiné ; vrais SAVE P/SAVE A récupérés ; scénario import → édition → LOAD/CALL du binaire préservé réussi (résultat 78). Comparaison Z80 externe : 699 encodages, 693 identiques, six différences documentées selon Zilog. Scripts de recette et preuves régénérables sous out/. Aucun installeur déclenché. Le build WASM local est bloqué par SIGSEGV de clang du SDK dans cet environnement ; CI complète et nouvelle recette IPC à vérifier pour cette tête.

Limites : ASCII éditable seulement (glyphes CPC non convertibles conservés bruts), autres géométries/utilisateurs/protections disque refusés, dépendances non analysées automatiquement, ajout au projet courant non réalisé. Obfuscation conservatrice et autonome ; FN/portées/accès machine refusés. Z80 documentaire : ni reconstitution exacte des symboles, ni réassemblage, ni décompilateur BASIC universel. L'extraction et la copie des originaux restent possibles sans source convertible. Les fichiers source réellement compilés demandent un format identifié ou une reconstruction explicitement qualifiée.

Suite : valider un DSK réel fourni sans le publier ; qualifier le jeu de caractères CPC, les noms historiques et les profils supplémentaires ; élargir les recettes firmware (multifichier/binaire) et émulateur indépendant ; compléter l'atelier Z80 puis reprendre FN/portées. Conserver les spécifications longues comme cible : ne pas marquer tous leurs lots comme réalisés.

## Complément du 13 octobre 2026 — import et récupération de sources

Base relue : `main` à `50949c2fab9fc6c1ef746f3756425b27971688ca`, fusion de la PR #61 ; aucune PR ouverte lors de la vérification précédant ce travail. Branche de cadrage : `docs/dsk-project-import`. Le code reste en 0.41.1 ; aucun codec, exécutable ou nouveau build livré par ce complément.

Deux demandes sont désormais détaillées : [DSK vers projet](specifications/20-import-dsk-projet.md), puis [récupération de sources et atelier Z80](specifications/21-retro-ingenierie-z80.md). L'objectif est de récupérer une source exploitable, BASIC compris si son format le permet, sans se fier à l'extension BIN/BAS. Le lecteur réel est limité à standard DATA 40 pistes/une face/utilisateur 0 ; détokenisation et parcours d'import restent à construire. Pour les fichiers compilés, distinguer source conservée, assembleur reconstruit et réécriture BASIC assistée ; aucune récupération exacte universelle.

Les deux roadmaps et les sommaires sont actualisés. La séquence FN/portées ci-dessous est préservée, sans faire passer ces nouvelles spécifications pour une livraison. Pour attaquer le chantier demandé, commencer par DSK-A/B/C et constituer les fixtures originales/redistribuables avant le code ; suivre ensuite les lots Z80. Les autres profils disque et compilateurs sont à qualifier séparément.

Validation de ce complément : `python scripts/check_specs.py --schemas` réussi (145 Markdown, 20 JSON, 84 exigences, 37 scénarios, cinq schémas et six exemples) et `git diff --check` réussi. Aucun test fonctionnel d'import ou de désassemblage annoncé. Les preuves 0.41.1 ci-dessous restent historiques.

## Incrément du 13 octobre — import ASCII 0.41.2

Autorisation explicite de publier et de commencer le développement. Le cadrage est fusionné dans `main` par la [PR #62](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/62), commit `2bb4732d10eb3bd0dcc93c3f605384265b2907b1`. Développement sur `feat/dsk-project-import`, version 0.41.2 : [guide](implementation/dsk-import-alpha.md), [ADR 0061](adr/0061-import-dsk-ascii.md). Vérifier la PR de cette branche et son état avant de déclarer le code intégré à `main`.

Réalisé : catalogue DATA strict, aperçu, sélection ASCII et entrée, création d'un nouveau dossier projet, noms CPC conservés indépendamment de l'extension, original DSK et enregistrements bruts conservés, rapport portable, garde d'empreinte et arbitrage des brouillons. L'agent existant peut travailler sur les sources importées. Les fichiers tokenisés/protégés/binaires sont classifiés et conservés, pas convertis ni réintégrés au build.

Preuves locales : 400 tests réussis, TypeScript, builds renderer/main et contrôle syntaxique des scripts réussis. Parcours Chromium avec vrai worker/stockage réussi, capture inspectée (`out/dsk-import-alpha.png`) ; une étiquette de sélection a été corrigée pendant cette recette. Les dialogues natifs et IPC disposent d'une recette ajoutée à la suite Electron, à vérifier en CI. Aucun nouveau test CPC/ROM/émulateur indépendant ni build installable local revendiqué.

Prochaine tranche demandée : **DSK-B, détokenisation BASIC non protégé**, puis DSK-C (ressources exécutables et parcours multifichier complet). Qualifier tokens, nombres, chaînes/DATA/commentaires, RSX et caractères CPC avant le codec ; ne pas utiliser l'IA pour deviner les octets. Extended, autres géométries et protection SAVE P suivent. La [récupération de sources/Z80](specifications/21-retro-ingenierie-z80.md) vient ensuite. L'[obfuscation BASIC](specifications/22-obfuscation-basic.md), question complémentaire, est une proposition P2 non implémentée dépendant notamment du renommage sémantique.

Limites de reprise de l'import : staging conservé en cas d'échec, pas de reprise automatique ni qualification panne électrique/Windows ; sauvegarder tout le dossier pour garder les originaux `.microide/imports/`. Ne pas assimiler les tests synthétiques à une compatibilité universelle des anciennes disquettes.

Précision utilisateur ajoutée pendant la réalisation : IDE-078 est retenu avec trois modes **obfuscation seule / BASIC protégé seul / combinaison des deux**, appliqués uniquement à une copie de distribution. Ordre : obfuscation, validation puis format protégé qualifié. Source claire et table de correspondance restent hors DSK ; aucune promesse d'inviolabilité. Fonctionnalité spécifiée, non implémentée, après ses prérequis de renommage/codec et sans interrompre l'import DSK.

## Base historique de la pause

- Dépôt : `AstrowareConception/Micro-IDE-Amstrad`.
- `main` au commit **`0152099bd6b74b87d58a9a567e6a03d41dbf1f7f`** : alpha desktop **0.41.1**, [PR #60](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/60) fusionnée après la [PR #59](https://github.com/AstrowareConception/Micro-IDE-Amstrad/pull/59). Aucune PR ouverte au moment de ce constat. Une ancienne branche locale ne remplace pas `main` distant.
- Tranches déjà intégrées : édition/projets multifichiers, F5 et CPC intégré, debugger BASIC initial, diagnostics et monitoring, rapport Qualité, suites/scénarios de tests, Git/GitHub, agent IA, personnalisation, analyse de flux jusqu’aux piles de boucles 0.40.9, index Symboles/usages 0.41.0 et types possibles 0.41.1. Lire les guides pour le périmètre exact : nombre de ces capacités restent **partielles**.

## Travail 0.41.1

Types explicites par suffixe, types implicites possibles par première lettre, déclarations DEFINT/DEFREAL/DEFSTR navigables. Analyse conservatrice de toute la source, pas une simulation de l’ordre d’exécution. Contextes incomplets signalés. Exports Symboles version 2, budgets et gardes d’obsolescence préservés. [Réalisation](implementation/basic-symbols-alpha.md#types-0411), [ADR 0060](adr/0060-types-possibles-symboles-basic.md).

## Vérifications de cette reprise

- 394 tests unitaires réussis, dont sept nouveaux tests de types.
- TypeScript et build desktop réussis.
- Suite firmware intégrée terminée : 202 scénarios, dont six nouveaux cas de types réussis ; les scénarios négatifs conservent leurs résultats attendus.
- Recette Chromium complète réussie, dont types, navigation des déclarations, exports et liens obsolètes. Capture inspectée et mise à jour dans le guide.
- Contrôle documentaire réussi : 143 Markdown, 20 JSON, 84 exigences, 37 critères, cinq schémas et six exemples.
- CI de la tête de PR #60 : cinq contrôles terminés avec succès (spécifications, natif/disque, WASM, éditeur Linux et Windows). Ces chiffres décrivent cette tranche, pas les futurs commits.

Les ROM privées sont hors Git. La qualification reste celle du jeu CPC 6128 anglais identifié dans le moteur intégré, sans nouvelle preuve sur matériel ou émulateur indépendant. La version de [GitHub Releases](https://github.com/AstrowareConception/Micro-IDE-Amstrad/releases) peut être plus ancienne que le code ; aucune nouvelle préversion binaire n’est annoncée ici.

## Tranche intelligence IDE conservée : fonctions DEF FN et portées

**But :** faire progresser IDE-015 sans confondre paramètre, variable libre et globale. La 0.41.1 omet explicitement définitions et appels FN. La concordance du nom ne suffit pas à prouver une identité.

1. **Qualifier avant de coder.** Relire `AGENTS.md`, les documents de langage 14/15, `knowledge/locomotive-basic`, l’[ADR 0060](adr/0060-types-possibles-symboles-basic.md) et le [guide Symboles](implementation/basic-symbols-alpha.md). Constituer une matrice de listings pour `DEF FNnom[(paramètres)]=expression`, appels `FNnom`, zéro/un/plusieurs paramètres, suffixes explicites/implicites, homonymie locale/globale, variables libres, redéfinitions, appels imbriqués et formes invalides. Vérifier les effets observables sur le firmware qualifié ; laisser inconnue toute forme non prouvée.
2. **Étendre le domaine borné.** Distinguer fonction, paramètre local et variable libre dans une source, avec occurrences et liens seulement lorsque l’identité est justifiée. Conserver coordonnées exactes, raisons d’omission, quotas, worker à la demande, annulation et protection des snapshots. Ne pas transformer l’ordre textuel des `DEFINT` en preuve d’exécution. Documenter tout nouveau contrat d’export et décider d’un ADR pour les portées.
3. **Valider dans le CPC et l’interface.** Tester masquage local/global, suffixes, branches, commentaires/DATA/chaînes, appels opaques et limites ; relier les assertions firmware aux conclusions de l’index. Vérifier recherches et liens depuis la source active et les buffers chargés, obsolescence, budgets, annulation et confidentialité des exports. Distinguer dans le rapport tests exécutés, limites connues et qualifications non faites.

**Critère de sortie :** un paramètre et une globale homonymes ne sont pas confondus ; chaque lien FN annoncé est justifié ; les formes inconnues sont omises avec une raison visible. IDE-015 reste partiel tant que la navigation sémantique entière n’est pas qualifiée.

## Tranches suivantes, dans cet ordre

| Tranche | Travail | Critère de sortie et dépendance |
| --- | --- | --- |
| Accès depuis le curseur | Ouvrir sur demande les usages/une définition reconnue du symbole sous le curseur ; préserver source et plage exactes. | Aucun calcul supplémentaire à la frappe ; chaînes, commentaires, DATA et segments opaques exclus ; snapshot obsolète non navigable. Dépend des identités FN qualifiées ou affiche clairement leurs limites. |
| Renommage sémantique (IDE-017, non réalisé) | Proposer le nom, un **aperçu du diff de chaque source**, les collisions et conséquences des suffixes, types et portées ; appliquer après révision humaine. | Refuser les identités ambiguës et les sources modifiées ; préserver chaînes/DATA/commentaires, fonctions et tableaux ; undo, brouillons et préconditions testés. Dépend d’IDE-015 suffisamment qualifié. |
| Profiler 0.42 | Mesurer sur le CPC exécuté fréquences et coûts des lignes ou statements, puis montrer des hotspots avec provenance. | Mesure et surcoût quantifiés, budget/arrêt explicites, mapping et firmware qualifiés ; ne pas confondre estimation lexicale et temps mesuré. Dépend des hooks et du debugger. |
| Agent observant le CPC 0.43 | Outils contrôlés pour exécuter, observer l’écran/état autorisé, lancer des tests, expliquer, corriger et revérifier avec checkpoints. | Permissions/budget clairs, preuve de l’exécution et diff restaurable ; documents sans shell hôte, ROM et secrets protégés. Dépend du CPC et des tests qualifiés. |

## Chantiers ouverts au-delà de cette séquence

Le [backlog qualifié](specifications/17-roadmap-ide-complet.md) reste la liste exhaustive. Les points suivants ne sont pas tous des prérequis à la tranche FN :

- **Langage et qualité :** parser/références non exhaustifs (IDE-013/014), inspections/formatage absents (IDE-019), flux 0.40 partiel sur certains `NEXT`, portées franchies, erreurs implicites et événements (IDE-076). Les tests BASIC (IDE-077) n’ont ni couverture, ni fixtures binaires, ni génération IA de tests.
- **Debugger et CPC :** variables/tableaux/chaînes, pile GOSUB/RETURN, Step Over/Out, watchpoints, gouttière Monaco et autres firmwares restent à qualifier (IDE-054). Inspection intégrée et validation externe ne sont pas équivalentes.
- **Projet et fiabilité :** récupération Windows/panne électrique, autres mutations, import d’anciens projets, historique/restauration élargis, watcher, conflits externes et certains états d’onglets (IDE-001 à 012). Préserver les brouillons et distinguer source UTF-8, fichier CPC, disquette et session émulée.
- **Atelier, Git et IA :** modèles/assistant de démarrage, explorateur enrichi, fenêtres système, merge/rebase/conflits Git, SSH/OAuth/coffre et boucle IA observant le CPC restent ouverts ; voir IDE-002/005/027/035/036/039/062–067.
- **Distribution 1.0 :** previews Windows/Linux non signées et smoke du binaire empaqueté déjà présents ; signature, installation/mise à jour/désinstallation, matrice fonctionnelle installée, ARM64/macOS, canaux stables, accessibilité et J6 restent ouverts (IDE-070 à 074). Ne pas déclencher un packaging à chaque commit.

Ne pas déclarer J0–J6, R1–R9 ou la version 1.0 achevés sur la seule base de cette alpha.

## Méthode de continuité

1. Lire ce document, `AGENTS.md`, les deux roadmaps et le guide du lot. Vérifier `main` distant, les PR, contrôles et la version des Releases. Si `main` a dépassé `0152099…`, prendre ses changements comme état courant et actualiser ce document. Ne pas repartir automatiquement d’une ancienne branche locale.
2. Choisir une seule tranche cohérente selon l’état le plus récent en tête de ce document, créer sa branche depuis `main`, puis fixer la matrice de preuves et les limites. Regrouper code, exemples, tests utiles, ADR/guide/roadmap et nouveau point de reprise dans une PR. Vérifier les contrôles adaptés au diff et lire la première erreur réelle avant toute relance.
3. Avant la prochaine pause, inscrire ici commit de `main`, PR, preuves effectivement observées, limites et prochaine action. Les fichiers temporaires et logs locaux ne remplacent pas un commit publié. Ne jamais y copier clé API, ROM, document personnel ou conversation privée.

**Instruction de reprise courte :** « Reprends CPCéleste après lecture d’AGENTS.md et du dernier incrément en tête de docs/reprise.md. Vérifie main distant, la PR de cette branche et ses contrôles ; la suite prévue est le cadrage du renommage avec aperçu après la navigation au curseur 0.41.13. Préserve les limites, garde la documentation à jour et ne déclenche pas un packaging par commit. »
