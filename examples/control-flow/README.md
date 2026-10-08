# Explorer le flux d’un listing BASIC

Ouvrir [main.bas](main.bas) dans CPCéleste 0.40.0, puis **BASIC → Rapport de qualité BASIC… → Générer le rapport** et déplier **Flux BASIC**.

Le programme additionne 1, 2 et 3 dans la sous-routine 200, affiche le total via 300, puis le ramène à 3 dans une boucle WHILE. Le graphe conserve aussi les autres issues structurelles, sans évaluer les conditions.

Résultats attendus : complexité locale 6 pour le début, 1 pour chacune des entrées 200 et 300, deux relations d’appel et deux cycles. La ligne 90 ne possède aucun chemin depuis le début ; sa présence est volontaire pour la démonstration. Sélectionner le IF de la ligne 60 pour explorer ses deux branches.

L’analyse ne demande ni ROM, ni clé API. F5 demande les ROM habituelles. [Modèle, limites et qualification](../../docs/implementation/basic-control-flow-alpha.md).
