# Tests des règles du jeu

Ouvrir ce dossier comme projet dans CPCéleste 0.39 ou ultérieur. Dans **BASIC → Tests BASIC à la demande…**, choisir la suite **Règles du jeu**, puis exécuter tous ses listings ou seulement Score/Collision. Configurer au préalable les ROM locales CPC 6128 anglaises identifiées.

Les deux programmes sont autonomes et déclarent chacun deux assertions : ajout de score/bonus nul, rectangles en contact/séparés. Résultat attendu : quatre assertions réussies. Pour observer un échec, remplacer `score=150` par `score=151` dans le test de score et relancer. Le précédent rapport devient obsolète dès la modification.

Les routines du jeu sont incluses dans chaque listing de test ; la suite ne fusionne pas les sources et n’injecte pas les autres fichiers. Le budget enregistré est de trois secondes émulées par listing après RUN. Aucun accès IA nécessaire. [Guide et limites](../../docs/implementation/basic-test-suites-alpha.md).

## Scénario interactif — 0.39.1

La suite **Clavier, fichier et écran** lance `tests-scenario.bas` avec un budget de huit secondes. Un fichier SEED.TXT contenant 21 est injecté dans son disque isolé ; la saisie de « 21 » puis RETURN est programmée à 3 000 ms. Le programme doit écrire exactement `42` suivi de CR/LF dans RESULT.TXT et conserver une bordure noire. Une assertion native et deux observations sont attendues réussies. L’aperçu de la zone écran peut être téléchargé en PNG. Aucun fichier hôte n’est créé par ce BASIC.

Changer `42` en `43` uniquement dans la déclaration `@CPCFILE` illustre un échec d’observation ; supprimer `@CPCINPUT` illustre une attente qui atteint le budget. [Syntaxe, limites et références visuelles](../../docs/implementation/basic-scenarios-alpha.md).
