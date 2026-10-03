# Glossaire partagé

| Terme | Sens dans le projet |
| --- | --- |
| Micro-IDE | Atelier réduit réunissant projet, éditeur, machine, ressources et assistant |
| CPC | Famille Amstrad Color Personal Computer ; ici CPC classique en premier |
| Profil machine / MachineProfile | Identité versionnée d'une machine, firmware attendu, capacités et qualification |
| Dialecte / DialectProfile | Version du Locomotive BASIC et variantes qualifiées |
| Firmware / ROM | Code OS, BASIC ou AMSDOS utilisé par la machine ; droits distincts du moteur |
| Émulateur / EmulatorCore | Simulation du matériel et exécution du firmware |
| Session / EmulatorSession | Instance vivante d'une machine et de ses observations |
| Horloge émulée | Temps de la machine invitée, indépendant du temps d'attente de l'utilisateur |
| Prompt BASIC | Invite de l'interpréteur ; différent de la demande adressée à l'IA |
| SourceDocument | Fichier de travail textuel identifié et versionné |
| Listing | Représentation lisible du programme BASIC numéroté |
| Ligne physique | Position dans le fichier de l'éditeur |
| Ligne BASIC / BasicLineNumber | Numéro utilisé par le programme CPC pour ses références |
| AST | Arbre syntaxique qui distingue une instruction, une donnée et une référence |
| Zone opaque | Texte conservé dont le parser n'a pas prouvé la structure |
| Renumérotation | Transformation des numéros et de leurs références syntaxiques |
| Tokenisation | Encodage natif des instructions et valeurs pour l'interpréteur BASIC |
| Compilation Z80 | Production de code machine Z80 ; hors chaîne BASIC initiale |
| Build / Construction | Analyse, encodage, assemblage média et validation de livraison |
| ProjectRevision | Capture immuable des entrées d'un travail ; pas un commit Git |
| Empreinte / ContentHash | SHA-256 d'octets précisément définis |
| InputFingerprint | Identité canonique des entrées pertinentes et outils de construction |
| Artefact / BuildArtifact | Sortie validée d'une construction, avec type et empreinte |
| DSK | Conteneur d'image de disquette ; distinct du système de fichiers interne |
| DSK standard | Conteneur à blocs de pistes de taille uniforme |
| Extended DSK | Conteneur à tailles de piste variables et métadonnées supplémentaires |
| DATA | Format disque AMSDOS sans pistes système, choisi pour la première livraison |
| AMSDOS | Services disque et extensions ROM du CPC |
| CP/M | Système et conventions de fichiers avec lesquelles AMSDOS partage une structure |
| Record | Unité logique disque CP/M de 128 octets |
| Secteur | Unité physique décrite dans une piste DSK |
| Bloc d'allocation | Unité de réservation de place pour un fichier, 1 Kio dans le profil DATA |
| Extent | Partie d'un fichier décrite par une entrée CP/M ; plusieurs possibles |
| Catalogue / DiskCatalog | Ensemble des entrées et allocations de la disquette |
| Nom CPC / CpcFilename | Nom 8.3 normalisé suivant la politique du produit |
| En-tête AMSDOS | Métadonnées de certains fichiers CPC, absent du BASIC ASCII non protégé |
| SessionDisk | Copie mutable de disque utilisée par le programme émulé |
| Snapshot interne | Capture du cœur liée à son format/version ; pas SNA public par défaut |
| Pièce jointe / ContextDocument | Document choisi pour concevoir ou assister ; pas embarqué sur disque par défaut |
| Ressource / CpcAsset | Contenu converti et destiné à la machine |
| Recette / AssetRecipe | Paramètres et versions permettant de reproduire une conversion |
| Mode écran | Résolution et nombre d'encres du mode CPC standard |
| Encre / Ink | Index logique de palette utilisé par le BASIC |
| Palette | Correspondance entre encres et couleurs CPC |
| ContextBundle | Contenus, provenance, cible et budget figés pour une demande IA |
| AiRequest | Requête volontaire au fournisseur configuré |
| AgentTask | Mission de programmation avec scope, outils, budgets, journal et état |
| ToolCall | Appel d’un outil local validé, identifié et journalisé |
| TaskCheckpoint | État cohérent conservé pour reprendre ou restaurer une mission |
| Steering | Consigne utilisateur intégrée pendant une mission à une frontière sûre |
| CorpusVersion | Identité d’une version de sources et fiches de référence |
| ChangeProposal | Ensemble structuré de changements du mode Revue, avant application |
| Diff | Comparaison entre source de base et source proposée |
| AppliedChange | Transaction acceptée, enregistrée et réversible sous préconditions |
| Précondition | Révision, empreinte ou absence requise pour appliquer une opération |
| CapabilitySet | Capacités effectives d'un adaptateur, distinctes des ambitions produit |
| Qualification | Campagne d'essai documentée justifiant une compatibilité précise |
| MVP produit | Livraison couvrant l'intention initiale, y compris IA et pièces jointes |
| Port | Contrat d'un besoin applicatif indépendant d'une technologie |
| Adaptateur | Implémentation d'un port pour fichiers, émulateur, UI ou fournisseur |
| Couche anticorruption | Traduction qui empêche les détails d'un système externe d'envahir le métier |

Les noms de code anglais ci-dessus forment le vocabulaire commun. Des objets de même nom dans deux contextes ne partagent pas un état mutable par défaut. Une commande CPC, une commande applicative et une instruction au modèle sont trois concepts distincts.
