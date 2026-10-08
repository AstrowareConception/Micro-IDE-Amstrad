# Explorer le flux d’un listing BASIC

Ouvrir [main.bas](main.bas) dans CPCéleste 0.40.4, puis **BASIC → Rapport de qualité BASIC… → Générer le rapport** et déplier **Flux BASIC**.

Le programme additionne 1, 2 et 3 dans la sous-routine 200, affiche le total via 300, puis le ramène à 3 dans une boucle WHILE. Le graphe conserve aussi les autres issues structurelles, sans évaluer les conditions.

Résultats attendus : complexité locale 6 pour le début, 1 pour chacune des entrées 200 et 300, deux relations d’appel et deux cycles. La ligne 90 ne possède aucun chemin depuis le début ; sa présence est volontaire pour la démonstration. Sélectionner le IF de la ligne 60 pour explorer ses deux branches.

L’analyse ne demande ni ROM, ni clé API. F5 demande les ROM habituelles. [Modèle, limites et qualification](../../docs/implementation/basic-control-flow-alpha.md).

## Branches imbriquées

Ouvrir [nested.bas](nested.bas) pour explorer IF imbriqués, ELSE IF et NEXT j,i. Le programme affiche **21** ; l’entrée principale a une complexité structurelle de **6** (trois IF et deux FOR). Sélectionner chaque IF de la ligne 40 pour comparer ses branches, puis les deux fermetures de la ligne 50. Remplacer la borne du FOR interne j par une variable rend ce NEXT multiple partiel ; l’outil explique pourquoi et suspend sa complexité.

## Boucles dans une branche

Ouvrir [conditional-loops.bas](conditional-loops.bas). Le total affiché est **15** ; le rapport indique une complexité structurelle de **9** et quatre composantes cycliques. La boucle externe de la ligne 30 peut être sautée malgré NEXT j,i. Les boucles des lignes 40, 50 et 60 restent dans leur branche THEN ou ELSE, sans réévaluer le IF à chaque tour. Sélectionner le FOR de la ligne 40 : son issue Faux rejoint la ligne 50 et évite le ELSE de la ligne 40. Un FOR dans THEN fermé par un NEXT dans ELSE reste explicitement partiel.

## Retours de sous-routines

Ouvrir [returns.bas](returns.bas) : total affiché **6**, récursion mutuelle 100/200 avec RETURN possible. GOSUB 300 termine par END : sa continuation est retirée et les lignes 50/60 n’ont pas de chemin depuis le début. Le tableau distingue chemin possible, absent ou indéterminé ; il ne certifie pas que les conditions d’un chemin seront réalisées. Retirer le cas de base de la ligne 100 fait disparaître le chemin fini de retour des deux routines.

## Erreurs et événements

Ouvrir [events.bas](events.bas) : AFTER déclenche une fois la routine 200 ; l’erreur volontaire 5 à la ligne 60 passe par 300 puis RESUME NEXT rejoint l’instruction suivante de la même ligne. Résultat : **Minuteur 1 Suite 1**. Le rapport recense trois opérations événementielles, dont ON ERROR GOTO 0. Déplier **Erreurs et événements**, rejoindre les cibles et explorer les associations en pointillés. Elles décrivent les déclarations, pas des sauts immédiats ; le rapport reste partiel, sans complexité ni verdict d’inaccessibilité.
