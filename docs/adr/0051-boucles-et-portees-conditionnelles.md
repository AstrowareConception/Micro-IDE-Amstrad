# ADR 0051 — Boucles et portées conditionnelles

Statut : acceptée pour la tranche 0.40.2. Date : 8 octobre 2026. Complète l’[ADR 0050](0050-branches-basic-qualifiees.md).

## Décision

Attribuer une identité interne distincte à chaque branche THEN et ELSE pendant la construction du graphe, indépendamment de sa profondeur. Autoriser les boucles FOR/NEXT et WHILE/WEND dont ouverture et fermeture appartiennent à la même branche et s’apparient structurellement. Une branche se termine sur sa ligne ; un appariement vers l’extérieur, une autre branche ou un autre IF rend le listing partiel. Les identités ne sont ni persistées ni exportées.

Conserver le test normalisé en tête : le retour d’une boucle reste dans cette boucle, sans réévaluer le IF englobant. La sortie rejoint la continuation de sa branche. Les branches alternatives gardent des boucles séparées, même si elles emploient le même nom de variable.

Distinguer la dernière variable d’une liste NEXT de ses fermetures intermédiaires. La dernière peut correspondre à un FOR dont les bornes/pas sont variables ou dont le corps est sauté ; sa sortie rejoint l’instruction après la liste. Pour les fermetures intermédiaires, conserver l’exigence de bornes entières littérales garantissant l’entrée. Un essai sans signature de fin n’autorise ni un modèle inventé du firmware ni une conclusion de boucle infinie.

## Preuves et conséquences

Vingt-cinq assertions natives exercent les continuations sautées, NEXT séparés/multiples, pas négatifs, bornes variables et boucles dans THEN/ELSE ; une autre vérifie l’exemple affichant 15. Qualification limitée au BASIC 1.1 du jeu CPC 6128 anglais identifié. [Guide, résultats et limites](../implementation/basic-control-flow-alpha.md#qualification-0402).

Les tests purs contrôlent les liaisons, les identités de branche et les refus ; le parcours Chromium contrôle le vrai worker, l’export et la navigation. La complexité reste structurelle, sans évaluation des conditions, simulation de pile ni preuve de terminaison. Pas de nouveau champ DTO, dépendance, calcul continu ou workflow. IDE-076/J2 restent partiels ; résumés des retours GOSUB, erreurs et événements sont les prochains sujets.
