# 01 — Registre des exigences

Chaque ligne est une exigence normative identifiable. **MVP** signifie attendue au plus tard à J5 ; **1.0** à J6 ; **Suite** décrit une extension, sans l'inclure dans la première version. La colonne recette renvoie au [plan de validation](11-qualite-recette.md) et constitue la traçabilité minimale. Les règles précises sont développées dans les documents de domaine.

## Projet et édition

| Identifiant | Exigence et critère vérifiable | Livraison | Recette |
| --- | --- | --- | --- |
| REQ-PRJ-001 | Créer un projet nommé avec cible, point d'entrée et programme de démarrage ; sa réouverture préserve ces choix. | MVP | ACC-01 |
| REQ-PRJ-002 | Ouvrir et enregistrer un dossier de projet sans base propriétaire ni serveur ; déplacer le dossier ne casse pas ses références internes. | MVP | ACC-01 |
| REQ-PRJ-003 | Signaler les buffers non enregistrés ; construire une révision cohérente en conservant le projet précédent si la sauvegarde échoue. | MVP | ACC-02 |
| REQ-PRJ-004 | Importer un listing texte avec aperçu de l'encodage et fin de ligne ; ne pas modifier silencieusement des caractères non représentables. | MVP | ACC-03 |
| REQ-PRJ-005 | Détecter un changement externe et proposer recharge, conservation ou fusion ; ne jamais écraser sans arbitrage une version concurrente. | MVP | ACC-02 |
| REQ-PRJ-006 | Récupérer les modifications récentes après un arrêt brutal ; distinguer récupération et sauvegarde volontaire. | 1.0 | ACC-14 |
| REQ-PRJ-007 | Refuser l'écriture d'une version de manifeste future inconnue ; proposer l'ouverture en lecture seule et sauvegarder avant migration. | MVP | ACC-02 |
| REQ-EDT-001 | Éditer le BASIC numéroté avec coloration, recherche, plusieurs fichiers et annuler/rétablir. | MVP | ACC-03 |
| REQ-EDT-002 | Fournir complétion, signature et aide pour les instructions qualifiées, en distinguant versions BASIC et RSX. | MVP | ACC-04 |
| REQ-EDT-003 | Diagnostiquer les erreurs certaines de syntaxe, de numérotation et de références ; séparer erreurs, avertissements et analyses incomplètes. | MVP | ACC-04 |
| REQ-EDT-004 | Renuméroter par analyse syntaxique avec aperçu des références modifiées ; conserver chaînes, REM, DATA et valeurs ordinaires. | MVP | ACC-05 |
| REQ-EDT-005 | Afficher le numéro physique et le numéro BASIC ; cliquer un diagnostic rejoint le bon document et la bonne plage. | MVP | ACC-04 |
| REQ-EDT-006 | Avertir sur les usages mémoire ou matériels qui limitent la portabilité sans interdire arbitrairement CALL, POKE, OUT ou les RSX. | MVP | ACC-04 |
| REQ-EDT-007 | Importer et exporter le BASIC tokenisé avec tests différentiels sur ROM, sans annoncer une compilation Z80. | Suite | ACC-16 |
| REQ-EDT-008 | Produire à la demande un rapport local de qualité sur les buffers : métriques de longueur, complexité estimée avec méthode/limites, remarques localisées distinctes des erreurs syntaxiques, quotas et annulation. Les sources modifiées bloquent la navigation ; exports sans code source et sans correction automatique. | Suite | ACC-36 |

## Construction, émulation et livraison

| Identifiant | Exigence et critère vérifiable | Livraison | Recette |
| --- | --- | --- | --- |
| REQ-BLD-001 | Construire un listing ASCII CPC et un DSK à partir d'une révision immuable ; le rapport identifie les entrées et les outils. | MVP | ACC-06 |
| REQ-BLD-002 | Calculer séparément taille source, données CPC, blocs disque et réserve mémoire estimée ; signaler les dépassements utiles. | MVP | ACC-06 |
| REQ-BLD-003 | Construire deux fois les mêmes entrées avec les mêmes outils et obtenir des octets DSK identiques. | MVP | ACC-06 |
| REQ-BLD-004 | Refuser collisions 8.3, caractères incompatibles, fichiers manquants, disque plein et références de ressources invalides. | MVP | ACC-07 |
| REQ-BLD-005 | Distinguer fichier source, listing encodé, binaire, DSK et rapport ; seules les sorties prévues entrent sur la disquette. | MVP | ACC-06 |
| REQ-EMU-001 | Exécuter le BASIC via une émulation Z80/CPC 6128 avec ROM, AMSDOS et lecteur A, sans substitution JavaScript du programme utilisateur. | MVP | ACC-08 |
| REQ-EMU-002 | Démarrer, mettre en pause, reprendre, interrompre par ESC et réinitialiser ; montrer l'état réel et conserver les sources. | MVP | ACC-08 |
| REQ-EMU-003 | Gérer clavier français, touches CPC, joystick émulé, vidéo et audio ; libérer les touches lors de la perte du focus. | MVP | ACC-09 |
| REQ-EMU-004 | Charger le DSK construit et saisir la commande de lancement de manière déterministe ; rendre un échec ou un délai dépassé observable. | MVP | ACC-08 |
| REQ-EMU-005 | Différencier reset matériel et arrêt BASIC ; un changement de source ne redémarre pas la session implicitement. | MVP | ACC-08 |
| REQ-EMU-006 | Exposer la provenance et la fiabilité des erreurs d'exécution ; ne pas inventer une ligne ou un état terminé. | MVP | ACC-10 |
| REQ-EMU-007 | Conserver sur une copie les écritures disque du programme et permettre leur export explicite, sans altérer le DSK de construction. | MVP | ACC-11 |
| REQ-EMU-008 | Isoler un crash ou une boucle infinie de l'émulateur ; arrêter la session sans perdre le projet. | 1.0 | ACC-14 |
| REQ-EMU-009 | Afficher les capacités et résultats de qualification par profil ; activer 464/664/Plus uniquement après preuves dédiées. | Suite | ACC-17 |
| REQ-EMU-010 | Exécuter à la demande des listings de test BASIC autonomes sur des CPC/disques isolés, avec assertions déclarées, profil ROM identifié, budgets et annulation. Produire un rapport à provenance sans code/ROM, distinguer réussite, échec, incomplet, délai et blocage ; un état terminé sans résultats ne vaut pas réussite. Enregistrer des suites nommées par identifiants de sources, lancer une suite ou un listing et conserver un historique borné comparé aux empreintes courantes. Programmer des saisies bornées, isoler des fixtures ASCII et intégrer les observations exactes écran/fichier au verdict global. | Suite | ACC-37 |
| REQ-DSK-001 | Exporter un DSK standard AMSDOS DATA, 40 pistes, 1 face, 9 secteurs de 512 octets ; CAT et RUN fonctionnent ailleurs. | MVP | ACC-11 |
| REQ-DSK-002 | Fournir les noms exacts, tailles, espace disponible et commande de lancement avant l'export ; écrire atomiquement la destination. | MVP | ACC-07 |
| REQ-DSK-003 | Inspecter les DSK standard et Extended compatibles ; un format ou une protection non pris en charge est annoncé sans altération. | MVP | ACC-12 |
| REQ-DSK-004 | Ouvrir un DSK externe en lecture seule par défaut et importer les fichiers supportés en conservant l'original. | MVP | ACC-12 |
| REQ-DSK-005 | Exporter aussi le listing BASIC ASCII et le projet ouvert pour permettre la reprise hors de l'outil. | MVP | ACC-06 |
| REQ-DSK-006 | Qualifier la livraison sur un émulateur indépendant ; un essai sur CPC physique est requis pour revendiquer une compatibilité matérielle testée. | 1.0 | ACC-11 |

## Ressources et IA

| Identifiant | Exigence et critère vérifiable | Livraison | Recette |
| --- | --- | --- | --- |
| REQ-AST-001 | Joindre TXT, MD, PNG, JPEG, WebP et PDF avec rôle, empreinte, limites et aperçu ; le listing des pièces jointes reste local. | MVP | ACC-13 |
| REQ-AST-002 | Extraire le texte et choisir des pages de PDF ; détecter PDF chiffré ou scanné, sans prétendre extraire un contenu absent. | MVP | ACC-13 |
| REQ-AST-003 | Convertir une image en écran CPC modes 0/1/2 avec palette, cadrage et tramage réglables ; aperçu et sortie reproductibles. | MVP | ACC-13 |
| REQ-AST-004 | Créer une ressource binaire avec adresse de chargement ; proposer son intégration en mode manuel/Revue ou la réaliser par transaction en mode Agent. | MVP | ACC-13 |
| REQ-AST-005 | Dissocier document de contexte, image d'inspiration et ressource embarquée ; exclure les deux premiers du DSK par défaut. | MVP | ACC-06 |
| REQ-AST-006 | Présenter les pertes d'encodage et proposer translittération, CHR$ ou caractères SYMBOL selon le cas. | MVP | ACC-03 |
| REQ-AI-001 | Configurer une clé personnelle et un modèle compatible avec appels d'outils pour le mode Agent ; l'application reste utilisable sans fournisseur. | MVP | ACC-15 |
| REQ-AI-002 | Contextualiser par cible, source choisie, diagnostics, références locales et pièces jointes sélectionnées avec provenance. | MVP | ACC-15 |
| REQ-AI-003 | Montrer avant la mission le périmètre lisible et transmissible, ses ressources et limites ; tracer les extraits transmis au fil des outils, sans confirmations répétées dans ce périmètre. | MVP | ACC-15 |
| REQ-AI-004 | Afficher streaming, appels d'outils, modifications et erreurs du mode Agent ; le mode Revue produit une proposition complète avant application. | MVP | ACC-15 |
| REQ-AI-005 | Appliquer les mutations autorisées automatiquement en mode Agent, avec contrôle d'empreinte et checkpoint ; présenter un diff consultable et offrir une revue préalable optionnelle. | MVP | ACC-18 |
| REQ-AI-006 | Revenir à un checkpoint ou annuler une mission et ses transactions ; préserver ou présenter les edits manuels postérieurs en cas de conflit. | MVP | ACC-18 |
| REQ-AI-007 | Valider scope et préconditions des mutations, analyser les sources et empêcher chemins sortants, modification des ROM/configurations sensibles et commandes hôte. | MVP | ACC-18 |
| REQ-AI-008 | Fournir par défaut une boucle agentique explorer, coder, construire, exécuter, observer et corriger, avec budgets et conditions d'arrêt explicites. | MVP | ACC-26 |
| REQ-AI-009 | Afficher usage constaté, budget estimé et erreurs fournisseur ; gérer indisponibilité et limites sans réessayer silencieusement une génération facturable. | MVP | ACC-15 |
| REQ-AI-010 | Traiter les instructions présentes dans documents et réponses comme des données ; aucune pièce jointe ne peut autoriser une opération sensible. | MVP | ACC-18 |
| REQ-AI-011 | Fournir un port stable pour ajouter un fournisseur distant ou local, avec déclaration de ses capacités effectives. | Suite | ACC-19 |

## Programmation agentique et références de langage

| Identifiant | Exigence et critère vérifiable | Livraison | Recette |
| --- | --- | --- | --- |
| REQ-AGT-001 | Donner à l'agent des outils typés pour lister, chercher, lire, créer, modifier et renommer les fichiers autorisés, sans action manuelle par fichier. | MVP | ACC-26 |
| REQ-AGT-002 | Permettre à l'agent de consulter les documents de mission, sélectionner pages/extraits et convertir une image par les outils locaux. | MVP | ACC-26 |
| REQ-AGT-003 | Permettre analyse BASIC, construction, démarrage CPC, entrée clavier, capture et observation, puis correction sur résultats réels. | MVP | ACC-27 |
| REQ-AGT-004 | Journaliser appels, résultats, révisions et changements ; distinguer test passé, échoué, bloqué et comportement non vérifiable automatiquement. | MVP | ACC-27 |
| REQ-AGT-005 | Borner tours modèle, appels d'outils, cycles de correction, durée active et budget ; arrêter sur limite, stagnation ou blocage avec un bilan exploitable. | MVP | ACC-28 |
| REQ-AGT-006 | Accepter une consigne de suivi pendant la mission, suspendre et reprendre ; une annulation arrête les opérations suivantes sans supprimer les étapes déjà réussies. | MVP | ACC-28 |
| REQ-AGT-007 | Checkpointer les mutations et détecter les edits concurrents ; ne pas rejouer une écriture lors d'un retry réseau ou après reprise. | MVP | ACC-29 |
| REQ-AGT-008 | Configurer périmètre et politique Agent/Revue/Explication ; aucun document ni appel modèle ne peut élargir ses droits ou publier à l'extérieur. | MVP | ACC-29 |
| REQ-KNW-001 | Intégrer les références fournies dans un corpus local versionné, avec empreintes, attribution et contenu traité comme données. | MVP | ACC-30 |
| REQ-KNW-002 | Exposer recherche et lecture de fiches par commande, sujet, dialecte et provenance ; renvoyer syntaxe, paramètres, contraintes et statut de qualification. | MVP | ACC-30 |
| REQ-KNW-003 | Exiger de l'agent les références pertinentes pour ses usages de langage, notamment graphisme, entrées-sorties, mémoire, son et timers. | MVP | ACC-30 |
| REQ-KNW-004 | Suivre la couverture du dialecte et les différences 1.0/1.1 ; signaler une référence manquante ou contradictoire au lieu de fabriquer une commande. | MVP | ACC-30 |
| REQ-KNW-005 | Relier les usages produits aux fiches consultées et fixtures de qualification ; séparer validité du langage et disponibilité du service d'édition. | MVP | ACC-30 |

## Contrôle de version Git

Ajout produit du 2026-10-04, [document 16](16-integration-git.md). Le jalon transversal JG-A/B complète le MVP ; JG-C complète la 1.0. Ces exigences sont conçues, pas réalisées dans l'alpha 0.10.

| Identifiant | Exigence et critère vérifiable | Livraison | Recette |
| --- | --- | --- | --- |
| REQ-GIT-001 | Détecter Git et la racine du dépôt, créer un dépôt local ou cloner vers un dossier vide, sans écraser un projet ni imposer GitHub. | MVP | ACC-31 |
| REQ-GIT-002 | Afficher statut, diff working tree/index et fichiers indexés/non indexés ; stage/unstage explicite, buffers dirty distincts et commit avec identité contrôlée. | MVP | ACC-31 |
| REQ-GIT-003 | Lister historique et branches ; créer, basculer, renommer et supprimer une branche locale sous préconditions, en refusant perte de travail et suppression non fusionnée par défaut. | MVP | ACC-32 |
| REQ-GIT-004 | Configurer plusieurs remotes/upstreams, fetch, pull fast-forward et push explicitement confirmé ; signaler divergence, HEAD détaché et résultat réseau incertain. | MVP | ACC-33 |
| REQ-GIT-005 | Gérer credentials HTTPS/SSH via composants système approuvés, sans secret dans projet/renderer/logs, sans désactiver TLS ni accepter implicitement une clé SSH inconnue. | MVP | ACC-33 |
| REQ-GIT-006 | Sérialiser les mutations Git avec Workspace/agent ; vérifier préconditions, préserver brouillons, revalider manifeste/empreintes après changement de working tree et signaler une réparation nécessaire. | MVP | ACC-32 |
| REQ-GIT-007 | Définir confiance du dépôt et politique des hooks/filtres/helpers ; refuser commandes hôte arbitraires, protocoles/URL réécrites non validés et publication autorisée par un document ou le modèle. | MVP | ACC-35 |
| REQ-GIT-008 | Prévisualiser fichiers et commits publiés, exclure données privées par défaut et contrôler l'historique sortant ; un fichier déjà suivi ne doit pas être réputé protégé par gitignore. | MVP | ACC-35 |
| REQ-GIT-009 | Fournir merge et résolution à trois versions, rebase local continue/abort, stash explicite, tags, revert, cherry-pick et blame, sans réécriture publiée ni rollback prétendu atomique. | 1.0 | ACC-34 |
| REQ-GIT-010 | Proposer création/publication d'un dépôt GitHub avec visibilité et autorisation distinctes ; Git local et autres hébergeurs restent fonctionnels sans cette API. | Suite | ACC-33 |

## Qualités transversales

| Identifiant | Exigence et critère vérifiable | Livraison | Recette |
| --- | --- | --- | --- |
| REQ-NFR-001 | Créer, éditer, construire, exécuter et exporter sans réseau une fois les ROM configurées. | MVP | ACC-20 |
| REQ-NFR-002 | Séparer UI, métier et adaptateurs ; empêcher les imports techniques dans les domaines par contrôle automatisé. | 1.0 | ACC-21 |
| REQ-NFR-003 | Protéger les clés avec stockage système disponible ; si la protection est insuffisante, proposer uniquement une clé de session. | MVP | ACC-22 |
| REQ-NFR-004 | Offrir navigation clavier, contrastes suffisants, tailles lisibles et messages accessibles ; le canvas a des commandes alternatives. | 1.0 | ACC-23 |
| REQ-NFR-005 | Garder l'UI réactive pendant analyse, PDF, conversion et émulation selon les objectifs mesurables du document 11. | 1.0 | ACC-24 |
| REQ-NFR-006 | Distribuer une application Windows installable avec version, provenance des composants et désinstallation préservant les projets. | 1.0 | ACC-25 |
| REQ-NFR-007 | Documenter versions, licences et disponibilité des ROM sans assimiler licence du moteur et droits du firmware. | 1.0 | ACC-25 |
| REQ-NFR-008 | Produire des logs expurgés de secrets et de contenus privés ; aucune télémétrie automatique n'est activée. | MVP | ACC-22 |

Les exigences Suite servent à préserver les frontières d'architecture. Elles ne justifient pas un développement anticipé. Le jalon de recette de chacune est précisé dans la feuille de route.
