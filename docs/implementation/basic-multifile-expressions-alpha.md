# Découpage avec expressions et affichage — alpha 0.41.26

**Suite 0.41.27 :** les [conditions simples](basic-multifile-conditions-alpha.md) disposent d’un profil v3 distinct. Le contrat v2 décrit ci-dessous reste inchangé.

Le découpage terminal accepte désormais des calculs entiers, des chaînes et de l’affichage. Il conserve le parcours livré en [0.41.25](basic-multifile-apply-alpha.md) : aperçu exact, application journalisée, réouverture, construction du DSK et restauration durable depuis le menu Projet. Un programme déjà accepté par le profil initial conserve son identifiant `terminal-goto-chain-merge-v1`. Les formes supplémentaires relèvent du profil distinct `terminal-expressions-chain-merge-v2`.

## Ce que le profil v2 accepte

La structure reste un seul listing autonome, sans ressources, avec un unique GOTO littéral immédiatement avant le suffixe terminal à extraire. Ce suffixe finit par END. Les limites restent 4096 caractères, 40 lignes, 255 caractères par ligne et 20 lignes dans le suffixe. Les lignes originales sont conservées à l’identique ; seul le GOTO devient CHAIN MERGE.

| Forme | Conditions contrôlées |
| --- | --- |
| Affectation, avec ou sans LET | Scalaire explicitement typé `%` ou `$`, nom de 1 à 40 caractères hors mots réservés/préfixe FN ; casse ignorée |
| Expressions numériques | Littéraux décimaux de 0 à 32767, scalaires `%` déjà affectés, signes unaires, `+`, `-`, `*` et parenthèses ; priorité de la multiplication |
| Bornes numériques | Chaque résultat intermédiaire et final doit rester entier dans −32768..32767 ; aucune conversion implicite |
| Chaînes | Littéraux ASCII imprimables fermés, scalaires `$` déjà affectés, concaténation `+` ; 255 caractères maximum par résultat |
| PRINT | Ligne vide ou expressions séparées par des points-virgules ; point-virgule final permis ; sortie écran par défaut |
| MODE et CLS | MODE littéral 0, 1 ou 2 ; CLS sans argument, avant ou après la frontière |
| POKE témoin | Adresse littérale `&8000` à `&8003`, expression entière de 0 à 255 ; MEMORY &7FFF obligatoirement en première instruction |

La validation consomme l’intégralité de chaque expression et suit les affectations dans l’ordre du chemin séquentiel. Les nombres ne sont pas évalués par du code JavaScript fourni par le programme. Le petit interpréteur de validation ne connaît que les opérations ci-dessus, avec 96 jetons maximum par ligne et 16 niveaux d’imbrication. Il ne prédit ni la mémoire libre ni les durées sur CPC.

Le profil initial reste inchangé : ses affectations littérales peuvent encore employer les noms numériques implicites admis en 0.41.24. Leurs anciennes permissions ne s’étendent pas aux nouvelles expressions. Dans un programme v2, écrire `score%`, et non `score` ou `score!`.

## Exemple et parcours

```basic
10 MEMORY &7FFF
20 MODE 1
30 title$="CPC"+" IDE"
40 score%=6*7
50 GOTO 100
100 PRINT title$;" ";score%
110 score%=score%+8
120 POKE &8001,score%
130 END
```

Demander à l’agent de prévisualiser l’extraction à partir de la ligne 100 vers PART, de l’appliquer puis de reconstruire et tester le projet. L’aperçu affiche son profil et les contrôles réalisés. Les références réellement utilisées doivent être consultées avant application, notamment PRINT/MODE/CLS/LET lorsqu’elles sont présentes. Une tentative sans ces références ne consomme pas le plan et ne modifie pas le disque.

Après réouverture, **Projet → Rétablir la dernière modification IA…** restitue les octets antérieurs, le manifeste et la liste des sources. Les protections contre les brouillons, les conflits externes et les interruptions restent celles de la 0.41.25.

## Témoins et preuves

`scripts/qualify-basic-multifile-expressions.mjs` utilise de vrais projets et le même outil d’application que l’agent. Pour chaque témoin, il construit et exécute les DSK du projet initial, appliqué/réouvert et restauré/réouvert. Il vérifie aussi les octets CRLF, le manifeste et le retrait du fichier créé.

| Témoin | Résultat RAM attendu | Affichage vérifié |
| --- | --- | --- |
| Priorités, parenthèses, négation et scalaires partagés | `[34,69,12,201]` | Aucun verdict écran |
| Chaînes et PRINT en mode 0 | `[11,50,24,202]` | Deux lignes avant/après chargement |
| Chaînes et PRINT en mode 1 | `[11,50,24,202]` | Deux lignes avant/après chargement |
| Passage du mode 1 au mode 2 dans le module, puis CLS | `[11,50,24,202]` | Une ligne après effacement |

Les trois témoins d’affichage sont confrontés à trois programmes de référence écrits avec les valeurs littérales attendues. Les premières lignes de mémoire vidéo sont comparées, en excluant le prompt Ready et le curseur clignotant. Cela représente **quinze exécutions CPC** : douze variantes de projets et trois références d’affichage. Toutes ont réussi localement sur les ROM CPC 6128 identifiées par SHA-256. Le rapport JSON contient empreintes, valeurs observées et verdicts, sans ROM.

La CI Linux conserve cette recette bloquante et son rapport. Le test Electron existant s’exécute aussi avec le témoin v2 en mode 1 : application réelle, aperçu, fermeture complète, réouverture, annulation, garde du brouillon et restauration. Le parcours v1 reste exécuté. Vérifier les résultats de la PR sur son SHA exact avant d’annoncer sa qualification native.

## Limites et suite

Restent refusés en v2 : réels et divisions, puissances, opérateurs logiques, fonctions, tableaux, variables non initialisées ou implicitement typées, IF/ELSE, boucles, GOSUB/RETURN, DATA, commentaires, instructions multiples par ligne, flux PRINT #, virgules, USING, entrées clavier, timers, accès mémoire dynamiques et projets déjà multifichiers. Les signes ou mots-clés à l’intérieur d’une chaîne imprimable ne sont pas interprétés comme des instructions.

Les comparaisons qualifient ces témoins sur le moteur et les ROM identifiés ; elles ne prouvent pas une équivalence universelle, des timings identiques ou une exécution sur CPC physique. La prochaine extension doit traiter les conditions simples et leurs différents chemins avec des témoins discriminants, avant les boucles et les états plus complexes. Les anciens rapports restent historiques.
