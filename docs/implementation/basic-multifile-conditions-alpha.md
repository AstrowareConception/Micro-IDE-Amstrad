# Découpage avec conditions simples — alpha 0.41.27

**Suite 0.41.28 :** les [boucles simples](basic-multifile-loops-alpha.md) disposent d’un profil v4 distinct. Les conditions v3 décrites ci-dessous conservent leur contrat.

Le profil `terminal-conditions-chain-merge-v3` ajoute les conditions simples au [profil expressions v2](basic-multifile-expressions-alpha.md). Les profils v1/v2 gardent leur identité. Le parcours d’application journalisée, de réouverture et de restauration durable reste celui de la [0.41.25](basic-multifile-apply-alpha.md).

## Grammaire et contrôles

Une condition occupe une seule ligne : `IF expression comparateur expression THEN instruction [ELSE instruction]`. Les comparateurs admis sont `=`, `<>`, `<`, `<=`, `>` et `>=`, écrits sans espace à l’intérieur du comparateur. Les deux expressions doivent être de même type : entiers ou chaînes ASCII imprimables. Elles utilisent la grammaire bornée v2 ; les parenthèses entourent les expressions arithmétiques, pas la comparaison entière. Un entier employé seul comme condition, AND/OR/NOT et les comparaisons en chaîne restent refusés.

Chaque branche contient exactement une instruction : affectation scalaire `%`/`$`, avec LET facultatif, PRINT, MODE 0..2, CLS ou POKE témoin. MEMORY &7FFF reste uniquement en tête du listing. Les IF imbriqués, numéros après THEN, sauts conditionnels, END anticipé, séparateurs `:`, boucles, fonctions, DATA et accès dynamiques restent exclus. Les mots THEN/ELSE/IF dans une chaîne ne sont pas des délimiteurs.

Le validateur propage **les deux issues de chaque IF**, sans éliminer une branche constante. Sans ELSE, il conserve aussi l’état d’entrée. Il poursuit les contrôles sur chaque état jusqu’à la fin : une variable lue doit avoir été initialisée sur tous les chemins conservés ; types, bornes entières, longueur des chaînes et octets POKE sont contrôlés sur chacun. Cela peut refuser un programme dont certaines combinaisons sont impossibles en exécution. C’est une restriction volontaire, pas une preuve d’atteignabilité.

La limite est de **six IF, donc 64 chemins conservateurs maximum**. Les quotas v2 restent valables : 4096 caractères, 40 lignes, 255 caractères par ligne, 20 lignes dans le suffixe, 96 jetons par ligne et 16 niveaux dans une expression. Le listing conserve un unique GOTO terminal littéral vers le suffixe à extraire, terminé par END. Le découpage préserve les lignes et remplace uniquement ce GOTO par CHAIN MERGE.

## Exemple

```basic
10 MEMORY &7FFF
20 score%=7
30 MODE 1
40 IF score%>=5 THEN title$="GAGNE" ELSE title$="PERDU"
50 GOTO 100
100 IF score%<10 THEN score%=score%+1
110 PRINT title$;" ";score%
120 POKE &8001,score%
130 END
```

Demander à l’agent d’extraire le suffixe à partir de 100 vers PART, puis d’appliquer, construire et tester. Le panneau indique le profil « Conditions simples — deux branches contrôlées ». La fiche IF, ainsi que les autres commandes utilisées, doit avoir été consultée avant application. Le même plan immuable, SHA source et contrôle de révision protègent la transaction. Après fermeture et réouverture, **Projet → Rétablir la dernière modification IA…** retrouve les octets d’origine, le manifeste et la liste des sources.

## Matrice CPC

La recette utilise de vrais projets persistés via l’outil agent, puis rouverts et restaurés. Pour chaque témoin, elle exécute trois DSK construits depuis ces états réels. Les comparateurs sont placés de part et d’autre de la frontière : `=`, `<>`, `<` avant ; `<=`, `>`, `>=` après. Trois valeurs d’entrée donnent une issue vraie et une issue fausse pour chacun, sur entiers puis sur chaînes.

| Témoins | Entrées comparées | RAM attendue à &8000..&8003 |
| --- | --- | --- |
| Entier inférieur / chaîne inférieure | 1 contre 2 / A contre B | `[6,1,14,203]` |
| Entier égal / chaîne égale | 2 contre 2 / B contre B | `[1,5,41,203]` |
| Entier supérieur / chaîne supérieure | 3 contre 2 / C contre B | `[2,6,50,203]` |
| Condition fausse, ELSE absent et affichage | flag%=0 ; CLS ; texte F FALSE ; score 40 | `[12,40,24,204]` |
| Condition vraie, ELSE absent et affichage | flag%=1 ; MODE 2 ; texte T THEN ELSE ; score 47 | `[11,47,24,204]` |

Les deux derniers témoins vérifient l’affectation conditionnelle, le chemin sans ELSE, POKE dans une branche, l’effacement et le changement de mode, PRINT dans les deux branches, ainsi que des mots-clés dans une chaîne. Deux programmes littéraux indépendants donnent les références de mémoire vidéo, hors prompt Ready et curseur. Les six autres encodent les résultats des comparaisons en masques RAM, avec un marqueur de fin distinct.

**Huit témoins, 24 exécutions de projets et deux références d’affichage : 26 exécutions CPC réussies localement** sur les ROM CPC 6128 identifiées par SHA-256. La recette vérifie également la restauration exacte des sources CRLF et du manifeste, la disparition de PART et l’identité du DSK restauré. Elle partage le banc v2, avec rapports distincts :

```sh
CPC_TEST_ROM_DIR=/chemin/roms node scripts/qualify-basic-multifile-expressions.mjs --conditions
```

Le rapport `out/basic-multifile-conditions-qualification.json` contient les empreintes, résultats et verdicts, sans ROM. La CI conserve la recette bloquante et ajoute `tests/multifile-desktop-smoke.mjs --conditions` aux parcours v1/v2 : mission contrôlée, aperçu, application, fermeture complète, réouverture, annulation, garde du brouillon et restauration exacte. Les résultats natifs sont à vérifier sur le SHA exact de la PR avant fusion.

## Portée

La syntaxe part de la fiche IF et du corpus importé, notamment `knowledge/locomotive-basic/originals/command-reference.txt` ; le comportement admis est confronté aux témoins sur ROM. Aucun original n’est modifié. Ces observations ne prouvent ni l’équivalence de tout programme accepté, ni l’identité de mémoire libre ou de timing, ni une compatibilité matérielle ou un émulateur indépendant. Les programmes utilisateur doivent encore être exécutés et comparés. Prochaine tranche : qualifier des boucles simples avec témoins discriminants avant d’élargir le profil.
