# Scénarios BASIC — alpha 0.39.1

Le deuxième lot de la 0.39 ajoute une entrée clavier programmée, des fichiers texte initiaux et des observations d’écran/fichier au banc existant. REQ-EMU-010 / ACC-37, IDE-077 partiel. [Décision et limites](../adr/0048-scenarios-basic-reproductibles.md).

## Essayer un scénario complet

Ouvrir le projet [Tests des règles du jeu](../../examples/basic-test-suite/README.md), configurer les ROM CPC 6128 anglaises identifiées, puis ouvrir **BASIC → Tests BASIC à la demande…**. Choisir la suite **Clavier, fichier et écran** et lancer les tests.

Son listing charge `SEED.TXT`, reçoit « 21 » au clavier, calcule 42, écrit `RESULT.TXT`, ferme le fichier et annonce sa fin. Le rapport doit montrer une assertion native et deux observations réussies. Le budget mémorisé est de huit secondes après la commande RUN ; le temps total affiché inclut aussi le démarrage et la saisie de RUN.

Modifier seulement le contenu attendu `42` en `43` dans la déclaration `@CPCFILE` fait échouer l’observation fichier, même si l’assertion BASIC réussit. Le rapport global indique alors un échec. Retirer la déclaration de saisie laisse le programme sur INPUT : délai dépassé, sans succès inventé.

## Écrire les déclarations

Chaque directive occupe une ligne REM numérotée entière. Les chaînes utilisent les guillemets et échappements JSON : `\r` pour RETURN, `\r\n` pour la fin de ligne d’un fichier CPC. Elles restent des commentaires pour le BASIC.

```basic
20 REM @CPCTEST 1 Entree clavier et fixture
30 REM @CPCFIXTURE SEED.TXT "21\r\n"
40 REM @CPCINPUT 3000 "21\r"
50 REM @CPCFILE RESULT.TXT "42\r\n"
60 REM @CPCSCREEN bord 0 0 8 8 969b87cffdaa289fc07d61efa4d0b8d71d83ac56c4c737cd555dafdbf1cc243c
```

- **CPCINPUT** : instant en millisecondes émulées depuis la fin de la commande RUN, puis texte à saisir. Pas de 20 ms, 120 ms par touche. Les horaires sont ordonnés et sans chevauchement. Le banc ne prétend pas reconnaître qu’un INPUT est prêt : choisir le délai en conséquence.
- **CPCFIXTURE** : nom CPC majuscule 8.3, puis contenu ASCII initial. Le CTRL-Z terminal est ajouté ; les fins de ligne ne sont pas transformées. MAIN.BAS est réservé.
- **CPCFILE** : nom du fichier attendu et contenu ASCII exact, sans CTRL-Z terminal. Fermer le fichier avec CLOSEOUT avant la signature. Fichier absent, contenu différent ou format non reconnu : observation échouée. Le contenu des fichiers n’apparaît pas dans les rapports.
- **CPCSCREEN** : nom court de la zone, x, y, largeur, hauteur, puis SHA-256. Les coordonnées sont celles du cadre affiché de 768 × 272 pixels, bordure comprise, origine en haut à gauche ; ce ne sont pas les coordonnées graphiques BASIC. L’empreinte porte sur les octets RGBA, ligne par ligne, alpha 255. La référence ci-dessus correspond à la bordure noire du moteur qualifié (RGB 0, 2, 1), observée dans l’exemple.

L’assertion native et la signature de fin restent nécessaires. La machine est observée toutes les 20 ms ; il faut stabiliser l’image avant la signature et éviter d’enchaîner immédiatement sur un autre affichage. L’exemple termine par une boucle sans effet après la signature ; le banc détruit ensuite sa machine.

## Examiner l’écran attendu

Le rapport affiche l’empreinte attendue et l’empreinte observée, ainsi qu’un aperçu de la zone. **Télécharger la zone…** exporte celle-ci en PNG. Pour établir une nouvelle référence, utiliser d’abord une empreinte provisoire (64 zéros), examiner l’échec et l’image obtenue, puis copier l’empreinte observée uniquement si l’image correspond bien au résultat voulu. Relancer ensuite le scénario. Cette démarche ne remplace pas la conception d’un résultat attendu pertinent.

Les aperçus restent dans la session courante. L’historique et les exports gardent seulement les résultats et empreintes. La navigation rejoint la déclaration de chaque observation et se désactive lorsque le rapport est obsolète.

## Bornes et qualification

Huit saisies/64 touches au total (ASCII imprimable et RETURN), quatre fixtures/4 Kio au total, huit observations. Chaque contenu texte est limité à 2 Kio ; les limites normales de longueur des lignes BASIC s’appliquent aussi. Un rectangle contient au maximum 16 384 pixels. Aucun fichier binaire, clavier interactif, import de disque arbitraire, OCR, couverture ou comparaison tolérante n’est ajouté.

Les recettes exécutent le scénario deux fois pour comparer empreintes et temps émulé, provoquent des échecs fichier/écran, une attente sans saisie et une fin prématurée. La recette navigateur emploie le vrai worker/WASM/firmware, vérifie l’affichage des observations, l’export JSON et le téléchargement PNG. Les tests du domaine couvrent les limites, l’isolement des fixtures et la cohérence des verdicts et rapports. Les suites et rapports de la 0.39.0 restent compatibles.
