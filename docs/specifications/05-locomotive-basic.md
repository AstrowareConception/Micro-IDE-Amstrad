# 05 — Locomotive BASIC : langage et outillage

## Autorité d'exécution

Le programme utilisateur est du Locomotive BASIC CPC. L'interpréteur de la ROM reste l'autorité pour son comportement effectif. L'IDE ne transforme pas le listing en JavaScript et ne promet pas un exécutable Z80. Il produit un listing encodé chargeable par AMSDOS, puis, dans une version ultérieure, un programme tokenisé natif. Le terme produit est **construire**, même si des phases d'analyse ressemblent à celles d'un compilateur.

La source de travail est un fichier UTF-8, fins LF, avec lignes BASIC explicites. Les lignes vides de mise en page sont acceptées dans l'éditeur et omises à la construction. Les lignes non vides sans numéro déclenchent une erreur dans le mode BASIC natif. Un mode labels, macros ou numérotation automatique globale serait un autre langage source, avec source map et qualification propres ; il est hors MVP.

## Profils de dialecte

Le profil initial `locomotive-1.1` est associé au 6128. Le profil `locomotive-1.0` futur distingue les fonctions apparues en 1.1, notamment FILL, FRAME, MASK, GRAPHICS, CURSOR et COPYCHR$. La disponibilité exacte et les variantes de signature sont une table qualifiée, pas une liste approximative reprise d'un article. Les fonctions et RSX documentées sont rattachées à leur provenance et à leurs dépendances ROM.

Le corpus fourni contient des fautes et simplifications : `INTRS` doit être vérifié comme `INSTR`, une mention de GET/PUT ne suffit pas à créer ces commandes dans le BASIC CPC, ERASE concerne les tableaux tandis que `|ERA` appartient à AMSDOS. DEC$ et les différences de version demandent une vérification dédiée. Les durées, arrondis, masques sonores et flux ne sont pas inférés d'une paraphrase. Une aide incertaine porte ce statut jusqu'à son essai sur ROM.

## Lexique, syntaxe et représentation

Un numéro de ligne est un entier 1–65535. Les doublons et l'ordre non croissant sont des erreurs dans la source canonique. Importer un listing non ordonné propose une réorganisation avec aperçu ; l'éditeur ne réordonne pas pendant la frappe. La limite de saisie de 255 caractères est traitée initialement par une règle conservatrice sur la ligne encodée, numéro et séparateur compris, puis calibrée sur les ROM qualifiées à J0.

Le lexer distingue identifiants et suffixes `$`, `%`, `!`, nombres décimaux, notations `&`/`&H`/`&X`, opérateurs, flux `#`, marqueur RSX `|`, chaînes, séparateurs `:`, REM et apostrophe. Les nombres dans les chaînes et commentaires ne deviennent jamais des références. DATA possède son propre traitement de champs et de chaînes. Les combinaisons comme `PRINT#0`, `?`, `GO TO`, comparateurs alternatifs ou caractères accolés sont acceptées seulement selon les variantes prouvées pour le dialecte.

Une grammaire de démarrage, à détailler par fixtures au jalon J2, comprend `Program → NumberedLine*`, `NumberedLine → LineNumber StatementList`, `StatementList → Statement (':' Statement)*`. Cette notation ne résout pas IF/THEN/ELSE : ses branches et séparateurs doivent respecter le comportement du dialecte, avec tests imbriqués. Le parser d'expressions conserve priorité, opérateurs logiques, appels et tableaux. Une « grammaire BASIC standard » générique ne suffit pas.

L'AST conserve texte exact, offsets, numéro physique, numéro BASIC et zones opaques. L'analyse partielle fournit complétion et diagnostics sûrs sans inventer le sens d'une construction non reconnue. Une syntaxe légale mais non encore analysée produit `analysis-incomplete`, pas une erreur bloquante ; elle peut être exécutée comme listing ASCII. Le refactoring, en revanche, est désactivé si la zone opaque peut contenir des références affectées.

## Services de langage

| Service | Contrat |
| --- | --- |
| Coloration | Rapide, incrémentale, ne modifie aucun octet |
| Complétion | Contexte instruction/expression/RSX ; liste filtrée par profil |
| Hover et signature | Syntaxe, paramètres, exemple court, version et source |
| Navigation | Définition de ligne et occurrences des références statiques |
| Diagnostics | Code stable, gravité, plage, provenance et confiance |
| Renumérotation | Plan complet, référence par référence, aperçu et transaction |
| Formatage | Opt-in ; ne change ni chaîne, commentaire ni données ; pas de formatage global automatique au MVP |
| Estimation mémoire | Taille connue et hypothèses distinctes de la mémoire réellement libre |

L'analyse est différée pendant la saisie, annulable et associée à la version du document. Un changement de profil recalcule diagnostics et complétion. Les références inconnues dans `LOAD`, `RUN` ou `CHAIN` avec nom calculé deviennent des avertissements, pas de fausses erreurs « fichier absent ».

## Renumérotation

Entrées : document, révision, première ligne, incrément et plage sélectionnée. Le plan établit une bijection entre anciennes et nouvelles lignes, vérifie collisions et dépassement, puis réécrit les nœuds de références du programme. Les usages à couvrir incluent GOTO, GOSUB, THEN/ELSE à cible numérique, ON … GOTO/GOSUB, AFTER/EVERY … GOSUB, ON SQ … GOSUB, ON BREAK GOSUB, ON ERROR GOTO, RESTORE, RESUME et RUN numérique.

`ON ERROR GOTO 0` est un cas spécial de désactivation, à préserver. Une référence vers un autre fichier lors d'un CHAIN/RUN n'est pas modifiée comme une référence locale. Toute politique sur CHAIN avec ligne de départ exige un test de portée. Les références de lignes construites par le programme ou présentes dans des chaînes ne sont pas réécrites ; un avertissement rappelle cette limite lorsqu'un usage indirect est détecté.

Exemple : renuméroter `10 GOTO 100`, `100 PRINT "100":DATA 100` à partir de 1000 par pas de 10 donne une cible 1010 ; la chaîne et la donnée gardent 100. Le preview affiche toutes les substitutions, y compris hors de la plage si elles pointent vers une ligne renumérotée. L'application est une action d'annulation unique et échoue si le document a changé entre preview et validation.

## Diagnostics et budgets

Erreurs certaines : numéro invalide, doublon, encodage non représentable, chaîne mal formée selon règles qualifiées, référence locale certaine absente, sortie mémoire ou disque déterministe impossible. Avertissements : code potentiellement inaccessible, GOSUB/RETURN suspect, boucle pouvant attendre indéfiniment, accès matériel, adresse de chargement en conflit, fichier dynamique inconnu. Une analyse statique ne décide pas généralement de la terminaison, de l'épuisement des tableaux ou d'un calcul d'adresse arbitraire.

Les chaînes CPC ont leurs limites en octets ; la taille d'une chaîne JavaScript ou UTF-8 n'est pas un substitut. Le calcul de taille tokenisée, lorsqu'il devient disponible, dépend des nombres et références codés, pas seulement du nombre de mots-clés. La mémoire BASIC estimée distingue programme, variables, tableaux, piles, buffers, caractères SYMBOL et réservations MEMORY. Les banques supplémentaires du 6128 ne sont pas ajoutées à cette estimation comme mémoire linéaire.

## BASIC tokenisé ultérieur

La structure comporte longueur little endian, numéro, tokens et fin de ligne, puis fin de programme. Le codec doit gérer tokens préfixés, nombres, variables, références et formes mises en cache par l'interpréteur, sans encoder seulement les mots-clés. Les valeurs réelles ne sont pas des flottants IEEE copiables directement. Des tests différencient conservation sémantique et conservation textuelle : la ROM peut normaliser un listing.

CPCBasicTS est une référence d'implémentation MIT potentiellement réutilisable pour lexer, parser et codecs. Ses extensions « Unchained » et son exécution JavaScript ne deviennent pas des capacités CPC natives. Une intégration doit désactiver les extensions et comparer `LOAD`, `LIST`, `SAVE`, `RUN` sur ROM. Le codec ne sera retenu qu'après cette preuve, documentée dans une ADR.
