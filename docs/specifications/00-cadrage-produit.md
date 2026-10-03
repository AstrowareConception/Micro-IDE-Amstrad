# 00 — Cadrage produit

## Intention

Micro IDE Amstrad doit rendre la programmation CPC aussi directe que l'écriture dans un éditeur contemporain : décrire une idée, écrire ou faire proposer un programme, comprendre les limites de la machine, lancer le résultat et emporter une disquette indépendante de l'outil. Le plaisir recherché est celui de créer pour une machine réelle, avec ses couleurs, son clavier, ses sons et ses contraintes, tout en bénéficiant d'une assistance moderne.

L'outil réunit trois activités qui restent distinctes : concevoir un programme, expérimenter sur une machine et préparer une livraison. Une image donnée à l'IA peut être une inspiration, un document peut être une spécification, un écran CPC converti peut être une ressource embarquée. L'interface doit rendre ces rôles visibles pour éviter qu'une pièce jointe de 20 Mo soit confondue avec un fichier à placer sur une disquette de quelques centaines de kilo-octets.

## Utilisateurs et résultats attendus

| Profil | Besoin central | Réussite observable |
| --- | --- | --- |
| Créateur amateur | Retrouver le BASIC sans configurer plusieurs outils | Créer, exécuter puis exporter son premier programme |
| Débutant ou étudiant | Comprendre une erreur, une instruction et les contraintes CPC | Relier un diagnostic à sa ligne et corriger avec une explication |
| Développeur rétro | Conserver le contrôle du listing, de la mémoire et du disque | Reproduire une construction et utiliser le DSK dans un autre émulateur |
| Auteur assisté par IA | Confier une mission de programmation et des ressources à un agent | Voir les fichiers évoluer, les essais et corrections, orienter la mission et revenir en arrière |

Le produit est individuel et local. La collaboration Git est possible parce que les sources sont ouvertes et textuelles, mais l'hébergement de projets et l'édition simultanée ne font pas partie de la première version.

## Plateformes et machines

L'application est une application de bureau avec technologies d'interface web embarquées. Windows 11 x64 constitue la première plateforme qualifiée. Linux x64 et macOS arm64 suivent avec des critères explicites ; un build qui compile sur ces systèmes n'est pas présenté comme une validation utilisateur complète. Les versions minimales exactes sont fixées au jalon J1 à partir de la version d'Electron réellement retenue et de sa politique de support.

La cible initiale est le CPC 6128 classique, 128 Ko de RAM physique, BASIC 1.1 et AMSDOS. Cela n'accorde pas 128 Ko disponibles au programme BASIC : l'espace directement exploitable dépend de la ROM, de la mémoire vidéo et des allocations. Le CPC 464 avec BASIC 1.0 et le CPC 664 sont des extensions prévues mais séparément qualifiées. Un 464 d'origine n'a pas de lecteur de disquette ; un profil avec DDI-1 doit être annoncé comme tel et prouvé. La gamme Plus nécessite l'émulation de l'ASIC et ne peut pas être activée par un simple changement de nom. PCW/Mallard BASIC et PC-1512/BASIC 2 sont des familles différentes, hors périmètre initial.

## Périmètre des versions

| Livraison | Contenu | Engagement |
| --- | --- | --- |
| J0, preuve technique | Boot 6128, BASIC ASCII sur DSK, lecture et écriture disque, clavier, vidéo et son | Décider si le moteur est adapté |
| J1–J3, alpha locale | Projet, éditeur, diagnostics, exécution intégrée, export DSK | Parcours complet sans IA |
| J4, ressources | Pièces jointes et conversion d'écran CPC | Alimenter l'IA et embarquer des ressources |
| J5, MVP produit | Agent avec outils fichiers, références, ressources, construction et essais, plus mode revue optionnel | Réaliser l'intention initiale de bout en bout |
| J6, version 1.0 | Packaging, reprise après incident, qualification et documentation utilisateur | Diffusion régulière sur Windows |
| Après 1.0 | BASIC tokenisé, débogage avancé, machines supplémentaires, autres fournisseurs | Étendre sans casser les projets |

Le mode tokenisé natif n'est pas requis pour le premier DSK : AMSDOS sait charger un listing ASCII valide. La tokenisation reste une optimisation et un besoin d'interopérabilité ultérieur, pas une raison de retarder la preuve d'exécution réelle.

## Parcours de référence

**Créer un jeu simple.** L'utilisateur crée un projet 6128, décrit une scène ou une mécanique, donne une image d'inspiration et un document de règles. L'agent explore le projet, consulte les références BASIC, crée et modifie les sources, convertit les ressources utiles, construit puis teste dans le CPC émulé. Il corrige les erreurs observables dans les limites de sa mission. L'utilisateur voit le journal et les fichiers évoluer, oriente ou arrête le travail, puis exporte un DSK. Une autre personne lance `RUN"MAIN.BAS"` dans un émulateur indépendant.

**Reprendre un ancien listing.** L'utilisateur importe du texte, choisit son encodage, détecte des références de lignes absentes et des instructions BASIC 1.1 sur une cible 1.0. Il corrige manuellement ou sollicite l'assistant. Les changements de numérotation sont des refactorings contrôlés, qui ne touchent pas les nombres dans les chaînes ou les données.

**Comprendre une erreur.** Un diagnostic statique certain bloque une construction. Une erreur observée dans la machine est présentée avec sa provenance et, lorsque l'identification est fiable, sa ligne BASIC. L'utilisateur peut donner à l'IA le listing et une capture choisie. Le logiciel ne prétend pas avoir un débogueur BASIC complet lorsqu'il ne dispose que d'une image ou d'une trace ROM partielle.

## Contraintes de conception

Le travail local ne nécessite ni compte du produit ni connexion réseau. Une panne du fournisseur IA laisse l'éditeur et l'émulateur utilisables. La source manuelle est le format de référence ; le code écrit par l'agent est du code normal, avec historique et checkpoints. Le disque exporté ne contient ni conversation, ni clé API, ni document de contexte non sélectionné comme ressource CPC.

Le mode principal est **Agent** : une demande donne une mission de programmation, pas seulement une réponse à copier. Les modes **Revue** et **Explication** restent disponibles. Les documents Locomotive BASIC constituent un corpus que l'agent devra consulter activement et dont les fiches seront qualifiées, couvrant notamment modes graphiques, mémoire, entrées-sorties, son, timers et dialectes. La sélection d'un périmètre de mission remplace les confirmations répétées pour les opérations locales réversibles.

Le succès commercial et pédagogique sera évalué par des essais utilisateurs : accomplissement du parcours de référence, nombre de manipulations nécessaires pour lancer le premier listing, compréhension des erreurs, facilité de récupération et confiance dans l'export. Aucun délai de livraison, budget de développement ou score de satisfaction n'est inventé à ce stade.
