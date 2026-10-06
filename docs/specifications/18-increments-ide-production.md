# Incréments pour un IDE de production

Statut : spécification produit, 6 octobre 2026. Complète les [75 capacités](17-roadmap-ide-complet.md), les [parcours](02-interface-parcours.md) et la [feuille de route](12-feuille-de-route.md). Les capacités décrites ci-dessous sont des objectifs, sauf réalisation explicitement attestée dans un rapport d’implémentation. Aucun lot global n’est clos par cette spécification.

## Ordre de réalisation

La mission Mahjong interrompue priorise une correction de l’agent avant les grands ajouts. Livrer des tranches utilisables et testées ; ne pas multiplier les boutons sans compléter leurs parcours.

| Ordre | Lot | Livrable décisif | Dépendances |
| --- | --- | --- | --- |
| 0 | Agent : correction et restitution | Mission, résultats visibles, pause/reprise, consommation | Sources et checkpoints existants |
| 1 | Projet et explorateur | Naviguer et modifier un projet complet sans perdre un brouillon | Durabilité des mutations |
| 2 | Intelligence BASIC | Détecter les erreurs certaines avant RUN et naviguer dans le code | Corpus et parser |
| 3 | Git et GitHub | Résoudre un conflit et poursuivre un travail versionné | Git quotidien 0.28, durabilité |
| 4 | Terminal et tâches | Utiliser un shell interactif et des tâches reproductibles | Processus, annulation, plateformes |
| 5 | Exécution CPC et observation | Exécuter, inspecter et reproduire un résultat réel | Firmware, moteur, qualification |
| 6 | Agent vérifiant ses productions | Générer, exécuter, observer puis corriger | Lots 2 et 5, ressources |
| 7 | Personnalisation et accessibilité | Disposition, raccourcis et préférences fiables | Registre de commandes et sessions |
| 8 | Distribution de production | Installer, mettre à jour et diagnostiquer sans perte | Recettes et matrice de plateformes |

Le lot 0 puis l’explorateur et le parser peuvent être découpés en PR indépendantes. Aucun calendrier n’est annoncé sans mesure de charge. Les critères suivants constituent les spécifications des huit lots ; le lot 0 est détaillé au [document 19](19-agent-experience-consommation.md).

## Lot 1 — Projet, explorateur et onglets

Couverture : IDE-001 à 006, IDE-007 à 012, IDE-022 à 025.

**Première tranche 0.30** : [arborescence et lectures seules](../implementation/project-explorer-alpha.md) livrées avec bornes et refus des chemins périmés. Le filtre porte sur les dossiers déjà chargés ; les fichiers ordinaires restent en lecture seule. La [tranche 0.31](../implementation/source-operations-alpha.md) ajoute renommage/déplacement/suppression des sources avec aperçu, journal de reprise, choix pour les brouillons et rétablissement de la dernière organisation. Création de dossiers, ajout durable/import/duplication, édition ordinaire et recette LOT-1 complète restent ouverts.

L’explorateur gauche DOIT afficher l’arborescence réelle du dossier projet : sources, documents, ressources, manifeste et fichiers ordinaires, avec filtre et exclusions configurables. Distinguer un fichier du dossier d’une source exportée sur le DSK. Les fichiers privés et générés sont masqués par défaut, accessibles par une option locale. Les liens symboliques sont identifiés, jamais parcourus implicitement hors du projet.

Un clic ouvre une prévisualisation réutilisable ; double-clic, modification ou épinglage crée un onglet stable. Un clic sur un onglet existant réactive son buffer, son undo et sa position. Les fichiers texte reconnus sont éditables ; images/PDF disposent d’une prévisualisation ; formats binaires inconnus affichent métadonnées et ouverture externe humaine. Aucun fichier inconnu ne devient une source CPC implicitement.

Menus Fichier/Projet, palette et menus contextuels partagent les mêmes commandes : créer fichier/dossier, renommer, déplacer, supprimer, dupliquer, révéler, copier le chemin. Renommer une source prépare aussi sa modification de manifeste et de nom CPC, avec aperçu des conséquences. Suppression avec brouillon impose un choix conserver/enregistrer/annuler ; restauration réversible par historique local. Collision sensible à la casse, fichiers occupés et conflit externe bloquent l’opération avant perte de données.

Les onglets offrent fermer, fermer autres, fermer tous, épingler et scinder l’éditeur. Ordre, sélection, position et panneaux sont restaurés par projet. Les éditeurs scindés partagent un document et son undo. Un watcher recharge seulement les buffers propres ; les brouillons restent protégés et comparables.

**Recette LOT-1** : ouvrir un projet sources/images/PDF/fichier texte inconnu, passer entre fichiers puis revenir au même curseur ; renommer/déplacer une source et reconstruire son DSK ; simuler collision, édition externe et interruption de mutation ; rouvrir et restaurer. Vérifier fermeture d’onglet sale, navigation clavier, fichier volumineux et exclusions. Limites affichées plutôt que gel UI ; aucune source CPC ajoutée par simple ouverture.

## Lot 2 — Compréhension de Locomotive BASIC

Couverture : IDE-013 à 020, IDE-024, IDE-076.

**Tranche 0.34** : [worker, diagnostics et performance](../implementation/basic-diagnostics-alpha.md) livrés avec révisions et couverture partielle explicites. La qualification complète LOT-2 reste ouverte ; [plan de débogueur](../implementation/basic-debugger-plan.md) distinct du parser.

**Tranche 0.36** : [rapport de qualité à la demande](../implementation/basic-quality-alpha.md), REQ-EDT-008 / ACC-36. Les métriques et remarques de lisibilité sont séparées des erreurs syntaxiques ; les sources modifiées rendent le snapshot obsolète et bloquent sa navigation. Complexité lexicale estimée, sans graphe de contrôle. Revue IA optionnelle à construire, avec provenance et choix explicite du modèle/périmètre.

Le parser DOIT distinguer lignes physiques et numéros BASIC, chaînes, commentaires, DATA, expressions, instructions composées et formes contextuelles. Définir une matrice de grammaire et de corpus : instruction couverte, forme opaque, diagnostic certain ou inspection. Une forme non couverte NE DOIT PAS recevoir une fausse erreur de syntaxe.

Analyser les buffers en worker après temporisation, avec révision ; un résultat périmé est ignoré. Marqueurs dans le code, gouttière, onglet et panneau Problèmes indiquent fichier, plage, gravité, message et couverture. Clic/Entrée navigue à l’erreur. Cible : retour des diagnostics en moins de 300 ms après la pause de frappe pour 5 000 lignes sur le matériel de référence, à mesurer avant annonce.

Complétion contextuelle, aide des paramètres et documentation indiquent dialecte, signature et provenance. Ajouter table de symboles, usages de variables/fonctions, F12 et retour/avance. Renommage sémantique et renumérotation calculent un aperçu avec cibles littérales ; chaînes, DATA et commentaires restent inchangés. Les références calculées ou opaques bloquent les transformations non démontrables. Snippets numérotés évitent les collisions. Formatage et numérotation automatiques sont optionnels et réversibles.

**Recette LOT-2** : corpus positif/négatif documenté pour chaque production ; aucune régression sur listings valides ; erreurs détectées avant exécution ; saut vers leur plage ; frappe rapide sans diagnostic périmé. Transformer puis annuler une source avec variables suffixées, DATA, chaînes et références calculées. Compléter la qualification ROM ; l’analyse statique ne remplace pas RUN.

## Lot 3 — Git et GitHub complets

Couverture : IDE-031 à 039. La tranche 0.28 fournit déjà init, index par fichier, commit, branches/remotes, clone, fetch/pull/push HTTPS, compte privé GitHub et PR. La suite complète ces parcours.

Ajouter staging par fragment, diff index/disque côte à côte, historique avec graphes paginés, comparaison de versions/branches, blame et restauration vers buffer. Ajouter tags, stash avec inspection/restauration, merge, rebase, cherry-pick et revert, chacun avec état d’opération et actions continuer/abandonner. Résolution des conflits en trois versions (base/local/distant), liste des fichiers non résolus et traitement explicite du manifeste. Aucun pull/rebase ne remplace un brouillon.

L’authentification GitHub vise OAuth navigateur/device flow et coffre système, avec scopes visibles et déconnexion ; le jeton en mémoire et CLI actuels restent des alternatives explicites. Qualifier dépôts privés, SSH, comptes et remotes multiples. Les PR offrent checkout, diff, commentaires et état CI ; publier une PR/commentaire ou pousser exige une action humaine explicite. La suggestion IA décrit le diff indexé, jamais un commit automatique.

**Recette LOT-3** : deux clones, conflit texte et manifeste, résolution/continue/abort, stash et restauration, rejet serveur, changement externe entre aperçu/application, rotation/oubli des identifiants, annulation réseau et logs expurgés. Tester SSH et comptes réels sur les plateformes annoncées ; aucune revendication fondée seulement sur un serveur contrôlé.

## Lot 4 — Terminal interactif et tâches

Couverture : IDE-040 à 042, IDE-029. Remplacer le terminal à commandes successives par une session PTY persistante, avec cwd du projet, saisie interactive, couleurs ANSI, redimensionnement, onglets et recherche/copie. Les profils shell sont locaux et choisis par l’utilisateur. Ctrl C interrompt le processus courant ; fermer un terminal ne laisse pas de descendant orphelin.

Définir des tâches nommées construire/analyser/exporter/tester avec commande ou opération interne, répertoire, variables non secrètes, dépendances et parseur de diagnostics. Aperçu avant exécution d’une commande issue d’un projet tiers. Une tâche possède ID, état, début/fin, sortie bornée, code de retour et arrêt. Le panneau inférieur regroupe Terminal, Problèmes, Sorties, Git et journal de tâches ; hauteur ajustable et maximisation.

**Recette LOT-4** : prompt interactif, programme plein écran, caractères Unicode, Ctrl C, resize et trois terminaux ; tâche composée en succès/échec et annulation ; reconnexion du projet sans mauvais cwd. Qualifier Windows ConPTY et PTY Linux/macOS, limites de mémoire et absence de processus après fermeture. Aucun accès shell libre accordé à l’agent.

## Lot 5 — Exécution, observation et débogage CPC

Couverture : IDE-043 à 056. Conserver commandes en colonne et écran voisin avec dimensions indépendantes. Ajouter configurations de lancement : point d’entrée, modèle de machine qualifié, jeu firmware identifié, mode de démarrage et budgets d’exécution. F5 lance la configuration ; pause, arrêt, reset et capture affichent leurs effets sur l’état.

Les observations comportent source/révision, hash DSK/firmware, instant ou nombre de frames et provenance moteur. Captures, palette, mémoire, fichiers écrits et erreurs disponibles deviennent des preuves exportables. Débogage BASIC (ligne, variables, breakpoints/pas) est une capacité distincte : l’état Z80 seul ne prouve pas une correspondance BASIC. Ne pas afficher un débogueur BASIC tant que cette correspondance n’est pas qualifiée.

**Tranche 0.35** : [inspection en pause et première preuve D1](../implementation/cpc-inspection-alpha.md). Registres/64 octets de RAM logique à la demande, sans hook en usage normal. Neuf frontières BASIC du jeu anglais rapprochées du programme tokenisé réel en natif et WASM ; événements/mapping source restent ouverts. LOT-5 et IDE-054 non clos ; IDE-055 partiel.

Créer des recettes automatisées boot/RUN/clavier/écran/écriture disque et comparaison attendue, avec tolérance explicitée. Sauvegarder/reprendre une session sans confusion avec la source. L’import/export de ressources respecte les contraintes CPC : MODE 1, quatre couleurs par pixel et résolution effective ; zoom IDE n’améliore pas les pixels générés.

**Recette LOT-5** : titre fixe MODE 1, pixels attendus et palette, arrêt d’un programme en boucle, export puis relecture d’une écriture disque, reprise de session et firmware absent/non reconnu. Vérification indépendante prescrite par les documents 06/11 avant clôture J0/J3. Qualification anglaise ne vaut pas qualification de toutes les ROM FR/AZERTY.

## Lot 6 — Agent capable de vérifier sa production

Couverture : IDE-057 à 069. Parcours et consommation au document 19.

Après le lot 0, ajouter outils ressources et émulation bornés : lancer une révision, attendre une observation limitée, capturer l’écran, lire un résultat de test et arrêter. L’agent établit un plan court, produit une première version, analyse/construit, exécute si possible, inspecte le résultat puis corrige. Le compte rendu sépare ce qui est écrit, construit, exécuté et observé. Ressource dessinée/conversion d’image CPC et simple listing BASIC ont des capacités différentes.

Mode Explication interdit les mutations ; Revue prépare une proposition comparée ; Agent applique les mutations réversibles au scope convenu. Le suivi est facultatif. Documents inertes, provenance et quotas restent obligatoires. La publication Git reste humaine. Ajouter ensuite historique de missions et reprise durable de conversation avec version, confidentialité, idempotence et récupération, sans confondre avec le journal disque existant.

**Recette LOT-6** : mission Mahjong réelle avec modèle sélectionné, code conforme, capture MODE 1 examinée, une correction attestée et résultat relançable. Échec firmware/capacité, budget, refus d’écriture, coût inconnu et arrêt restent compréhensibles. Fixture de provider prouve la mécanique, pas la qualité artistique d’un modèle réel.

## Lot 7 — Personnalisation, ergonomie et accessibilité

Tranche alpha 0.32 : centre de réglages recherchables, accents/densité/options du code, migration des préférences, keymap configurable/bases, profils locaux portables, dispositions Édition/Exécution/Agent et concentration réversible. [Guide](../implementation/personalization-alpha.md), [ADR 0039](../adr/0039-personnalisation-profils-et-keymap.md). Overrides projet, fenêtres système, keymap complète et audit accessibilité restent ouverts ; lot partiel.

Tranche alpha 0.33 : [centre de notifications](../implementation/notifications-alpha.md) de session borné, filtres/niveaux/origines/non lus, navigation vers les panneaux et préférences d’aperçus ([ADR 0040](../adr/0040-centre-notifications-session.md)). Journal de tâches durable, progression unifiée, annulation centrale et couverture exhaustive des dialogues restent ouverts.

Couverture : IDE-026 à 030, IDE-073/074. Préférences existantes à prolonger : thèmes clair/sombre/système, police/zoom, autosave, indentation et renumérotation ; overrides par projet distingués des réglages globaux.

Ancrage gauche/droite/bas, panneaux masqués, flottants dans l’IDE puis fenêtres système indépendantes ; déplacement par souris ou commande clavier. Séparateurs manipulables au clavier avec limites minimales. Géométries sauvegardées avec version/migration et adaptation écran/DPI ; restauration de disposition toujours accessible. Profils « édition », « exécution », « agent ».

Le registre de commandes alimente menu, icône, palette, raccourcis et aide. Éditeur de keymap avec recherche, détection de conflit et profils VS Code/JetBrains ; raccourcis affichés près des commandes. Les réglages disposent de recherche, descriptions et retour aux défauts. Les erreurs indiquent une action et peuvent être retrouvées dans un centre de notifications.

Les retours utilisateurs restent accessibles dans Aide : amélioration/bug, description préparée, capture et diagnostic facultatifs examinés avant envoi. Aucun journal privé ni clé joint automatiquement. Parcours complets au clavier, focus restauré, annonces mesurées, contraste AA et zoom 200 % ; traduction sans libellés internes.

**Recette LOT-7** : écran petit/multimoniteur, DPI, resize/clavier, détacher/réancrer, fermer/rouvrir, écran retiré, profil corrompu et restauration ; keymap contradictoire ; thème clair/sombre, lecteur d’écran et zoom ; demande d’amélioration préparée et annulée sans publication.

## Lot 8 — Distribution et exploitation de production

Couverture : IDE-070 à 075. Produire des installateurs par plateforme annoncée, signatures/notices/licences, désinstallation préservant les projets et mises à jour contrôlées avec migration testée et retour arrière. Aucun SDK Emscripten requis chez l’utilisateur final ; firmware importé localement selon droits et jamais livré sans autorisation.

CI obligatoire : domaines, schémas, renderer, Electron, installation Windows propre puis Linux/macOS selon supports annoncés. Ajouter installation sans réseau, chemins avec espaces/Unicode, premier lancement, mise à jour avec brouillons/checkpoints et fichiers verrouillés. Séparer compatibilité de build et qualification fonctionnelle.

Support intégré : état des dépendances/firmware, logs filtrables, export expurgé avec aperçu, versions/hashes et canal de retours. Mesurer démarrage, mémoire, réactivité de frappe, grands projets et sessions longues sur matériels publiés. Versions et migrations inconnues ne détruisent jamais les données.

**Recette LOT-8** : installation propre, upgrade/downgrade compatible ou refus expliqué, reprise après crash, secrets absents des exports/paquets, dépendance indisponible, fichier verrouillé, session longue et audit accessibilité. La production 1.0 exige critères J6 et risques résiduels publiés ; huit menus remplis ne suffisent pas.

## Définition de terminé d’une tranche

Chaque tranche DOIT fournir un parcours complet, les invariants et contrats concernés, tests pertinents, recette UI/native selon son périmètre, documentation utilisateur et limites. Le rapport indique exécuté/bloqué/prévu et plateformes exactes. Une PR ne clôt un ID IDE que si toute sa preuve de sortie existe ; sinon l’ID reste partiel. Les tests de perte de données et de conflits passent avant tout ajout d’automatisme.
