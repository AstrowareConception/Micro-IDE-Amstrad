# Découpage avec boucles simples — alpha 0.41.28

Le profil `terminal-loops-chain-merge-v4` ajoute FOR/NEXT et WHILE/WEND au découpage terminal. Les profils [v2 pour expressions](basic-multifile-expressions-alpha.md) et [v3 pour conditions](basic-multifile-conditions-alpha.md) conservent leur identité, ainsi que le profil initial v1. L’application et la restauration utilisent toujours le [journal durable](basic-multifile-apply-alpha.md).

## Formes admises

| Structure | Contrat du premier profil de boucles |
| --- | --- |
| FOR | `FOR index%=début TO fin [STEP pas]` ; début, fin et pas sont des littéraux entiers signés dans −32768..32767 ; pas non nul, 1 par défaut |
| NEXT | `NEXT index%`, exactement le compteur du FOR, sans liste ni nom omis |
| WHILE | `WHILE index% comparateur borne` ; compteur `%` initialisé, comparateur `<`, `<=`, `>` ou `>=`, borne entière littérale signée |
| Mise à jour WHILE | Dernière instruction avant WEND : `index%=index%+n` ou `index%=index%-n`, LET facultatif, n entier littéral strictement positif ; pas dirigé vers la sortie |
| WEND | Seul sur sa ligne, apparié au WHILE |
| Corps | Instructions séquentielles v2 : affectations `%`/`$`, PRINT, MODE, CLS et POKE témoin ; une instruction par ligne |

Le compteur FOR ne peut pas être affecté dans son corps. Celui du WHILE ne peut l’être qu’à sa mise à jour finale. Les boucles imbriquées, IF dans le corps, sorties anticipées, sauts, séparateurs `:`, bornes/pas dynamiques et formes opaques sont refusés. Des IF simples restent possibles **avant ou après** les boucles ; leurs deux issues sont contrôlées comme en v3.

Une boucle doit rester entièrement du même côté de la frontière de découpage. Un FOR ou WHILE dans MAIN dont la fermeture se trouverait dans PART est refusé : aucune pile de boucle active ne traverse le CHAIN MERGE. Le listing garde son GOTO terminal littéral et son END final ; toutes les lignes de boucle sont conservées à l’identique.

## Contrôles et budgets

Le validateur suit chaque tour avec les valeurs entières et chaînes du profil v2. Il contrôle les types, initialisations, résultats intermédiaires, longueurs des chaînes, octets POKE et compteur après sortie, y compris le dernier incrément du FOR. Il refuse notamment un dépassement qui n’apparaît qu’au deuxième ou troisième tour.

Une boucle sautée conserve l’état réel avant son corps, avec le compteur initialisé par FOR le cas échéant. Son corps est néanmoins contrôlé une fois sur une copie jetée : les formes opaques et erreurs de bornes y sont refusées, mais ses affectations ne peuvent pas justifier une lecture ultérieure. Ce choix conservateur peut refuser du code valide dont un corps est inexécuté.

Les limites sont **quatre boucles**, **32 tours par boucle et par état** et **8192 visites d’instructions cumulées, tous états confondus**. Ce dernier budget compte les instructions ordinaires, les IF et les instructions de corps, y compris le contrôle jeté d’un corps sauté. Les IF hors boucle restent limités à six, donc 64 états conservateurs. Les quotas de source v2/v3 restent inchangés : 4096 caractères, 40 lignes, 255 caractères par ligne, 20 lignes dans le suffixe, 96 jetons par instruction et 16 niveaux par expression.

## Exemple et parcours

```basic
10 MEMORY &7FFF
20 MODE 1
30 total%=0
40 FOR index%=1 TO 3
50 total%=total%+index%
60 NEXT index%
90 GOTO 100
100 index%=3
110 WHILE index%>0
120 total%=total%+index%
130 index%=index%-1
140 WEND
150 PRINT "TOTAL ";total%
160 POKE &8001,total%
170 END
```

L’extraction à partir de 100 ferme le FOR dans MAIN et place le WHILE entier dans PART. Les valeurs partagées passent par le chargement ; aucune continuation de boucle n’en dépend. L’aperçu indique « Boucles bornées — FOR/NEXT et WHILE/WEND ».

Les références utilisées, notamment FOR/NEXT et WHILE/WEND, doivent être consultées avant l’application. Les fiches éditoriales WHILE/WEND ont été ajoutées depuis les lignes 310–313 du corpus fourni ; leurs originaux restent inchangés. L’instruction modèle et la description de l’outil précisent ce périmètre. Même plan immuable, SHA source, révision et journal que les tranches précédentes. Après réouverture, **Projet → Rétablir la dernière modification IA…** restaure les octets d’origine, le manifeste et la liste des sources.

## Témoins CPC

Chaque témoin utilise un projet réel : application par l’outil agent, fermeture logique du store, réouverture, restauration durable puis nouvelle réouverture. Les trois DSK sont construits depuis ces fichiers et exécutés sur les ROM CPC 6128 identifiées par SHA-256. Les témoins numériques répètent une boucle fermée avant et après la frontière ; ils observent la somme avant/après, le compteur final décalé de 20 et un marqueur de fin.

| Famille | Parcours | RAM &8000..&8003 attendue |
| --- | --- | --- |
| FOR croissant | Zéro tour : 2 TO 1 | `[0,0,22,205]` |
| FOR croissant | Un tour : 3 TO 3 | `[3,6,24,205]` |
| FOR croissant | Trois tours : 1 TO 5 STEP 2 | `[9,18,27,205]` |
| FOR décroissant | Zéro tour : 1 TO 2 STEP -1 | `[0,0,21,205]` |
| FOR décroissant | Un tour : 3 TO 3 STEP -2 | `[3,6,21,205]` |
| FOR décroissant | Trois tours : 5 TO 1 STEP -2 | `[9,18,19,205]` |
| WHILE croissant | Zéro tour : 3 < 3 | `[0,0,23,206]` |
| WHILE croissant | Un tour : 2 < 3, pas +1 | `[2,4,23,206]` |
| WHILE croissant | Trois tours : 1 <= 5, pas +2 | `[9,18,27,206]` |
| WHILE décroissant | Zéro tour : 1 > 1 | `[0,0,21,206]` |
| WHILE décroissant | Un tour : 2 > 1, pas -1 | `[2,4,21,206]` |
| WHILE décroissant | Trois tours : 5 >= 1, pas -2 | `[9,18,19,206]` |
| FOR puis WHILE, conditions hors corps, chaînes et PRINT | Variante fausse / vraie | `[3,0,5,207]` / `[3,0,6,207]` |

**Quatorze témoins et deux références littérales d’affichage : 44 exécutions CPC réussies localement.** Les deux références écran sont écrites indépendamment avec le texte et les valeurs attendus ; la comparaison porte sur la première ligne vidéo, hors Ready et curseur. Les recettes vérifient aussi la restitution exacte des sources CRLF et du manifeste, la disparition de PART et l’identité du DSK restauré.

```sh
CPC_TEST_ROM_DIR=/chemin/roms node scripts/qualify-basic-multifile-expressions.mjs --loops
```

Le banc partagé conserve un rapport distinct `out/basic-multifile-loops-qualification.json`, avec empreintes et résultats, sans ROM. La CI ajoute cette recette bloquante et `tests/multifile-desktop-smoke.mjs --loops` aux parcours v1/v2/v3 : application, fermeture complète d’Electron, réouverture, annulation, protection du brouillon et restauration exacte. Vérifier le résultat natif sur le SHA exact de la PR avant fusion.

## Portée et suite

Les tests négatifs couvrent les frontières de fichiers, fermetures incompatibles, compteurs modifiés, bornes dynamiques, pas nul ou de mauvais sens, imbrications, corps sautés, dépassements différés et budgets. Les observations ROM ne prouvent pas tous les programmes admis, la mémoire libre, le timing, du matériel ou un émulateur indépendant. Aucun packaging par commit.

La suite prioritaire est une mission complète de lisibilité sur des programmes représentatifs : enchaîner renommage, commentaires, mise en forme, découpage admissible et tests avant/après. Les blocages observés guideront l’élargissement ultérieur, notamment les conditions dans les boucles et les imbrications.
