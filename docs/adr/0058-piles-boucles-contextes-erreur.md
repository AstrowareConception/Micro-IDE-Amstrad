# ADR 0058 — Piles de boucles dans les contextes d’erreur

- Date : 2026-10-08
- Statut : accepté pour l’alpha 0.40.9
- Suite de : [ADR 0057](0057-piles-appels-contextes-erreur.md)

## Contexte

La pile d’appels de la 0.40.8 ne distingue pas les boucles ouvertes avant ou après un GOSUB. Elle exclut FOR/NEXT et les appels mêlés à WHILE/WEND. Les essais firmware montrent que RETURN abandonne les boucles de l’appel quitté, que RESUME conserve les boucles courantes et qu’une fermeture peut abandonner une boucle laissée ouverte par le gestionnaire.

## Décision

Représenter une pile ordonnée de trames `{kind, node}` : `call`, `for`, `while`. La liste `calls` reste une projection des seules trames d’appel. Aucun compteur, borne, condition ou nom de variable n’est exporté. Un même défaut sous deux piles différentes garde deux contextes.

L’entrée vraie d’une boucle empile son ouverture ; son saut initial ne l’empile pas. NEXT/WEND retrouvent l’ouverture correspondant à leur fermeture structurelle, sans franchir une trame d’appel. Les trames de boucle plus récentes sont abandonnées. NEXT choisit abstraitement entre le corps avec sa trame conservée et la sortie sans sa trame ; il ne réinitialise pas FOR. WEND dépile et rejoint le test WHILE. RETURN retire l’appel et les boucles situées au-dessus, préserve les boucles appelantes et l’erreur active. ON ERROR et les trois modes RESUME conservent la pile courante.

Une fermeture sans ouverture active correspondante, une réentrée directe dans une boucle active ou une réutilisation ambiguë du compteur FOR rend le modèle hors périmètre. Pour cette dernière garde seulement, les identifiants sont normalisés sans suffixe numérique et bornés aux 40 premiers caractères : garde conservatrice, sans inférence des types ni résolution générale des variables. Les erreurs implicites de pile ne sont pas ajoutées. Les exclusions structurelles antérieures restent applicables.

Le budget ajoute 16 boucles actives aux 16 appels : au plus 32 trames par état. Ce sont des limites d’analyse, pas des capacités matérielles. Les transferts de boucle consomment le plafond commun de 4096. Tout abandon retire origines, contextes et transferts, y compris lorsque le plafond est atteint entre deux issues d’une même instruction. Sous-formats : flow 7, errorFlow 4 ; rapport englobant inchangé.

## Conséquences et preuves

Les piles affichées mêlent appels et boucles avec liens vers leurs ouvertures ; exports Markdown/JSON et garde d’obsolescence suivent le même modèle. Le graphe structurel conserve ses normalisations et ses limites globales : aucune nouvelle conclusion de complexité, terminaison ou inaccessibilité.

36 assertions firmware nouvelles, dont l’exemple 42/deux erreurs, couvrent les boucles imbriquées, appels, gestionnaires, trois modes de reprise, fermetures nommées ou non, NEXT multiple, branches IF et abandons. Les cas invalides observés piègent effectivement ERR 1 ou ERR 30 ; les programmes avec réentrée peuvent s’exécuter tout en restant exclus de l’analyse. Tests sur le jeu CPC 6128 anglais identifié dans le moteur intégré, sans qualification matérielle ou émulateur indépendant supplémentaire. Tests de domaine et parcours Chromium vérifient piles, destinations, budgets, confidentialité, navigation et obsolescence.
