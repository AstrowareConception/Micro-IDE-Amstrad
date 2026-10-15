# ADR 0072 — Navigation des symboles au curseur

- Date : 2026-10-15
- Statut : accepté pour 0.41.13
- Périmètre : IDE-015 partiel, IDE-017 non réalisé

## Décision

Utiliser l’index Symboles/FN existant pour deux commandes explicites au curseur : usages et déclarations/affectations possibles. F12 conserve les cibles numériques BASIC puis ouvre les déclarations possibles sur un nom ; Maj+F12, le menu BASIC, la palette et le contexte ouvrent les usages. Aucun calcul supplémentaire sur déplacement de curseur ou frappe, ni fournisseur Monaco global prétendant résoudre une définition certaine.

Le domaine `symbol-navigation.ts` reçoit un index d’une seule source et des coordonnées physiques (ligne 1-based, colonne UTF-16 0-based, borne finale exclue). La résolution s’exécute dans le worker Symboles. Elle retourne des positions, libellés, limites et possibilités, jamais du code ou des valeurs. Les positions sont triées/dédupliquées, 200 cibles affichées au plus avec total exact. Les budgets de l’index et son retrait complet sur dépassement restent applicables.

Les variables sont rapprochées textuellement par nom/suffixe et nature scalaire/tableau, y compris les lectures FN libres couvertes. Les paramètres restent locaux à leur définition ; les liens ambigus restent possibles. Les appels FN utilisent les candidats déjà qualifiés par l’index, sans déduire de définition active ni d’arité valide. Depuis un appel, les usages peuvent partager plusieurs candidats et ne forment pas une identité sémantique. Les appels sans candidat ne sont pas regroupés par nom. Pour une variable, « déclarations » signifie affectations ou dimensions possibles, sans preuve d’initialisation.

## Cycle de vie et interface

La commande capture le texte exact, l’identifiant de source, la session projet, les coordonnées et un nonce. Le panneau refuse une demande dont le texte a déjà changé, puis réutilise le worker jetable, l’annulation, le contrôle de séquence et le délai de 15 secondes. Une réponse après modification produit un snapshot obsolète non navigable. Un changement de projet arrête le worker et ne rejoue pas la demande. La garde au clic compare à nouveau texte, nom et session.

Les résultats vivent dans un troisième onglet du panneau Symboles, avec source, position initiale, message en cas d’absence, nombre de cibles et liens accessibles. Aucune navigation automatique même avec une seule cible. Actualiser l’index revient aux vues générales ; relancer une commande recrée la recherche. Le contrat d’export SymbolReport 3 et les outils agent restent inchangés.

## Preuves et suite

Tests de domaine : identités locales/libres, homonymes, suffixes, types ambigus, redéfinitions, exclusions, UTF-16/CRLF, bornes et source incorrecte. Parcours Chromium : raccourcis et menu, F12 numérique conservé, navigation exacte, plusieurs déclarations possibles, worker réel, absence d’indexation implicite, résultats périmés, réponse remplacée et session projet remplacée. Guide illustré et roadmaps mis à jour.

Cette lecture prépare le renommage ; elle ne l’autorise pas. Résolution supplémentaire, collisions, prévisualisation, révisions et undo restent nécessaires avant mutation sémantique.
