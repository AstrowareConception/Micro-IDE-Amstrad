# 21 — Explorer et désassembler les binaires Z80

Demande produit du 13 octobre 2026, **dans un second temps après l'import DSK vers projet**, précisée comme une récupération de sources quel que soit le nom du fichier. Statut : partiel en 0.41.3 — récupération BASIC et première lecture Z80 linéaire annotable/exportable. [Guide actuel](../implementation/recovery-protection-alpha.md). Les lots suivants restent une cible. Complète IDE-055 et le [parcours DSK](20-import-dsk-projet.md). Le but est de retrouver une source exploitable dans son langage d'origine lorsque l'information existe encore, puis de comprendre, annoter et éventuellement modifier le code machine lorsque seule cette représentation subsiste.

## Objectif utilisateur : récupérer une source exploitable

La récupération commence par le contenu, pas par l'extension. Un `.BIN` peut contenir un listing BASIC ou du BASIC tokenisé ; un fichier sans extension peut être une source assembleur textuelle. Le choix du décodeur repose sur la structure et des validations cohérentes, avec possibilité de corriger une classification incertaine. Ne pas forcer tous les fichiers vers BASIC, ni tous les `.BIN` vers Z80.

| Information effectivement conservée | Résultat à proposer | Qualification affichée |
| --- | --- | --- |
| Source textuelle BASIC, assembleur ou autre langage reconnu | Importer le texte avec son encodage, sans traduction imposée | Source retrouvée ; prise en charge de l'édition/build indiquée séparément |
| BASIC tokenisé, même nommé `.BIN` | Listing BASIC après décodage déterministe qualifié | BASIC détokenisé ; présentation normalisée éventuelle signalée |
| BASIC protégé au format reconnu | Codec spécifique à qualifier ; conserver le fichier tant qu'il n'est pas disponible | Protection reconnue / conversion disponible ou non |
| Programme compilé conservant une source, des symboles ou un intermédiaire réversible | Exploiter ces informations avec un convertisseur du format identifié | Provenance et pertes éventuelles explicites |
| Code Z80 sans source conservée | Listing assembleur avec labels synthétiques et données conservées | Assembleur reconstruit, pas source historique exact |
| Code machine probablement issu d'un compilateur BASIC | Désassemblage puis étude d'un décompilateur propre à ce compilateur | Origine supposée tant que non prouvée ; récupération BASIC non garantie |
| Données, écrans, musique ou format inconnu | Vue adaptée ou conservation brute | Aucun faux code source inventé |

L'interface doit permettre « Récupérer la source… » puis expliquer le résultat réel. L'absence de support de build pour un langage retrouvé ne justifie pas de perdre sa source. Les annotations et noms présents dans un fichier texte original sont conservés ; ceux absents du binaire ne sont pas présentés comme retrouvés.

### Cas particulier du BASIC réellement compilé

Certains fichiers peuvent dépendre d'un runtime ou d'un format intermédiaire propre à un compilateur. Une signature éventuelle est un indice : la reconnaissance exige des fixtures, une version et une documentation du format, puis un décodeur adapté. Le détokeniseur Locomotive BASIC ne doit pas être appliqué arbitrairement à ce contenu.

Lorsque la compilation a supprimé des informations, plusieurs sources différentes peuvent correspondre au même code machine. Il n'existe alors pas d'inversion générale permettant de retrouver avec certitude le listing exact, ses commentaires, noms et numéros de ligne. Une reconstruction BASIC assistée reste envisageable comme chantier distinct, avec correspondance des routines, comportement attendu et tests explicites.

Proposer cette reconstruction seulement pour un périmètre déclaré : routine sélectionnée, opérations et entrées/sorties comprises, appels machine et effets matériels documentés. Qualifier dialecte, plages numériques, précision, vitesse et consommation mémoire. Un comportement assembleur dépendant des timings, interruptions ou banques peut ne pas être reproductible en BASIC pur ; conserver dans ce cas une routine machine appelée depuis BASIC ou signaler l'impossibilité. Ne pas afficher de pourcentage de fidélité sans mesure définie, ni déclarer équivalence sur la seule explication du modèle.

## Promesse précise

Un programme BASIC tokenisé se détokenise en listing. Un fichier contenant des instructions machine Z80 se **désassemble** en instructions assembleur. Une décompilation de haut niveau peut proposer une représentation reconstruite du comportement ; elle ne retrouve pas automatiquement le code source original.

Les noms de symboles, commentaires, macros, fichiers sources et structures du langage d'origine peuvent avoir disparu. Un programme compilé depuis BASIC, C ou Pascal n'est pas reconverti fidèlement dans son langage d'origine par le seul désassemblage. D'éventuels symboles ou sources présents dans la disquette pourront être associés explicitement. L'interface utilise « Désassembler en Z80 », jamais « Retrouver le source original » comme garantie.

L'extension `.BIN` n'identifie ni le processeur ni le contenu : elle peut désigner du code, une image, du son, des tables, des données compressées ou un mélange. La cible proposée dans un projet CPC classique est le Z80, mais le type AMSDOS binaire n'atteste pas que chaque octet soit une instruction.

## Parcours attendu

1. Ouvrir un binaire extrait du DSK ou importé directement. Montrer taille, empreinte, en-tête AMSDOS éventuel, charge utile et aperçu hexadécimal. Conserver le fichier complet et distinguer l'en-tête des octets à analyser.
2. Proposer adresse de chargement et point d'entrée depuis les métadonnées valides, avec leur provenance. Pour un fichier brut ou ambigu, permettre la saisie et conserver l'état « inconnu » ; ne pas supposer silencieusement une origine 0. Une entrée absente, hors plage ou destinée à une donnée n'est pas une preuve d'exécution.
3. Choisir une plage et lancer le désassemblage local à la demande. Présenter adresse, octets et instruction côte à côte, avec navigation vers les cibles directes. Les zones non classées restent des octets ; l'utilisateur peut marquer code, données, chaînes et tables.
4. Annoter, nommer les routines et enregistrer le travail dans le projet. Générer des labels stables par adresse (`sub_8000`, etc.) en indiquant qu'ils sont synthétiques. Associer chaque annotation à l'empreinte du binaire et à la carte mémoire analysée.
5. Demander à l'IA d'expliquer une routine, proposer des noms, documenter des appels ou suggérer une modification. Afficher les hypothèses avec les adresses et octets concernés, et préserver l'analyse humaine lors d'un nouveau calcul.
6. Dans un lot ultérieur, exporter un `.asm` réassemblable, reconstruire un nouveau `.BIN`, comparer les octets puis tester dans le CPC avant de l'inclure dans une nouvelle disquette. L'original est toujours conservé.

## Deux lectures complémentaires

**Lecture linéaire :** décoder une plage choisie, sans prétendre que ces instructions seront exécutées. Des données peuvent former des instructions parfaitement valides ; un décodage réussi ne prouve pas leur rôle.

**Exploration depuis des entrées :** suivre les branches et appels directs reconnus dans un budget borné. Arrêter les conclusions aux sauts indirects, conflits de décodage ou zones manquantes. `JP (HL)`, tables de sauts, code automodifiant, chargements/décompressions et commutation de banques demandent du contexte. Ne pas assimiler « non atteint par l'analyse » à « inutile ».

Une troisième lecture, ultérieure, peut enrichir l'analyse avec des instructions réellement observées pendant l'exécution. Chaque trace conserve firmware, configuration RAM/ROM, banque, horodatage logique et empreinte des octets exécutés. Une adresse Z80 seule ne suffit pas à identifier un code dans un CPC à banques. Une trace couvre un scénario, pas tous les comportements.

## Décodage et contrats

Le moteur distingue le Z80 classique des extensions d'autres processeurs. Qualifier les instructions de base, préfixes CB/ED/DD/FD, formes indexées DDCB/FDCB, déplacements relatifs signés, instructions tronquées et préfixes répétés/ignorés. Les instructions non documentées ont une politique explicite ; si leur représentation assembleur ne garantit pas les octets exacts, conserver une directive d'octets bruts.

Le résultat contient offsets fichier, adresses logiques avec contexte, octets originaux, taille, mnémonique/opérandes, destinations directes, diagnostics et provenance de classification. Séparer faits du décodeur, indications utilisateur, observations machine et hypothèses IA. Une modification de l'origine ou du fichier invalide les liens concernés au lieu de déplacer silencieusement les annotations.

Les noms de routines firmware CPC peuvent être proposés depuis une table sourcée et un profil qualifié. Une adresse ne suffit pas à certifier qu'une ROM est visible ni qu'une routine utilisateur a la même fonction. Les appels `CALL` d'un BASIC importé constituent des indices de points d'entrée, pas une preuve universelle de cartographie mémoire.

L'analyse statique ne nécessite ni ROM, ni exécution, ni réseau. Le décodeur demeure indépendant d'Electron/React et du fournisseur IA ; l'application gère budgets, annulation et snapshots, puis les adaptateurs intègrent le moteur choisi. L'analyse et le rendu des longs listings doivent rester bornés et ne pas s'exécuter en continu pendant la frappe.

## IA et reconstruction

L'agent travaille sur les extraits autorisés, les références et les annotations. Il peut produire une explication, du pseudocode ou une proposition assembleur, mais doit distinguer explicitement ces trois livrables. Les noms suggérés et le pseudocode sont des reconstructions, pas des informations historiques retrouvées. Aucune transformation en BASIC fidèle n'est promise.

L'export assembleur inclut une origine explicite lorsque connue, labels synthétiques et directives pour les octets non interprétés. Fixer un dialecte d'assembleur avant de promettre un export réassemblable. Ne pas remplacer les octets canoniques par une réécriture du modèle.

Avant modification, vérifier un **aller-retour binaire → assembleur → binaire identique octet pour octet** sur le périmètre pris en charge. Ce contrôle valide la conservation des octets, pas les noms ni l'interprétation du programme. Ensuite, une modification impose contrôle des tailles, plages et chevauchements, sauts relatifs, adresses publiques appelées par BASIC, métadonnées AMSDOS et tests comportementaux. Préserver les entrées existantes ou rendre leur changement explicite ; aucune relocalisation automatique supposée sûre.

## Évaluation d'outils existants

Le [manuel officiel Zilog Z80](https://www.zilog.com/docs/z80/um0080.pdf) sert de référence pour les instructions documentées. Le dépôt [floooh/chips](https://github.com/floooh/chips), déjà utilisé pour l'émulation, décrit des outils de débogage incluant le désassemblage : examiner ce socle et ses conditions d'intégration au commit verrouillé du projet.

Autre piste : [maziac/z80dismblr](https://github.com/maziac/z80dismblr), écrit en TypeScript, expose analyse de flux et annotations ; son auteur indique que le développement a été intégré dans DeZog. Ne pas choisir une dépendance sur la seule commodité de son langage. Comparer API, licence exacte, maintenance, fidélité des opcodes, performances et usage sans shell arbitraire. Aucun outil ni version n'est sélectionné dans ce cadrage ; la décision nécessitera une ADR et des tests comparatifs.

## Lots et recette

| Lot | Capacité | Critère de sortie |
| --- | --- | --- |
| Z80-A | Explorateur hexadécimal, métadonnées et désassemblage d'une plage | Offsets/adresses exacts, couverture documentée, tronquages et origine inconnue traités sans invention |
| Z80-B | Entrées multiples, labels, code/données et annotations persistantes | Branches directes navigables ; conflits/indirections visibles ; annotations préservées et révisions protégées |
| Z80-C | Explications et annotations IA | Faits/hypothèses séparés, extraits contrôlés, diff et restauration ; aucune promesse de source original |
| Z80-D | Assembleur, aller-retour, binaire modifié et réexport DSK | Binaire inchangé identique avant édition, puis programme modifié testé et exporté avec métadonnées correctes |
| Z80-E | Traces CPC et code en mémoire | Identité banque/adresse/version respectée ; limites de couverture et budgets visibles |
| SRC-F | Reconnaissance de compilateurs et récupération d'intermédiaires conservés | Format/version identifiés sur fixtures ; refus des faux positifs ; pertes documentées |
| SRC-G | Reconstruction assistée vers BASIC d'un périmètre compris | Réécriture identifiée, exemples et tests comparatifs sur entrées/sorties ; limites numériques, mémoire et temps explicites |

Jeux d'essai originaux ou redistribuables : chaque famille d'opcodes, déplacements négatifs, préfixes et alias, fin de fichier au milieu d'une instruction, en-têtes valides/invalides, origine inconnue, code/données imbriqués, tables de sauts, chargement à une autre adresse, débordement d'espace 16 bits, automodification et banques. Comparer au moins un décodeur indépendant ; tester les refus aussi bien que les sorties. Ne pas importer une suite de tests avec ROM ou logiciels commerciaux sans autorisation.

Le premier résultat utile est un atelier de lecture et d'annotation. La boucle complète permettant à l'IA d'améliorer un binaire exige également l'assembleur, les contrôles et les tests du lot D. Les lots SRC-F/G sont exploratoires, conditionnés à l'identification de formats réels ; ils ne constituent pas un décompilateur BASIC universel. Cette extension vient après le parcours DSK/BASIC, conformément à la demande ; aucune date, version ni compatibilité universelle n'est annoncée.
