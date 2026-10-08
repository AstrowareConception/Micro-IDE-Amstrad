# ADR 0050 — Branches BASIC qualifiées sur firmware

Statut : acceptée pour la tranche 0.40.1. Date : 8 octobre 2026. Complète les [ADR 0041](0041-analyse-basic-worker-monitoring.md) et [0049](0049-graphe-basic-conservateur.md), corrige l’hypothèse lexicale des cibles collées.

## Décision

Partager une fonction pure d’association ELSE entre inspection syntaxique et graphe. Chaque ELSE ferme le IF encore ouvert le plus proche ; les chaînes ELSE IF sont inspectées récursivement, dans une limite explicite de 16 niveaux. Les tokens de chaînes, DATA et commentaires ne participent pas à cette association. Les deux-points conservent la portée de branche jusqu’à la fin de ligne.

Développer NEXT j,i en deux nœuds localisés, dans l’ordre du texte, avec appariement structuré à la pile FOR. Garder une seule décision normalisée par FOR. Restreindre ce cas à des bornes/pas entiers décimaux littéraux de valeur absolue ≤ 32767 garantissant l’entrée initiale, avec STEP non nul ou implicite +1. Sinon, conserver un graphe partiel et suspendre complexité/inaccessibilité. La recherche de NEXT lors du saut initial d’une boucle imbriquée reste à qualifier.

Préserver les mots GOTO100, GOSUB100, THEN100 et ELSE100 comme identifiants. Ne plus y inventer de référence de ligne, de saut ni de remplacement numérique. Un tel identifiant peut être une variable valide ; son emploi comme instruction GOTO/GOSUB sans affectation reçoit un diagnostic. La renumérotation conserve son refus prudent des identifiants de cette forme. Aucune insertion d’espace ni correction automatique n’est effectuée.

## Preuves et conséquences

Les 37 nouvelles assertions de `basic-test-runtime-smoke.mjs` exercent le firmware BASIC 1.1 du jeu CPC 6128 anglais identifié : tables de vérité imbriquées, ELSE IF, branches sans ELSE externe, cibles et retours, NEXT multiples, exemple, comparaison des formes collées/espacées et variables aux noms ressemblant à des commandes. Les observations priment sur une description documentaire contraire ; aucun autre firmware n’est qualifié implicitement. [Détails, exemple et limites](../implementation/basic-control-flow-alpha.md#qualification-0401).

Les tests purs contrôlent structure, colonnes, syntaxe, bornes et refus conservateurs. Le parcours Chromium traverse le worker réel, l’export et la navigation du deuxième NEXT, puis vérifie le passage en analyse partielle pour une borne variable. Aucun nouveau calcul continu de graphe, dépendance, workflow ou format persistant n’est ajouté. IDE-076/J2 restent partiels ; événements, pile GOSUB contextuelle et analyse de variables suivent.
