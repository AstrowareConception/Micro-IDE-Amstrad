# ADR 0057 — Piles d’appels dans les contextes d’erreur

- Statut : accepté
- Date : 2026-10-08
- Portée : alpha 0.40.8, REQ-EDT-008 / ACC-36, IDE-076 partiel

## Contexte

La 0.40.7 exclut GOSUB/RETURN du parcours contextuel. Relier une reprise à tous les appelants d’une routine partagée mélangerait des chemins incompatibles. Les appels du gestionnaire lui-même doivent également rester représentés.

## Décision

Étendre chaque état par une pile immuable de sites d’appel, ordonnée du plus ancien au plus récent. GOSUB et les branches sélectionnées de ON GOSUB empilent un site ; l’issue hors liste n’empile rien. RETURN dépile et suit la continuation du site. La continuation synthétique du graphe structurel n’est jamais parcourue directement pour GOSUB.

Conserver la pile courante à l’entrée dans le gestionnaire et lors de RESUME : le firmware n’ajoute pas de trame pour ON ERROR et ne supprime pas les appels du gestionnaire lors de la reprise. RETURN ne réinitialise pas l’erreur active. Ces comportements sont qualifiés avec des marqueurs et des assertions sur firmware, pas déduits d’une pile conventionnelle de langage moderne.

Fixer un budget de 16 appels imbriqués ; toute limite retire les résultats contextuels incomplets. Les plafonds d’états, transferts et transitions restent partagés avec le modèle existant. Un RETURN sans appel accessible est hors périmètre. FOR/NEXT, appels mêlés à WHILE/WEND et événements asynchrones restent exclus.

Flow passe en version 6, errorFlow en version 3. Ajouter calls aux contextes/transferts, types call/return, piles dépliables navigables et exports sans arguments. Le rapport englobant et le projet ne changent pas. Les conclusions globales ne sont pas élargies.

## Preuves et limites

[18 assertions firmware positives et deux observations négatives bornées](../implementation/basic-control-flow-alpha.md#qualification-0408), tests de domaine, vrai worker et navigation Chromium. L’exemple de deux appels à la même routine affiche 222 et deux erreurs ; les deux continuations sont conservées séparément.

La profondeur est une limite de calcul, pas un diagnostic de débordement CPC. Les conditions/valeurs ne sont pas exécutées : une récursion terminante ou un diviseur effectivement réparé peuvent encore atteindre le budget dans l’analyse. Les piles de boucles, autres erreurs implicites et qualifications externes restent ouvertes.
