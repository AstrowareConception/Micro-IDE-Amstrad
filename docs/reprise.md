# CPCéleste — Point de reprise du développement

## Incrément 0.41.31 — scénarios projet dans l’interface

Base vérifiée : `main` à `62a9ae080d34a4bbcac1247df1b9911b8c5c6705`, PR #92 fusionnée après Specifications, J0 et Desktop Linux/Windows réussis sur `921606de8a14eec24959fe9d85126db302e0488a`. Branche : `feat/project-scenarios-ui`.

Réalisé : panneau Tests projet, création/édition/suppression de scénarios, clavier avec échappements réversibles, attentes fichier et rectangle/empreinte écran. Sauvegarde humaine avec contrôle de révision, brouillons protégés à la fermeture/changement de projet. Lancement du vrai DSK depuis les buffers ouverts et ressources, sans clé IA, worker annulable et opérations concurrentes bloquées. Rapport construit dans le processus principal, historique partagé avec les missions, comparaison des révisions, export JSON et erreurs d’archivage visibles. Formats existants conservés ; aucun outil agent d’écriture des attentes. [Guide](implementation/project-scenarios-ui-alpha.md), [ADR 0081](adr/0081-interface-scenarios-projet.md).

Preuves locales : 550 tests Node, TypeScript et build desktop réussis ; trois essais réels via le nouveau contrôleur (succès, buffer PART altéré rejeté, retour au succès) avec attentes identiques, sources hôte/ressource intactes et historique relu. Rapport `out/project-scenarios-qualification.json`. Contrôle documentaire réussi : 195 Markdown, 24 JSON, 84 exigences, 37 scénarios, sept schémas et huit exemples. Voir le bilan de PR pour la qualification CI finale sur le SHA exact.

CI : ajout de la recette CPC et d’un parcours Electron de préparation clavier/fichier/écran, protection du brouillon, blocage sans ROM, import ROM, succès/échec, export, réouverture, conflit externe, suppression et arrêt. Premier passage : spécifications/J0/Windows verts, banc firmware et recettes natives historiques réussis ; le nouveau parcours atteint un succès CPC puis révèle l’export Blob non déclenché. Correction par dialogue natif, rapport retrouvé dans le processus principal, destination hors projet contrôlée ; tri des rapports ajoutés par un autre producteur et captures agrandies ajoutés à la recette. Le deuxième passage confirme l’export natif et la protection des sources ; les libellés accessibles des sélecteurs et du texte attendu sont ensuite explicités et les confirmations de la recette sont pilotées avec leur message vérifié. La nouvelle recette native est placée juste après la préparation des ROM pour détecter ses erreurs avant le long banc historique, qui reste intégral et bloquant. Une erreur de construction avant démarrage reste affichée après actualisation ; listing aux numéros invalides couvert dans le contrôleur et dans la recette native, sans faux rapport CPC. Tests ciblés, typage, build et contrôle documentaire revérifiés. Un essai Ozone sans affichage local n’a pas permis de démarrer Electron ; contrôler la recette complète et les captures sur le dernier SHA avant fusion. Aucun packaging par commit.

Limites : référence écran encore renseignée par empreinte, sans capture de référence ni adoption automatique d’un résultat. Correspondance de l’historique établie au dernier état relu ; actualiser après édition externe des attentes. Observations au terme du budget, sans preuve de terminaison, couverture exhaustive ou équivalence universelle ; pas de matériel ou d’émulateur indépendant.

Suite prioritaire : préparer une référence écran par capture inspectable et adoption humaine explicite, puis élargir les structures selon les besoins (IF dans les corps et imbrications), profiler 0.42 et observation CPC 0.43. Ce point remplace les suites historiques ci-dessous.

## Incrément 0.41.30 — tests du vrai projet dans la mission

Base vérifiée : `main` à `3ac8f3d8d80fe0a4d536ac83296861ccced3c2a5`, PR #91 fusionnée après Specifications, J0 et Desktop Linux/Windows réussis sur `d383e63e1ddc45c74f24d069bda0d7a6bd595cd9`. Branche : `feat/agent-project-tests`.

Réalisé : outils `project_tests_list/run`, bibliothèque humaine `microide.project-tests.json` en lecture seule pour l’agent, vrai DSK construit depuis sources/ressources et entrée du manifeste. Worker CPC isolé, ROM 6128 anglaises identifiées, 1–15 secondes émulées, 60 secondes réelles, cinq essais par mission. Observations écran RGBA ou fichiers ASCII, saisies bornées, aucune instrumentation ni injection de fixture, aucune sortie copiée dans le projet hôte. Rapports avec empreintes, historique borné et statut final contrôlé : dernier essai de chaque scénario invoqué réussi sur la révision finale ; référence initiale aux mêmes attentes/ROM distinguée. Notes exclues de l’identité d’exécution. Attentes modifiées et anciennes révisions invalidées. Panneau séparé des listings autonomes, mission et consignes alignées. Exemple utilisable ressource/clavier/sortie, contrat JSON version 1 et contrôle documentaire des ressources brutes corrigé ; les `.bin` sont marqués binaires dans Git pour préserver leurs octets CRLF/EOF. [Guide](implementation/agent-project-tests-alpha.md), [ADR 0080](adr/0080-tests-vrai-projet-agent.md).

Preuves locales : six témoins de lisibilité avec le vrai contrôleur, fournisseur déterministe et vrai worker CPC ; six oracles littéraux, douze essais avant/après, un module volontairement altéré rejeté et un projet ressource/clavier/sortie réussi, soit vingt exécutions observées. ROM manquantes et annulation du worker contrôlées. Attentes et ressources intactes, sorties isolées, historique relu. Banc historique rejoué après partage de l’observation : 202 cas avec verdicts attendus, puis recette worker historique réussie. 545 tests Node, TypeScript et build desktop réussis ; exemple aussi exécuté via le worker JavaScript compilé et le WASM empaqueté. Contrôle documentaire valide : 193 Markdown, 24 JSON, 84 exigences, 37 scénarios, sept schémas et huit exemples. Voir le bilan de PR pour la qualification CI finale.

CI : recette firmware ajoutée et parcours Electron `--project-tests` avec import ROM par l’interface, deux missions avant/après, restauration initiale, fermeture/réouverture, retour durable à la dernière mutation et conservation des quatre rapports. Pas de serveur d’affichage local ; contrôler cette recette et les workflows sur le SHA exact de la PR avant fusion. Aucun packaging par commit.

Limites : attentes à préparer dans un JSON humain, pas encore d’éditeur/capture/historique projet dans l’interface ; seuls les résultats de la mission courante y sont montrés. Observations à la fin du budget, sans preuve de terminaison, de couverture de chaque fichier/chemin ni d’équivalence universelle. Petits témoins, fournisseur déterministe, pas de matériel ou d’émulateur indépendant. Restauration complète en session et dernière mutation durable restent distinctes.

Suite prioritaire : préparation et consultation humaines des scénarios projet dans l’interface, puis élargissement des structures selon les besoins (IF dans les corps et imbrications), profiler 0.42 et observation CPC 0.43. Ce point remplace les suites historiques ci-dessous.


## Incrément 0.41.29 — mission de lisibilité composée

Base distante vérifiée : `main` à `aa2e40e4df04d23f1316a3e7ce1ae44c39077da1`, PR #90 fusionnée en 0.41.28 après réussite Specifications, J0 et Desktop Linux/Windows sur `9d47c6496877e88355218ce1f13434435dd9e992`. Les boucles sont donc déjà livrées. Branche de cette tranche : `feat/basic-readability-pipeline`.

Réalisé : mission et libellés alignés sur les outils déterministes disponibles ; profil v5 pour REM documentaires autonomes autour des instructions v2/v3/v4, avec transfert des commentaires d’entrée dans PART et conservation des lignes. Directives, commentaires inline et états opaques refusés ; consultation REM obligatoire. CLS sans argument ne bloque plus l’index des variables. Six programmes composent renommage, formatage effectif, insertion REM, note, renouvellement du plan puis extraction avec le vrai contrôleur, fournisseur déterministe et disque réel. Journal inchangé. [Guide](implementation/basic-readability-pipeline-alpha.md), [ADR 0079](adr/0079-composition-lisibilite-basic.md).

Preuves locales : 537 tests Node réussis, typecheck réussi ; six témoins (expression, condition vraie/fausse, FOR zéro/trois tours, WHILE décroissant) et six références littérales, soit 30 exécutions CPC réussies sur les projets original/appliqué-rouvert/dernière mutation rétablie/checkpoint initial restauré. Rapport avec empreintes sans ROM. Restauration complète des sources et documents en session ; retour durable au monolithe déjà renommé/commenté après réouverture. La source du checkpoint initial est normalisée LF, sans promesse de CRLF byte pour byte. Recette v4 rejouée après partage de l’observateur firmware : 44 exécutions réussies. Build desktop réussi ; documentation valide (190 Markdown, 21 JSON, 84 exigences, 37 scénarios, six schémas et exemples).

CI : ajout de la recette firmware bloquante et du parcours natif `--readability` aux profils v1/v2/v3/v4 ; préparation par options UI, application, restauration initiale, nouvelle mission, fermeture complète/réouverture, annulation, brouillon et retour durable à la seule extraction. Chromium/Electron absents localement : contrôler les workflows et la capture sur le SHA exact de la PR avant fusion. Aucun packaging par commit.

Limites : profils fermés, petits témoins et fournisseur déterministe ; ni validation des choix d’un modèle réel, ni équivalence universelle/mémoire/temps, ni matériel/émulateur indépendant. Les suites agent actuelles exécutent des listings autonomes ; le test du vrai DSK multifichier est encore une recette externe, explicitement distinguée dans le bilan. Après redémarrage, seule la dernière mutation disque est restaurable, pas toute la mission.

Suite prioritaire : scénarios CPC liés au vrai projet/DSK et à ses empreintes pour permettre à l’agent de tester avant/après le découpage ; ensuite IF dans les corps et imbrications selon les besoins, profiler 0.42 et observation CPC 0.43. Les suites historiques ci-dessous sont remplacées par ce point.

## Incrément 0.41.28 — boucles simples dans le découpage terminal

Base vérifiée : `main` à `913eac4d1180beca6302ce4474675d2438b3a315`, PR #89 fusionnée, version 0.41.27. Specifications, J0 et Desktop Linux/Windows ont réussi sur `395e08a4f70236368c40266bb384938b97dab3a9`, y compris les parcours natifs v1/v2/v3. Branche de cette tranche : `feat/basic-extraction-loops`.

Réalisé : profil v4 distinct pour FOR/NEXT nommé à compteur %, bornes et pas entiers littéraux, et WHILE/WEND à compteur % initialisé, borne littérale et mise à jour monotone finale. Les boucles restent entières du même côté de CHAIN MERGE ; aucun compteur FOR modifié dans son corps, aucun IF ou boucle imbriquée dans les corps. IF simples possibles hors boucles avec conservation des deux issues. Contrôle de chaque tour et du compteur de sortie ; corps sautés vérifiés sur une copie jetée sans adopter leurs affectations. Quatre boucles, 32 tours par boucle/état, 8192 visites cumulées. Profils v1/v2/v3 et journal durable conservés. Fiches éditoriales WHILE/WEND ajoutées depuis le corpus fourni ; contrôle de consultation, consignes modèle/outil et aperçu alignés. Version 0.41.28. [Guide](implementation/basic-multifile-loops-alpha.md), [ADR 0078](adr/0078-boucles-decoupage-terminal.md).

Preuves locales terminées : 530 tests Node, typecheck et build desktop réussis ; documentation valide (188 Markdown, 21 JSON, 84 exigences, 37 scénarios, six schémas et exemples). Quatorze témoins v4 exécutés depuis les vrais projets original/appliqué-rouvert/restauré-rouvert et deux références d’affichage littérales : 44 exécutions CPC réussies. Zéro/un/plusieurs tours, progression positive/négative, compteurs après sortie, combinaison FOR/WHILE avec conditions hors corps, chaînes et PRINT. Restauration exacte des sources CRLF/manifeste, retrait de PART et identité du DSK restauré vérifiés. Recette v3 rejouée après partage du validateur : 26 exécutions réussies. Tests négatifs sur frontières, corps sautés, compteur précédé d’espaces, dépassements différés et budgets. ROM externes identifiées, non distribuées.

CI ajoutée : recette v4 bloquante, rapport JSON et parcours Electron `--loops` (application, fermeture complète, réouverture, annulation, brouillon et restauration exacte). Recettes v1/v2/v3 conservées. La qualification native n’est pas exécutée localement ; vérifier les workflows sur le SHA exact de la PR de cette branche avant fusion. Aucun packaging par commit.

Limites : profil fermé, conservateur pour les branches et corps sautés ; refus possible de programmes valides. Pas de conditions dans les corps, boucles imbriquées, bornes/pas dynamiques, NEXT multiple, sorties anticipées, GOSUB/RETURN/DATA ou ressources. Les témoins ne prouvent pas tous les programmes admis, la mémoire libre ou le timing, ni du matériel ou un émulateur indépendant.

Suite prioritaire : qualifier une mission complète de lisibilité sur des programmes représentatifs — renommage, commentaires, mise en forme, découpage admissible et tests avant/après. Les blocages guideront les extensions de structures, notamment IF dans les boucles et imbrications. Profiler 0.42 et observation CPC 0.43 ensuite. Les prochaines étapes historiques ci-dessous sont remplacées par ce point.


## Incrément 0.41.27 — conditions simples dans le découpage terminal

Base vérifiée : `main` à `426f812a1ced890b7f94da0ba9891c394d596f2e`, PR #88 fusionnée, version 0.41.26. Les trois workflows de la PR précédente ont réussi sur `93813a0ee240f7c6751ce0a3744d0e737ccd0db1`, dont les parcours natifs v1/v2. Branche de cette tranche : `feat/basic-extraction-conditions`.

Réalisé : profil v3 distinct pour IF comparaison THEN instruction [ELSE instruction], comparateurs =/<>/</<=/>/>= entre expressions de même type, une instruction par branche. Validation des deux issues, y compris constantes et sans ELSE ; propagation des états jusqu’à la fin, six IF et 64 chemins maximum. Profils v1/v2, aperçu immuable, journal, révisions et restauration durable conservés. Consultation de IF avant application ; consignes modèle, description d’outil et profil du panneau alignés. Version 0.41.27. [Guide](implementation/basic-multifile-conditions-alpha.md), [ADR 0077](adr/0077-conditions-decoupage-terminal.md).

Preuves locales terminées : 521 tests Node réussis ; typecheck et build desktop réussis ; documentation (186 Markdown, 21 JSON, 84 exigences, 37 scénarios, six schémas et exemples) valide. Huit témoins v3 exécutés depuis les vrais projets original/appliqué-rouvert/restauré-rouvert, plus deux références d’affichage littérales : 26 exécutions CPC réussies, comparateurs vrais/faux sur entiers et chaînes, ELSE absent, POKE et affichage conditionnels. Restauration exacte des sources CRLF/manifeste, retrait de PART et identité du DSK restauré vérifiés. Recette v2 partagée rejouée : quinze exécutions CPC réussies. ROM externes identifiées, non distribuées.

CI ajoutée : recette v3 bloquante, rapport JSON et parcours Electron `--conditions` (application, fermeture complète, réouverture, annulation, brouillon et restauration exacte), en conservant les recettes v1/v2. La qualification native n’est pas exécutée dans l’environnement local ; contrôler les workflows sur le SHA exact de la PR de cette branche avant fusion. Aucun packaging par commit.

Limites : exploration conservatrice, sans suppression des combinaisons impossibles ; des programmes valides peuvent donc être refusés. Pas de IF imbriqués, sauts conditionnels, plusieurs instructions par branche, boucles, fonctions, DATA ou ressources. Les témoins ne prouvent pas tous les programmes admis, la mémoire libre ou le timing, ni du matériel ou un émulateur indépendant.

Suite prioritaire : boucles simples avec témoins couvrant leurs parcours et frontières, puis mission de lisibilité sur programmes représentatifs ; profiler 0.42 et observation CPC 0.43 ensuite. Les prochaines étapes historiques ci-dessous sont remplacées par ce point.



## Incrément 0.41.26 — expressions et affichage dans le découpage terminal

Base distante vérifiée : `main` 0.41.25, `cca5d6fcad7de0c2ec619e61727233f31f8f18d9`. PR #87 fusionnée après réussite Specifications, J0 et Desktop Linux/Windows sur `9003e6638efafe1ae863512a1f05d01657aaef19`. Branche du nouveau lot : `feat/basic-extraction-expressions`. Vérifier sa PR et les workflows de sa tête exacte avant fusion. Aucun packaging déclenché.

Réalisé : profil initial v1 conservé ; profil v2 distinct pour scalaires explicitement typés %/$ et initialisés, expressions entières +/−/× avec parenthèses et bornes, concaténation de chaînes, PRINT à séparateurs explicites, MODE 0..2 et CLS. Grammaire fermée, propagation de valeurs sur le chemin séquentiel, quotas et refus des formes opaques. Même aperçu immuable, même journal et même restauration durable. Contrôles de consultation des références préservés. Consignes envoyées au modèle alignées sur simulation/application v1/v2 : retrait de l’ancienne affirmation erronée « aucun outil d’application », sans permettre de contourner les refus ; contrat vérifié dans le test du transport fournisseur. Le panneau IA distingue les profils et l’en-tête affiche 0.41.26. [Guide](implementation/basic-multifile-expressions-alpha.md), [ADR 0076](adr/0076-expressions-decoupage-terminal.md).

Preuves locales terminées : 515 tests Node, TypeScript, builds renderer/main ; contrôle documentaire réussi (184 Markdown, 21 JSON, 84 exigences, 37 scénarios, six schémas et six exemples). Quatre témoins réellement appliqués, rouverts et restaurés, avec octets CRLF et manifeste exacts : douze exécutions CPC sur ROM identifiée et trois programmes de référence littéraux pour l’affichage. Les quatre variantes arithmétiques/vidéo donnent les valeurs RAM attendues ; les trois modes vidéo correspondent aux références sur les lignes imprimées hors prompt/curseur. Aucun octet ROM dans le rapport. La recette firmware est bloquante en CI ; le parcours Electron existant garde v1 et ajoute v2 (`--expressions`). Chromium/Electron manquent localement : ne pas annoncer leur succès avant contrôle de la CI du nouveau commit.

Limites : entiers et types explicites seulement dans v2 ; pas de division, fonctions, tableaux, branches, boucles, DATA, commentaires, flux PRINT #/USING ou ressources. Les anciens programmes v1 conservent leur contrat historique. La propagation de valeurs n’est pas un émulateur CPC, les témoins ne prouvent pas une équivalence universelle ou temporelle. Journal avec reprise conservé, sans écriture indivisible de tout le dossier ni garantie panne électrique/verrou interprocessus. Aucune qualification CPC physique ou émulateur indépendant ajoutée.

Suite prioritaire : conditions simples et témoins distinguant leurs chemins, puis boucles et états plus complexes ; mission de lisibilité sur programmes représentatifs ; profiler 0.42 et observation CPC 0.43. Les « prochaines étapes » historiques ci-dessous sont remplacées par ce point courant.

## Incrément 0.41.25 — application du découpage et restauration durable

Base distante vérifiée : `main` 0.41.24, `0cd7e9a6f36457c5b0d70f1571a540ad52114a7f`, PR #86 fusionnée et ses trois workflows réussis sur `d61ab8b9e3a93a0289cac88f72f59ad8ff7733f3`. Branche `feat/basic-multifile-apply`. Consulter sa PR et la CI exacte avant de conclure à sa fusion. Aucun packaging déclenché.

Livré dans cet incrément : `language_extraction_apply` consomme uniquement le plan prévisualisé, avec SHA source, snapshot projet et compteur de mutations. Application des deux sources/manifeste via le journal existant ; état adopté après commit, échecs explicites et collisions de casse refusées. Nouveau menu Projet « Rétablir la dernière modification IA… » : restauration du dernier checkpoint disque après fermeture/réouverture, sans clé API, buffers propres et révision exacte exigés. Profil BASIC strict inchangé. [Guide](implementation/basic-multifile-apply-alpha.md), [ADR 0075](adr/0075-application-decoupage-journalise.md).

Preuves locales : TypeScript, 509 tests Node, builds renderer/main et dix interruptions de processus ciblées réussis. Essai firmware du projet réellement appliqué, réouvert puis restauré : trois DSK produisent [11,42,24], retour exact des octets CRLF et du manifeste. Rapport sans ROM. Chromium/Electron non installés dans cet environnement local : recette navigateur/native laissée à la CI existante, avec nouvelle recette Electron bloquante couvrant l’agent contrôlé, le redémarrage complet, l’annulation, les brouillons et la restauration. Contrôle documentaire réussi : 182 Markdown, 21 JSON, 84 exigences, 37 scénarios, six schémas et six exemples.

Suivi PR #87 : sur `918de207`, Specifications, J0, Desktop Windows, recettes navigateur et firmware Linux réussis. La nouvelle recette native a atteint la réouverture et l’annulation, puis bloqué sur un buffer restant modifié après Ctrl+Z. Le témoin utilise désormais une saisie d’un seul caractère et vérifie explicitement le retour à l’onglet propre avant restauration. Le dernier correctif garantit aussi l’affichage intégral d’un aperçu dont la réécriture dépasse les 4096 caractères de la source initiale. Attendre les workflows du nouveau SHA exact avant fusion ; ne pas déduire leur succès des résultats précédents.

Limites : journal avec reprise, pas d’écriture indivisible du répertoire, pas de preuve panne électrique/verrou interprocessus. Une interruption peut laisser un état mixte bloqué jusqu’à reprise. Les choix Terminer/Rétablir se rapportent toujours à la transaction initiale, y compris après interruption de sa restauration. Retour durable à la dernière mutation disque, distinct du checkpoint initial de mission et de ses brouillons. Aucune nouvelle qualification CPC physique/émulateur indépendant, aucune équivalence universelle. Les tests du témoin ne qualifient pas un jeu arbitraire.

Suite : élargir le profil par classes de programmes et témoins discriminants (expressions/affichage, puis conditions/boucles), avant GOSUB/RETURN/DATA et ressources. Finaliser ensuite la mission de lisibilité sur des programmes représentatifs, puis profiler 0.42 et observation CPC 0.43. Les consignes historiques plus bas sont remplacées par ce point courant.


## Incrément 0.41.24 — premier découpage multifichier simulé, sans écriture

Base : `main` version 0.41.23, commit `71fb1db25ab0a57852622217b9446578fdf2df75` ; PR #85 fusionnée après 499 tests Node et ROM 8 témoins. Branche `feat/basic-multifile-dry-run`, CI à contrôler avant fusion ; aucun packaging automatique.

Un moteur de simulation `previewTerminalExtraction` compare un monolithe et une version MAIN/PART après remplacement d'un GOTO littéral final par CHAIN MERGE. **Profil réduit** : une seule source, pas d'actifs, pas de GOSUB/RETURN/IF/READ/DATA ni chargement préexistant, seulement MEMORY &7FFF, affectations entières, POKE &8000–&8003 et END. Construction DSK originale et candidate sur clones ; aucune mutation de l'espace de travail. Outil agent `language_extraction_simulate` lié au SHA source, avec affichage et péremption. Il n'existe volontairement aucun apply. Nouveau témoin firmware comparant les deux DSK et les marqueurs RAM [11,42,24], vérifié en CI Linux quand la recette aura terminé.

Suite : conception et qualification de la transaction atomique d'écriture/restauration avec contrôles de révision, puis extension prudente de l'espace de transformations.

[Guide et limites](implementation/basic-multifile-dry-run-alpha.md).

## 0.41.23 — témoins d'état CHAIN MERGE étendus

Base : `main` version 0.41.22, commit `5c18d5e1ee54caa960e2bcedda45538e9007a6ae` ; PR #84 fusionnée avec 497 tests Node et recette ROM. Branche `feat/cpc-chain-merge-edge-cases`. Nouveau banc bloquant `scripts/qualify-basic-chain-merge-edge.mjs` avec huit DSK : tableaux/chaînes, pointeur DATA sans RESTORE, DELETE et grande allocation en mémoire. Les contrastes attendus sont inscrits dans les témoins : ne pas confondre divergence et régression, ni déclarer qualifié avant réussite de la CI exacte. Les rapports JSON sont conservés sans ROM. Le moteur `inspectChainMergeOverlay` signale les risques associés, l'agent ne modifie aucun fichier au titre de cet audit. **Aucune extraction multifichier automatique.** Suite : plan global de transformation réversible et tests de projet réels. [Guide](implementation/basic-chain-merge-edge-alpha.md).



## 0.41.22 — CHAIN MERGE et persistance de l'état

Base : `main` 0.41.21 commit `7f3c8a58f2f9d8774dfeb82eb8e0b99842ed6fb5`. Branche : `feat/cpc-chain-merge-state-qualification`. PR à qualifier sur son SHA exact avant fusion ; aucun packaging automatique.

Incrément : moteur en lecture seule `inspectChainMergeOverlay` recensant les collisions de lignes, identifiants communs, DATA/READ/RESTORE, effets mémoire et formes dynamiques ; outil `language_chain_merge_review` avec SHA des deux sources et résultats périmés ; panneau Agent IA. Six programmes témoins sur ROM CPC 6128 réellement exécutée : trois monolithes et leurs variantes CHAIN MERGE à deux fichiers, comparant variables entières, ligne surchargée, données avec RESTORE et valeur HIMEM. Rapport JSON avec empreintes firmware/disques/sources et quatre octets RAM ; ROM non publiée. La nouvelle recette est un verrou bloquant dans le workflow Desktop Linux.

**Important :** ne déclarer la persistance validée qu'après succès réel des témoins en CI. Les tests ne démontrent ni timing, ni pile, ni tableaux ni le comportement d'un programme historique arbitraire ; extraction automatique non autorisée.

Prochain chantier après qualification : témoins tableaux/chaînes, DATA sans RESTORE, CHAIN MERGE DELETE, mémoire proche des limites et transaction d'extraction multifichier réversible.

[Guide 0.41.22](implementation/basic-chain-merge-state-alpha.md).



## Incrément 0.41.21 — contrat de chargement et comparaison firmware CHAIN/MERGE

Base : `main` 0.41.20, commit `2da1aede6315f2a96472b54af526e4ce3cde20c1`, PR #82 fusionnée après Specifications, J0 (489 tests) et Desktop Windows/Linux verts. Branche `feat/cpc-multifile-loading-contract`. La CI et la fusion de ce nouveau lot ne sont pas acquises sans inspection des workflows sur le commit exact. Pas de release applicative automatique.

Réalisation : moteur en lecture seule `inspectLoadContract` (CHAIN, CHAIN MERGE, MERGE, RUN fichier, LOAD, noms AMSDOS et cycles), outil agent `language_loading_contract` avec empreinte de source et historique de rapport périmé, panneau de restitution. Aucun mécanisme d'extraction, aucune création de fichier métier par l'analyse.

Qualification : script `scripts/qualify-basic-multifile-loading.mjs` utilisant les ROM de référence hors dépôt, le vrai moteur CPC WASM, un DSK monolithique et son équivalent à deux fichiers pour CHAIN ; même comparaison pour MERGE. Contrôle de la liste des fichiers AMSDOS, du fingerprint ROM et des marqueurs en RAM. Ajouter ce script comme garde bloquante dans `.github/workflows/editor.yml`, archiver uniquement le rapport JSON des empreintes et observations. **Ne déclarer les scénarios qualifiés qu'après leur exécution réellement réussie en CI**.

Limites : les témoins ne prouvent ni CHAIN MERGE ni les variables/ressources persistantes dans tous les cas. Pas de test physique ni d'émulateur indépendant. Prochaine étape : qualification de CHAIN MERGE, collisions de numéros, DATA/RESTORE et persistance ; ensuite seulement protocoles atomiques de déplacement.

[Guide, scénarios et limites](implementation/basic-multifile-loading-alpha.md).



## Incrément 0.41.20 — analyse préalable au découpage multifichier

Base : main 0.41.19, commit a3fc0efa10ad63959f7db3e97539a1a58afbcc5e, PR #81 fusionnée après Specifications, J0 (484 tests) et Desktop Windows/Linux verts. Branche de travail : feat/basic-module-analysis. CI et fusion de ce nouveau lot à confirmer ; aucune publication d'installateur automatique.

Livraison visée : analyseur borné des régions GOSUB avec RETURN autonome, appels, frontières entrantes/sortantes, identifiants observés comme partagés, liens CHAIN/MERGE/RUN/LOAD avec correspondance des noms CPC. Outil agent language_module_review purement consultatif, hash exact de source requis, aucun DSK, source ni manifeste modifiés ; affichage des rapports et de leur éventuelle péremption dans Agent IA. Les conditions ambiguës sont bloquées et les limites expliquées.

Limites : les noms partagés ne prouvent pas des dépendances sémantiques ; CHAIN/MERGE et états mémoire non modélisés, le statut « review » ne constitue pas une qualification d'extraction. Aucun découpage automatique n'est autorisé. Prochaine tranche : contrat d'exécution/chargement et témoins ROM pour la stratégie multifichier.

[Guide technique 0.41.20](implementation/basic-module-analysis-alpha.md).



## Incrément 0.41.19 — insertion REM contrôlée par l'agent

Base : `main` 0.41.18, commit `8d640472ae0f62346c242e7ae9a2af434d7beccd`, PR #80 fusionnée après réussite Specifications, J0 et desktop Windows/Linux (478 tests Node). Branche : `feat/basic-comment-insertion`. Publication des exécutables indépendante des PR, inchangée. Vérifier la CI exacte de cette branche avant toute fusion.

Le moteur pur `planBasicCommentInsert` refuse les commentaires non ASCII, changements de numéros existants, manque de numéro libre, premiers points d'entrée et formes opaques. Il vérifie la conservation intégrale du listing précédent moins l'unique nouvelle ligne REM. L'agent expose `language_comment_preview` et `language_comment_apply`, avec empreinte de source, état du projet, checkpoint et historique visible des aperçus/appliqués/périmés. Le contenu proposé par l'IA reste une hypothèse documentaire à vérifier, pas une preuve métier.

Tests : conservation des anciens labels et sauts statiques, refus de l'injection, refus des numéros contigus ou manquants, blocage des branches calculées, aperçu sans mutation, quotas et conflits de révision. Aucun test firmware complet de cette nouvelle insertion n'est encore déclaré validé tant que la CI et les recettes dédiées ne l'ont pas confirmé.

Prochaine étape : découpage BASIC multifichier et stratégie de chargement `CHAIN`/`MERGE`/disque. [Guide 0.41.19](implementation/basic-comment-insert-alpha.md).



## Incrément 0.41.18 — lisibilité BASIC et formatage conservateur

Base : `main` version 0.41.17, commit `eb947ecee654a381cbddd3f2895d79a65eec3b46` ; PR #79 fusionnée après les trois workflows réussis. Branche actuelle `feat/basic-readability-formatter` ; qualifier ses contrôles CI sur le commit exact avant fusion. Les installateurs publics restent indépendants de chaque PR.

Réalisé dans cette branche : `language_readability_review` expose métriques, constats et pistes documentaires localisées sans inventer des faits métier ; `language_format_preview` prépare un diff borné et le bilan avant/après ; `language_format_apply` écrit seulement le plan exact si la source et le projet n'ont pas changé. Le profil formateur agit uniquement sur les espaces des lignes simples et conserve chaînes, DATA, commentaires et structures sensibles. Les opérations sont visibles dans le panneau IA et restaurables via le checkpoint initial. Les tests de non-régression portent sur l'idempotence, les refus, les snapshots et l'application contrôlée.

Limites : pas de réécriture automatique des commentaires dans les sources BASIC ; le modèle peut rédiger des suggestions ou des notes Markdown avec vérification humaine. Pas d'équivalence mémoire/timing ou matérielle universelle, pas de découpage multifichier, pas de formatage des branches. Suite prioritaire : consolidation firmware et insertion contrôlée de commentaires, puis stratégie de découpage.

[Guide du lot et limites](implementation/basic-readability-formatter-alpha.md).



## Incrément 0.41.17 — renommage déterministe assisté par l’agent

Base : `main` 0.41.16 (PR #78 fusionnée après les trois workflows verts), branche `feat/agent-deterministic-rename`. L'état CI/fusion de ce nouvel incrément doit être vérifié sur sa tête exacte ; aucun packaging ni release supplémentaire déclenché.

Deux outils BASIC sont ajoutés à l'agent : `language_rename_preview` (plan sans écriture, positions et hash, diff avant/après borné) et `language_rename_apply` (application de ce plan exact, identité et snapshot de projet revalidés). Les profils permis sont ceux déjà reconnus par F2 : variables/tableaux, fonctions FN et paramètres dans les cas qualifiés. Un refus du moteur demeure bloquant. Le panneau Agent IA affiche les plans préparés/appliqués/périmés ; le checkpoint initial reste restaurable.

Précautions : pas d'approbation humaine individuelle obligatoire, pas d'équivalence universelle, pas d'élargissement Z80/multifichier, pas de modification implicite de la politique de tests ou builds. Le lot suivant portera sur le formatage/conseils de lisibilité, puis les transformations multifichiers.

[Guide et limites](implementation/agent-deterministic-rename-alpha.md).


## Incrément 0.41.16 — rattachement des tests aux sources

Base : `main` 0.41.15, commit `35512f7cb58fb28a028fd4a6d7ae9c378ec8ef5f`. Branche `feat/basic-tested-source-coverage`. Réalisation proposée, **CI/fusion non acquises** tant que les vérifications GitHub ne sont pas terminées. Installateurs publics encore en 0.41.10 ; aucun packaging lancé.

Le contrôle déterministe relie les assertions CPC à l'identifiant, au chemin, au SHA-256 et au résultat de chaque source réellement transformée. Une copie exécutée sous un autre ID ne compte pas. Le panneau Agent IA distingue la preuve sur la version finale et, lorsque la même suite a tourné initialement, la référence avant modification. Une mission qui a exécuté des suites mais a laissé des fichiers modifiés sans couverture directe réussie ne peut pas être validée.

Limites : pas de harnais d'instrumentation automatique, de fusion de listings ni de preuve universelle d'équivalence. Sans suite, l'absence de vérification est explicitée sans changer le comportement historique. Priorité suivante : tests réellement liés au code métier non instrumenté, puis transformations déterministes dans les missions IA.

[Guide technique](implementation/basic-tested-sources-alpha.md).


## Incrément du 16 octobre — renommage FN/paramètres 0.41.15

Base : main `55722797e5ed5fac524ade4f8d4a457541961323`, PR #76 fusionnée après CI verte sur `1532b17` : Specifications 38810588488, J0 38810588510, Desktop Windows/Linux 38810588508 ; Linux 116682688144 confirme 461 tests et 16 recettes de renommage. Branche `feat/basic-fn-rename` ; vérifier sa PR et la CI de sa tête avant d’annoncer la fusion. Installateurs publiés 0.41.10 ; aucun packaging supplémentaire déclenché.

Réalisé : F2 fonctions et paramètres locaux via un profil dédié, définitions initiales uniques, appels/arité/suffixes couverts, absence de récursion et de types dynamiques. Collisions conservatrices dans toutes les portées, nouveau contrôle après transformation, conservation des globales/tableaux homonymes et des autres paramètres. Panneau « Renommer un symbole » avec nature/portée et focus initial pour Échap ; worker, aperçu et gardes de révision/undo inchangés. Guide illustré, exemple repris exactement d’un témoin firmware, ADR 0074 et priorités validées intégrés. Aucun outil agent ou droit documentaire supplémentaire ; contrat SymbolReport et obfuscateur inchangés.

Vérifications locales : TypeScript, 468 tests Node, builds renderer/main et 46 recettes firmware avant/après réussis (30 nouvelles exécutions FN, 16 précédentes). Quinze témoins indépendants couvrent noms FN, suffixes, paramètres, homonymes globaux/tableaux, imbrication, arguments et paramètres inutilisés. Parcours navigateur complet réussi : paramètres locaux, homonymes libres/globaux, collision, renommage depuis un appel, aperçu exact, export du buffer, undo, obsolescence et Échap sur refus ; non-régression variables/navigation également réussie. Capture réelle inspectée et intégrée. Contrôle documentaire réussi : 171 Markdown, 21 JSON, 84 exigences, 37 scénarios, six schémas et six exemples. Vérifier la CI de la tête publiée avant fusion. Aucun appel IA facturé, ROM ni document personnel ajouté.

Première CI de PR #77 (`a9806de`) : spécifications et J0 réussis, 468 tests Node réussis sous Linux. Le parcours navigateur a révélé une course de focus entre la fermeture et la réouverture immédiate du panneau : le rappel différé de l’ancien panneau pouvait rendre le focus à l’éditeur après l’ouverture du nouveau. Correction : retour du focus synchrone à la fermeture ; assertion explicite du focus après refus initial. TypeScript, build renderer, contrôle documentaire et parcours navigateur complet réussis localement après correction. La première CI Windows a également réussi. Vérifier la CI de cette correction avant fusion.

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

**Instruction de reprise courte :** « Reprends CPCéleste après lecture d’AGENTS.md et du dernier incrément de docs/reprise.md. Vérifie main distant, la PR feat/basic-readability-pipeline et ses contrôles. Après 0.41.29, relier les tests CPC au vrai projet/DSK pour les missions de transformation. Préserve les profils v1/v2/v3/v4/v5, journal, brouillons et preuves firmware ; aucun packaging par commit. »
