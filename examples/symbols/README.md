# Variables et usages — exemple 0.41

Ouvrir [main.bas](main.bas), puis **BASIC → Symboles et usages BASIC… → Actualiser l’index**. Six entrées apparaissent : JOUEUR, MESSAGE$, SCORES (tableau), TOTAL, TOTAL% et TOTAL!.

Choisir SCORES pour voir son dimensionnement, son écriture et sa lecture. Choisir JOUEUR pour naviguer entre le FOR, les indices, le calcul et le NEXT. Les cinq occurrences sont textuelles, indépendamment du nombre de tours de boucle. Le contenu DATA et les chaînes ne créent pas de faux usages.

L’exécution qualifiée sur CPC 6128 anglais affiche **Total 60**. TOTAL et TOTAL! restent deux entrées textuelles dans l’index, même s’ils désignent ici la même variable réelle à l’exécution. Modifier le code désactive les liens jusqu’à l’actualisation. [Périmètre et limites](../../docs/implementation/basic-symbols-alpha.md).
