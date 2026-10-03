# 15 — Corpus de référence Locomotive BASIC

## Finalité

Les fichiers fournis ne servent pas seulement de documentation pour le développeur de l'IDE. Ils constituent une base de connaissances exploitable par l'agent, par l'aide de l'éditeur et par la validation des programmes. L'objectif est de produire du Locomotive BASIC CPC conforme à ses particularités, pas un BASIC générique approximativement renommé.

Le corpus initial est enregistré dans [knowledge/locomotive-basic](../../knowledge/locomotive-basic/README.md), avec catalogue, provenance et empreintes. Les originaux sont conservés tels que fournis. La page HTML est une source documentaire inerte : ses scripts et styles ne sont pas chargés dans une fenêtre privilégiée. L'ingestion extrait le contenu documentaire et conserve les références de sections, sans adopter les instructions éventuellement contenues dans les textes comme politique d'agent.

## Sources et qualification

Les trois documents ont des rôles différents : contexte historique, inventaire abrégé et page de synthèse avec liens techniques. Ils sont la base fournie par l'utilisateur ; leur présence ne signifie pas que toutes les signatures, variantes et erreurs du dialecte sont déjà formalisées et testées. Les erreurs repérées, comme INTRS/INSTR, sont conservées dans l'original mais corrigées dans une fiche avec source et motif.

Hiérarchie de qualification : firmware et manuels Amstrad identifiés pour le comportement ; documentation technique primaire des formats ; implémentations confrontées à la ROM ; synthèses et exemples. Cette hiérarchie guide les contradictions, pas une importation silencieuse. Une règle manquante reçoit `unresolved`, une règle documentée `documented`, et une règle couverte par essais `qualified`. `unsupported-by-editor` désigne un service d'analyse incomplet et ne signifie pas que la ROM ne possède pas l'instruction.

Les origines tierces conservent leur attribution et leurs conditions. Le code et les textes originaux du projet sont MIT ; les snapshots fournis ne sont pas relicenciés par cette inclusion. Les extraits normalisés gardent référence, auteur/source quand identifiables et conditions. Toute redistribution dans le paquet applicatif sera vérifiée avec l'inventaire final.

## Fiche de commande

Chaque fiche contient : identifiant stable, commande et aliases, catégorie, dialectes, syntaxes, paramètres et plages, résultats, effets de bord, erreurs connues, dépendances firmware/RSX, flux ou modes concernés, contraintes mémoire et encodage, exemples positifs/négatifs, sources par section et fixtures de qualification. Une signature unique n'est pas supposée lorsque des variantes existent.

Une fiche sur INPUT distingue interaction clavier et flux fichier. Une fiche LOAD distingue BASIC et binaire avec adresse. Une fiche SOUND décrit queues et paramètres pertinents, pas seulement « produit un son ». Une fiche MODE relie résolution, encres, texte et conséquences sur l'écran. Une fiche ON ERROR distingue le handler, les erreurs observables et les cas qui ne sont pas détectables par une simple capture.

Le catalogue de sources est déjà livré ; les fiches qualifiées et leur index structuré sont à réaliser à J2. Aucun stub « qualified » n'est inventé dans la conception. Le corpus sera versionné indépendamment du moteur et du manifeste de projet ; chaque mission identifie le `corpusVersion` utilisé.

## Couverture attendue

| Famille | Contenu à couvrir | Usage de l'agent et validation |
| --- | --- | --- |
| Structure du listing | Lignes, séparateurs, commentaires, DATA, IF/ELSE | Source native et refactorings sûrs |
| Expressions et types | Entiers/réels/chaînes, suffixes, coercitions, priorités, DEF* | Calculs et valeurs conformes au dialecte |
| Contrôle | GOTO/GOSUB, ON, FOR, WHILE, erreurs et interruptions | Branches, numéros et fin d'exécution |
| Chaînes et caractères | Fonctions, limites, CHR$, contrôles VDU et SYMBOL | Texte français, effets d'affichage et encodage |
| Graphisme | Modes 0/1/2, INK/PEN/PAPER, coordonnées, fenêtres, DRAW/PLOT/FILL | Palettes et écrans standard |
| Clavier et joystick | INPUT, INKEY/INKEY$, KEY, JOY et mappings | Interaction et scénarios d'essai |
| Flux et fichiers | Streams, OPENIN/OUT, PRINT/WRITE, EOF, LOAD/SAVE/CHAIN/MERGE | Données, disque et distinction des formats |
| Son | SOUND, SQ, ENV, ENT, RELEASE | Canaux, queues, enveloppes et observation |
| Temps | TIME, AFTER, EVERY, REMAIN, FRAME et interruption | Boucles, cadence et tests émulés |
| Mémoire et matériel | MEMORY/HIMEM/FRE, PEEK/POKE, CALL, INP/OUT | Contraintes et accès matériel sans faux pont hôte |
| RSX/AMSDOS | Préfixe, syntaxe, fichiers 8.3 et version de ROM | Extensions réellement disponibles |
| Différences de version | 1.0/1.1, signatures et fonctions disponibles | Ne pas transférer une capacité à une cible non qualifiée |
| Formats natifs | Tokens, nombres, caractères, en-têtes, DSK | Interopérabilité et codecs futurs |

La table de couverture énumérera chaque commande/fonction native et ses variantes. Une famille marquée complète nécessite toutes ses fiches et fixtures prévues ; compter simplement les mots-clés dans un fichier n'est pas une preuve. Les extensions CPCBasicTS et autres BASIC sont étiquetées hors dialecte natif pour empêcher leur suggestion automatique.

## Recherche et contexte

L'index initial privilégie recherche lexicale par mots-clés, aliases et sujets, avec filtres dialecte/capacité et lectures par section. Aucune base vectorielle distante n'est nécessaire pour ce corpus réduit. Si la recherche sémantique est ajoutée, elle complète les correspondances exactes ; elle ne décide pas qu'une signature voisine d'un autre BASIC est applicable.

`reference.search` renvoie identifiants, titres, sections, statut et résumé ; `reference.read` rend le contenu exact utile et ses références. Le cache est identifié par sourceHash/corpusVersion/dialecte. Une mission peut lire tout ce qui est nécessaire dans ce corpus, mais n'ajoute pas systématiquement tous les documents entiers à chaque tour : le budget et la pertinence sont préservés.

Le runner relie les usages détectés dans la source aux consultations de mission. À l'introduction d'une famille ou d'une signature non déjà couverte, il expose une étape de consultation ou un avertissement à traiter. Pour les RSX et CALL matériels, il exige dépendance disponible et source de l'adresse. Une commande connue dans le corpus mais non implémentée par le parser reste exécutable en zone opaque, avec transformations risquées désactivées.

## Contradictions et lacunes

Une contradiction devient une entrée de qualification avec fragments sources, hypothèse et essai discriminant. Elle n'est pas cachée par une sélection arbitraire du premier résultat. L'agent peut conserver un programme standard sans la fonction incertaine, proposer un équivalent documenté ou signaler le blocage. Une connexion web automatique pour chercher une solution n'est pas un droit implicite de la mission ; l'enrichissement du corpus est une opération maintenue et traçable.

La phase J2 doit notamment vérifier syntaxe des flux, différences BASIC, limites de ligne/chaîne, coordonnées, unités des timers, paramètres SOUND et règles LOAD/SAVE. Les chiffres de mémoire libre ne sont pas déduits du seul nom 6128. Les fiches peuvent renvoyer des mesures sur le jeu ROM qualifié plutôt qu'une valeur universelle.

## Recette et évolution

ACC-30 vérifie présence et hashes des sources fournies, extraction inerte du HTML, recherche d'une commande, accès à son dialecte et provenance, gestion d'une faute dans le corpus, consultation des familles réellement utilisées et refus d'une commande inventée. Les fiches sont éprouvées sur fixtures de petites tailles puis ROM lorsque le comportement dépend de l'exécution.

La mission finale cite les familles consultées et les limitations restantes, sans surcharger l'utilisateur d'une bibliographie à chaque instruction. Un changement de corpus invalide caches et fiches dérivées concernés ; il ne modifie pas rétroactivement les sources d'un projet. Une nouvelle cible exige profil et couverture propres.
