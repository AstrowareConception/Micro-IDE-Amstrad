# Analyse de flux BASIC — alpha 0.40.2

Date : 8 octobre 2026. Troisième lot 0.40 ; REQ-EDT-008 / ACC-36, IDE-076 reste partiel. [ADR 0049](../adr/0049-graphe-basic-conservateur.md), [ADR 0050](../adr/0050-branches-basic-qualifiees.md), [ADR 0051](../adr/0051-boucles-et-portees-conditionnelles.md).

## Essayer

Ouvrir [main.bas](../../examples/control-flow/main.bas), puis **BASIC → Rapport de qualité BASIC… → Générer le rapport**. Déplier **Flux BASIC**. Le programme principal présente une complexité de flux de **6**, les entrées GOSUB 200 et 300 une complexité de **1** chacune. Deux cycles de contrôle et deux relations d’appel sont repérés. L’instruction de la ligne 90 ne possède aucun chemin depuis le début, sous les hypothèses indiquées.

Filtrer les nœuds par numéro BASIC ou instruction, sélectionner le IF de la ligne 60 et examiner les issues Vrai/Faux. Un clic ou Entrée/Espace sur un nœud SVG recentre le voisinage. **Voir cette instruction dans le code** rejoint la ligne physique et la colonne du snapshot. Les entrées et sites d’appel proposent aussi un accès au code. Une source modifiée, renommée ou supprimée bloque ces liens jusqu’au prochain rapport. Explorer un ancien graphe reste possible ; cela ne relance aucun calcul.

Le voisinage est borné à cinq liaisons de chaque côté. Le filtre propose au plus 100 nœuds, en plus de la sélection courante. Le tableau des points d’entrée, les 100 premières relations d’appel et les 50 premiers cycles complètent la lecture. Les exports contiennent tous les éléments conservés par le moteur et leurs limites.

## Modèle construit

Le graphe contient des ancres de lignes et des instructions localisées, sans conserver leurs arguments ni le texte source. Il représente les suites, sauts GOTO décimaux littéraux, GOSUB et continuation supposée, IF simples/imbriqués avec THEN/GOTO et ELSE, cibles implicites `THEN 100` / `ELSE 200`, ON sélecteur à cibles littérales, FOR/NEXT et WHILE/WEND structurés, RETURN et fins END/STOP.

- Les IF sont inspectés jusqu’à **16 niveaux** ; chaque ELSE est associé au IF encore ouvert le plus proche. Les chaînes ELSE IF et les branches sans ELSE sont couvertes. Un IF porte sur le reste de sa ligne ; les deux-points de sa branche ne deviennent pas des instructions inconditionnelles. Les chaînes, commentaires et valeurs DATA sont protégés par le lexer.
- ON possède une continuation lorsque le sélecteur sort de sa liste. Les valeurs effectives et erreurs d’argument ne sont pas évaluées.
- FOR peut ne pas entrer dans son corps. Le graphe normalise son test en tête : NEXT revient au test, **sans réinitialiser la variable**. Les expressions de borne/STEP et la pile de boucles ne sont pas exécutées par l’analyseur.
- `NEXT j,i` est développé en deux fermetures localisées, dans cet ordre, et conserve une seule décision par FOR. La couverture exige des boucles structurées. Pour chaque fermeture **intermédiaire** de la liste (j dans NEXT j,i), l’entrée initiale reste garantie par des entiers décimaux littéraux de valeur absolue ≤ 32767, avec STEP littéral non nul ou pas implicite +1. Pour la **dernière variable** (i), les bornes/pas peuvent être variables et le corps peut être sauté : sa sortie rejoint l’instruction après la liste. Le saut initial d’une fermeture intermédiaire reste partiel. Des NEXT séparés conservent leurs continuations distinctes.
- Une boucle FOR/NEXT ou WHILE/WEND entièrement contenue dans une même branche THEN ou ELSE est couverte, y compris dans un IF imbriqué. Son retour va au test de boucle, sans réévaluer le IF englobant ; sa sortie conserve la suite de cette branche. Une identité de branche interne empêche d’apparier un début dans THEN avec une fin dans ELSE, dans un autre IF ou après la fin de la ligne. Ces franchissements restent partiels ; aucun champ de portée ni nom de variable n’est exporté.
- `GOTO100`, `GOSUB100`, `THEN100` et `ELSE200` ne sont plus découpés artificiellement : ce sont des identifiants lexicaux, pas des cibles reconnues. Le rapport devient partiel si une telle forme est utilisée comme branchement. Les variables valides de ce nom restent intactes ; la renumérotation refuse conservativement ces identifiants.
- GOSUB possède une liaison vers sa cible et une continuation supposant un retour possible. Une routine qui ne retourne jamais peut donc laisser un chemin de continuation conservé par prudence. RETURN termine l’exploration locale ; aucune pile GOSUB/RETURN contextuelle n’est simulée.
- Le point d’entrée principal est la première ligne. Les autres entrées sont les cibles GOSUB littérales, y compris celles présentes dans du code hors des chemins connus. Les parcours locaux suivent les continuations d’appel sans développer les corps appelés. Plusieurs entrées peuvent partager un même bloc ; il n’y a pas de partition des routines ni de total à additionner.
- Les composantes fortement connexes du graphe local identifient les cycles ; celles du graphe d’appels identifient la récursion possible. Une sortie structurelle n’est pas nécessairement réalisable, et son absence ne prouve pas une boucle infinie en présence d’effets extérieurs.

## Complexité et code sans chemin

La métrique lexicale 0.36 est conservée pour comparaison. La **complexité locale de flux** vaut `1 + somme(max(0, nombre d’issues locales − 1))` sur les nœuds accessibles depuis l’entrée considérée ; zéro pour une entrée sans instruction exécutable. Les appels simples ne sont pas des décisions supplémentaires. Un ON GOSUB à N cibles contribue N issues supplémentaires : les branches sélectionnées et la continuation sont distinguées. FOR/NEXT est normalisé en une seule décision.

Ce calcul retire les décisions hors du parcours local et ne gonfle pas le programme principal avec celles de ses sous-routines. Il porte sur le modèle structurel décrit ici : **ce n’est pas une certification McCabe du comportement réel, ni un nombre minimal de tests**. Conditions constantes, types, erreurs d’exécution, variables, profondeur de pile et chemins irréalisables restent hors analyse.

La remarque `unreachable-flow` signifie « aucun chemin structurel depuis la première ligne », jamais « code supprimable ». END/STOP terminent ce parcours ; une utilisation manuelle de CONT, RUN avec un autre numéro ou un chargement extérieur peut redonner un rôle à ces instructions. DATA et les commentaires ne sont pas signalés comme code mort ; READ peut utiliser des valeurs DATA sans exécuter leur ligne.

## Refus de conclure et bornes

Le graphe devient partiel en présence d’une numérotation ou syntaxe invalide, cible absente/calculée, plus de 16 niveaux IF, boucle franchissant sa branche IF ou non appariée, fermeture intermédiaire de NEXT multiple sans entrée FOR garantie, variable FOR réutilisée dans des boucles imbriquées, CALL/POKE/OUT/RSX, chargement/remplacement de programme, gestionnaire ON ERROR/BREAK/SQ, événements AFTER/EVERY ou instruction non classée. Des formes syntaxiques opaques mais connues sans transfert (ex. PRINT USING) peuvent conserver leur liaison de suite ; cela ne certifie pas leur grammaire complète.

Une seule de ces incertitudes, même située hors du chemin courant, suspend **la règle globale `unreachable-flow` et les métriques de complexité du graphe** de ce listing. Les anciennes remarques lexicales de la 0.36 conservent leurs propres limites locales. Les liaisons reconnues et les cycles restent consultables comme informations partielles. Les autres listings conservent leur propre couverture.

Bornes : 1 Mio/10000 lignes par source, 8192 caractères et 2048 tokens par ligne, 8192 nœuds et 32768 liaisons par graphe ; **32768 nœuds pour tout le rapport**, 128 entrées, 8192 relations d’appel, 500000 visites de nœuds et 100 raisons détaillées par source. Les omissions sont annoncées ; aucune complexité numérique ne survit à une troncature. Les traversées de graphe sont itératives. Le worker existant est terminé sur succès, erreur, annulation, changement de projet ou après 15 secondes.

Le rapport JSON passe en **version 2** avec un champ `flow` par source (sous-format version 1). Ce DTO est un export ponctuel, sans lecteur ni migration de fichier projet. Markdown présente aussi nœuds et liaisons. Les exports ne contiennent ni instructions complètes, ni arguments, chaînes, variables ou commentaires du listing ; seuls noms de sources, types d’opérations, numéros et emplacements sont conservés.

## Preuves et suite

`basic-control-flow.test.ts` couvre branchements composés, cibles littérales, refus des mots collés, sous-routines, sélecteurs, boucles, récursion, sources opaques, quotas et 3000 lignes sans récursion de parcours. `basic-flow-smoke.mjs` exerce le vrai worker dans Chromium : exemple, métriques par entrée, navigation clavier SVG/source, JSON sans extraits, obsolescence et passage en analyse partielle après ajout de CALL.

La recette `flow-control-forms` de `basic-test-runtime-smoke.mjs` exécute **trois assertions sur le vrai BASIC 1.1 du jeu CPC 6128 anglais identifié** : FOR initialement hors bornes, portée IF/ELSE et sélecteurs/appels, WHILE. Elle réussit localement avec le moteur WASM et les ROM privés déjà utilisés par les recettes précédentes. Elle vérifie ces formes, pas tous les graphes possibles ni un émulateur indépendant. La CI normale reprend cette recette, sans nouveau workflow ni packaging.

Suite 0.40 : résumés de retours GOSUB, puis erreurs/événements ; le saut initial des fermetures intermédiaires de NEXT et les boucles franchissant une branche restent à qualifier ; réduction des cas partiels et amélioration de la séparation des routines. Analyse de variables, corrections automatiques et revue IA restent à réaliser. La 0.41 (symboles/usages) et la 0.42 (mesures d’exécution) restent distinctes de ce modèle statique.


## Qualification 0.40.1

L’exemple [nested.bas](../../examples/control-flow/nested.bas) combine IF imbriqués, ELSE IF et NEXT j,i. Résultat BASIC attendu : **21** ; complexité structurelle de l’entrée principale : **6**, trois IF et deux FOR. Les deux fermetures NEXT sont navigables séparément à leurs colonnes respectives.

La recette `flow-nested-forms` comporte **27 assertions natives** : tables de vérité sur deux/trois conditions, absence d’ELSE externe, ELSE IF, cibles littérales, retours GOSUB et NEXT multiples (pas négatif, trois variables, lignes séparées). Une assertion supplémentaire vérifie le total de l’exemple. Huit cas `flow-spacing-*` comparent les mots collés à leurs formes espacées ; un neuvième vérifie des variables nommées GOTO100/THEN100. Les 37 nouvelles assertions réussissent sur le jeu CPC 6128 anglais identifié, pas sur une réinterprétation TypeScript.

Ces essais ont corrigé deux hypothèses : les branches imbriquées s’associent correctement sur ce BASIC 1.1, malgré la description contraire de la copie CPCWiki fournie ; les mots collés ne sont pas des raccourcis de branchement. GOTO100/GOSUB100/THEN100 provoquent l’erreur 2 dans les cas exercés, tandis que ELSE100 dans une branche fausse n’est pas reconnu comme ELSE et laisse poursuivre à la ligne suivante. Aucune normalisation automatique du listing n’est appliquée. Les originaux documentaires et ROM ne sont pas modifiés ni redistribués.

Les tests unitaires vérifient aussi les colonnes, l’absence de cibles inventées ou de renumérotation de ces formes, les branches mal formées, les limites de profondeur et les listes NEXT refusées. Le parcours Chromium vérifie l’exemple dans le vrai worker, l’export du graphe, la navigation vers le deuxième NEXT et le passage en analyse partielle après remplacement d’une borne par une variable. Les anciens plafonds de calcul et formats JSON sont conservés.


## Qualification 0.40.2

Ouvrir [conditional-loops.bas](../../examples/control-flow/conditional-loops.bas). Le programme affiche **15** ; son entrée possède une complexité structurelle de **9** (trois IF, quatre FOR, un WHILE) et quatre composantes cycliques. Cette métrique garde toutes les issues structurelles, même lorsque les valeurs de l’exemple les empêchent à l’exécution.

La recette `flow-loop-scopes` ajoute **25 assertions natives** : boucles internes sautées avec NEXT séparés, boucle externe sautée avec NEXT multiples, bornes/pas variables, pas négatif, boucles contenues dans THEN/ELSE, IF imbriqués, changement de la condition IF pendant une boucle et compositions FOR/WHILE. Une assertion supplémentaire vérifie le total de l’exemple. Ces 26 assertions réussissent sur le firmware CPC 6128 anglais identifié ; aucune qualification indépendante ou matérielle supplémentaire n’est déduite.

Un essai exploratoire `FOR i=1 TO 2:FOR j=2 TO 1:...:NEXT j,i` n’atteint pas la signature de fin dans le budget testé de cinq secondes après démarrage. L’essai avec NEXT j:NEXT i l’atteint. Cette observation ne prouve pas une boucle infinie ; elle justifie de conserver un rapport partiel pour une fermeture intermédiaire dont l’entrée n’est pas garantie, au lieu de lui inventer une sortie. Le dernier élément de la liste possède en revanche une sortie qualifiée par les assertions positives ci-dessus.

Les tests du graphe vérifient que le retour d’une boucle ne revisite pas le IF englobant, que les sorties évitent la branche alternative et que des branches distinctes au même niveau ne sont jamais appariées. Le parcours Chromium vérifie le vrai worker, l’export, la navigation vers le FOR de la ligne 40 et l’explication du refus d’un FOR/NEXT réparti entre THEN et ELSE. Quotas, annulation, calcul à la demande et formats d’export restent inchangés.
