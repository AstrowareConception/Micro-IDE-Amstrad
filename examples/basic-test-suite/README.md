# Tests des règles du jeu

Ouvrir ce dossier comme projet dans CPCéleste 0.39 ou ultérieur. Dans **BASIC → Tests BASIC à la demande…**, choisir la suite **Règles du jeu**, puis exécuter tous ses listings ou seulement Score/Collision. Configurer au préalable les ROM locales CPC 6128 anglaises identifiées.

Les deux programmes sont autonomes et déclarent chacun deux assertions : ajout de score/bonus nul, rectangles en contact/séparés. Résultat attendu : quatre assertions réussies. Pour observer un échec, remplacer `score=150` par `score=151` dans le test de score et relancer. Le précédent rapport devient obsolète dès la modification.

Les routines du jeu sont incluses dans chaque listing de test ; la suite ne fusionne pas les sources et n’injecte pas les autres fichiers. Le budget enregistré est de trois secondes émulées par listing après RUN. Aucun accès IA nécessaire. [Guide et limites](../../docs/implementation/basic-test-suites-alpha.md).
