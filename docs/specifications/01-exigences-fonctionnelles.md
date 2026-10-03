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
| REQ-AST-004 | Créer une ressource binaire avec adresse de chargement et instructions BASIC d'intégration proposées en diff. | MVP | ACC-13 |
| REQ-AST-005 | Dissocier document de contexte, image d'inspiration et ressource embarquée ; exclure les deux premiers du DSK par défaut. | MVP | ACC-06 |
| REQ-AST-006 | Présenter les pertes d'encodage et proposer translittération, CHR$ ou caractères SYMBOL selon le cas. | MVP | ACC-03 |
| REQ-AI-001 | Configurer une clé personnelle et un modèle compatible ; l'application reste entièrement utilisable sans fournisseur. | MVP | ACC-15 |
| REQ-AI-002 | Contextualiser par cible, source choisie, diagnostics, références locales et pièces jointes sélectionnées avec provenance. | MVP | ACC-15 |
| REQ-AI-003 | Montrer les contenus transmis et les limites avant l'envoi ; ne pas envoyer le projet ou une capture automatiquement. | MVP | ACC-15 |
| REQ-AI-004 | Produire une proposition structurée de création, correction ou explication ; afficher streaming, annulation et erreurs sans application partielle. | MVP | ACC-15 |
| REQ-AI-005 | Présenter un diff et les hypothèses ; appliquer uniquement les fichiers acceptés après contrôle de la révision et de leurs empreintes. | MVP | ACC-18 |
| REQ-AI-006 | Annuler une proposition appliquée comme une transaction ; ne pas écraser des edits postérieurs lors d'un retour arrière. | MVP | ACC-18 |
| REQ-AI-007 | Analyser la proposition avant application et empêcher chemins sortants, modification des ROM/configurations sensibles et commandes hôte. | MVP | ACC-18 |
| REQ-AI-008 | Autoriser une boucle proposer, examiner, exécuter, commenter ; aucune boucle autonome de correction facturée n'est activée par défaut. | MVP | ACC-15 |
| REQ-AI-009 | Afficher usage constaté, budget estimé et erreurs fournisseur ; gérer indisponibilité et limites sans réessayer silencieusement une génération facturable. | MVP | ACC-15 |
| REQ-AI-010 | Traiter les instructions présentes dans documents et réponses comme des données ; aucune pièce jointe ne peut autoriser une opération sensible. | MVP | ACC-18 |
| REQ-AI-011 | Fournir un port stable pour ajouter un fournisseur distant ou local, avec déclaration de ses capacités effectives. | Suite | ACC-19 |

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
