# Analyse de flux BASIC — alpha 0.40.9

Date : 8 octobre 2026. Neuvième lot 0.40 ; REQ-EDT-008 / ACC-36, IDE-076 reste partiel. [ADR 0049](../adr/0049-graphe-basic-conservateur.md), [ADR 0050](../adr/0050-branches-basic-qualifiees.md), [ADR 0051](../adr/0051-boucles-et-portees-conditionnelles.md).

## Essayer

Ouvrir [main.bas](../../examples/control-flow/main.bas), puis **BASIC → Rapport de qualité BASIC… → Générer le rapport**. Déplier **Flux BASIC**. Le programme principal présente une complexité de flux de **6**, les entrées GOSUB 200 et 300 une complexité de **1** chacune. Deux cycles de contrôle et deux relations d’appel sont repérés. L’instruction de la ligne 90 ne possède aucun chemin depuis le début, sous les hypothèses indiquées.

Filtrer les nœuds par numéro BASIC ou instruction, sélectionner le IF de la ligne 60 et examiner les issues Vrai/Faux. Un clic ou Entrée/Espace sur un nœud SVG recentre le voisinage. **Voir cette instruction dans le code** rejoint la ligne physique et la colonne du snapshot. Les entrées et sites d’appel proposent aussi un accès au code. Une source modifiée, renommée ou supprimée bloque ces liens jusqu’au prochain rapport. Explorer un ancien graphe reste possible ; cela ne relance aucun calcul.

Le voisinage est borné à cinq liaisons de chaque côté. Le filtre propose au plus 100 nœuds, en plus de la sélection courante. Le tableau des points d’entrée, les 100 premières relations d’appel et les 50 premiers cycles complètent la lecture. Les exports contiennent tous les éléments conservés par le moteur et leurs limites.

## Modèle construit

Le graphe contient des ancres de lignes et des instructions localisées, sans conserver leurs arguments ni le texte source. Il représente les suites, sauts GOTO décimaux littéraux, GOSUB et continuation filtrée par résumé de retour, IF simples/imbriqués avec THEN/GOTO et ELSE, cibles implicites `THEN 100` / `ELSE 200`, ON sélecteur à cibles littérales, FOR/NEXT et WHILE/WEND structurés, RETURN et fins END/STOP.

- Les IF sont inspectés jusqu’à **16 niveaux** ; chaque ELSE est associé au IF encore ouvert le plus proche. Les chaînes ELSE IF et les branches sans ELSE sont couvertes. Un IF porte sur le reste de sa ligne ; les deux-points de sa branche ne deviennent pas des instructions inconditionnelles. Les chaînes, commentaires et valeurs DATA sont protégés par le lexer.
- ON possède une continuation lorsque le sélecteur sort de sa liste. Les valeurs effectives et erreurs d’argument ne sont pas évaluées.
- FOR peut ne pas entrer dans son corps. Le graphe normalise son test en tête : NEXT revient au test, **sans réinitialiser la variable**. Les expressions de borne/STEP et la pile de boucles ne sont pas exécutées par l’analyseur.
- `NEXT j,i` est développé en deux fermetures localisées, dans cet ordre, et conserve une seule décision par FOR. La couverture exige des boucles structurées. Pour chaque fermeture **intermédiaire** de la liste (j dans NEXT j,i), l’entrée initiale reste garantie par des entiers décimaux littéraux de valeur absolue ≤ 32767, avec STEP littéral non nul ou pas implicite +1. Pour la **dernière variable** (i), les bornes/pas peuvent être variables et le corps peut être sauté : sa sortie rejoint l’instruction après la liste. Le saut initial d’une fermeture intermédiaire reste partiel. Des NEXT séparés conservent leurs continuations distinctes.
- Une boucle FOR/NEXT ou WHILE/WEND entièrement contenue dans une même branche THEN ou ELSE est couverte, y compris dans un IF imbriqué. Son retour va au test de boucle, sans réévaluer le IF englobant ; sa sortie conserve la suite de cette branche. Une identité de branche interne empêche d’apparier un début dans THEN avec une fin dans ELSE, dans un autre IF ou après la fin de la ligne. Ces franchissements restent partiels ; aucun champ de portée ni nom de variable n’est exporté.
- `GOTO100`, `GOSUB100`, `THEN100` et `ELSE200` ne sont plus découpés artificiellement : ce sont des identifiants lexicaux, pas des cibles reconnues. Le rapport devient partiel si une telle forme est utilisée comme branchement. Les variables valides de ce nom restent intactes ; la renumérotation refuse conservativement ces identifiants.
- Chaque entrée indique **Possible**, **Aucun chemin** ou **Indéterminé** vers RETURN. Un point fixe calcule les chemins finis : RETURN est une base, une branche suffit, mais un GOSUB exige un retour de la cible puis un chemin depuis sa continuation. Une récursion sans cas de retour ne crée pas artificiellement de chemin ; une branche RETURN peut rendre tout un groupe récursif retournant. La continuation du GOSUB est retirée seulement si sa cible ne possède aucun chemin vers RETURN. ON GOSUB conserve toujours son issue hors liste, sans évaluer le sélecteur. END, STOP et la fin physique du listing ne valent pas RETURN. Aucune pile contextuelle n’est simulée ; un RETURN au début peut être déclaré structurellement possible sans être valide à l’exécution.
- Les déclarations ON ERROR/BREAK/SQ et AFTER/EVERY reconnues possèdent une association `handler`, rendue en pointillés et exclue de l’accessibilité, des décisions locales, des cycles et des appels immédiats. Le tableau des événements garde chaque déclaration/changement de mode dans l’ordre du source, y compris les déclarations hors des chemins connus. Il ne réduit pas ces opérations à un hypothétique état actif. Depuis la 0.40.5, un calcul contextuel distinct suit les seuls ON ERROR et ERROR explicites dans le périmètre indiqué plus bas. Une cible absente est indiquée sans inventer de nœud. Les cibles reconnues deviennent des entrées Gestionnaire ; une cible également appelée par GOSUB garde le libellé GOSUB et son association événementielle dans la liste.
- ERROR possède une sortie inconnue, sans suite immédiate inventée. RESUME et RESUME NEXT possèdent une liaison de reprise sans cible ; RESUME suivi d’un numéro décimal positif conserve sa cible potentielle. Aucune de ces liaisons ne prouve l’existence d’un contexte d’erreur valide. Les suites du gestionnaire ne sont pas assimilées à la reprise du programme interrompu.
- Le point d’entrée principal est la première ligne. Les autres entrées sont les cibles GOSUB et de gestionnaires littérales, y compris celles présentes dans du code hors des chemins connus. Les parcours locaux suivent les continuations d’appel sans développer les corps appelés. Plusieurs entrées peuvent partager un même bloc ; il n’y a pas de partition des routines ni de total à additionner.
- Les composantes fortement connexes du graphe local identifient les cycles ; celles du graphe d’appels identifient la récursion possible. Une sortie structurelle n’est pas nécessairement réalisable, et son absence ne prouve pas une boucle infinie en présence d’effets extérieurs.

## Complexité et code sans chemin

La métrique lexicale 0.36 est conservée pour comparaison. La **complexité locale de flux** vaut `1 + somme(max(0, nombre d’issues locales − 1))` sur les nœuds accessibles depuis l’entrée considérée ; zéro pour une entrée sans instruction exécutable. Les appels simples ne sont pas des décisions supplémentaires. Un ON GOSUB à N cibles contribue N issues supplémentaires : les branches sélectionnées et la continuation sont distinguées. FOR/NEXT est normalisé en une seule décision.

Ce calcul retire les décisions hors du parcours local et ne gonfle pas le programme principal avec celles de ses sous-routines. Il porte sur le modèle structurel décrit ici : **ce n’est pas une certification McCabe du comportement réel, ni un nombre minimal de tests**. Conditions constantes, types, erreurs d’exécution, variables, profondeur de pile et chemins irréalisables restent hors analyse.

La remarque `unreachable-flow` signifie « aucun chemin structurel depuis la première ligne », jamais « code supprimable ». END/STOP terminent ce parcours ; une utilisation manuelle de CONT, RUN avec un autre numéro ou un chargement extérieur peut redonner un rôle à ces instructions. DATA et les commentaires ne sont pas signalés comme code mort ; READ peut utiliser des valeurs DATA sans exécuter leur ligne.

## Refus de conclure et bornes

Le graphe devient partiel en présence d’une numérotation ou syntaxe invalide, cible absente/calculée, plus de 16 niveaux IF, boucle franchissant sa branche IF ou non appariée, fermeture intermédiaire de NEXT multiple sans entrée FOR garantie, variable FOR réutilisée dans des boucles imbriquées, CALL/POKE/OUT/RSX, chargement/remplacement de programme, gestionnaire ON ERROR/BREAK/SQ, événement AFTER/EVERY, ERROR/RESUME ou instruction non classée. Les déclarations événementielles peuvent être cartographiées tout en restant partielles : c’est leur activation et leur déclenchement qui manquent au modèle, pas nécessairement leur forme syntaxique. Des formes syntaxiques opaques mais connues sans transfert (ex. PRINT USING) peuvent conserver leur liaison de suite ; cela ne certifie pas leur grammaire complète.

Une seule de ces incertitudes, même située hors du chemin courant, suspend **la règle globale `unreachable-flow` et les métriques de complexité du graphe** de ce listing. Les anciennes remarques lexicales de la 0.36 conservent leurs propres limites locales. Une construction partielle rend aussi les retours indéterminés et conserve les continuations GOSUB. Les quotas de résumés/parcours appliqués après une construction complète limitent les métriques, sans invalider le calcul indépendant des retours. Les liaisons reconnues et les cycles restent consultables comme informations partielles. Les autres listings conservent leur propre couverture.

Bornes : 1 Mio/10000 lignes par source, 8192 caractères et 2048 tokens par ligne, 8192 nœuds et 32768 liaisons par graphe ; **32768 nœuds pour tout le rapport**, 128 entrées, 8192 relations d’appel, 500000 visites de nœuds et 100 raisons détaillées par source. Les omissions sont annoncées ; aucune complexité numérique ne survit à une troncature. Les traversées de graphe sont itératives. Le point fixe des retours traite chaque dépendance une seule fois, en O(nœuds + liaisons), dans les mêmes plafonds de construction ; il ne consomme pas le budget des parcours locaux. Le worker existant est terminé sur succès, erreur, annulation, changement de projet ou après 15 secondes.

Le rapport JSON passe en **version 2** avec un champ `flow` par source (sous-format **version 2 depuis la 0.40.3**, avec `entries[].returnStatus` : `possible`, `absent`, `unknown` ; **version 3 depuis la 0.40.4** : `handlers[]`, entrée `handler`, liaisons `handler`/`recovery` ; **version 4 depuis la 0.40.5** : `errorFlow`, sous-format 1). Ce DTO est un export ponctuel, sans lecteur ni migration de fichier projet. Markdown présente aussi nœuds et liaisons. Les exports ne contiennent ni instructions complètes, ni arguments, chaînes, variables ou commentaires du listing ; seuls noms de sources, types d’opérations, numéros et emplacements sont conservés.

## Preuves et suite

`basic-control-flow.test.ts` couvre branchements composés, cibles littérales, refus des mots collés, sous-routines, sélecteurs, boucles, récursion, sources opaques, quotas et 3000 lignes sans récursion de parcours. `basic-flow-smoke.mjs` exerce le vrai worker dans Chromium : exemple, métriques par entrée, navigation clavier SVG/source, JSON sans extraits, obsolescence et passage en analyse partielle après ajout de CALL.

La recette `flow-control-forms` de `basic-test-runtime-smoke.mjs` exécute **trois assertions sur le vrai BASIC 1.1 du jeu CPC 6128 anglais identifié** : FOR initialement hors bornes, portée IF/ELSE et sélecteurs/appels, WHILE. Elle réussit localement avec le moteur WASM et les ROM privés déjà utilisés par les recettes précédentes. Elle vérifie ces formes, pas tous les graphes possibles ni un émulateur indépendant. La CI normale reprend cette recette, sans nouveau workflow ni packaging.

État 0.40.9 : reprises conditionnelles, divisions simples et piles d’appels/boucles sont couvertes dans les limites des qualifications ci-dessous. Autres erreurs implicites et réentrées restent ouvertes ; le saut initial des fermetures intermédiaires de NEXT et les boucles franchissant une branche restent à qualifier ; réduction des cas partiels et amélioration de la séparation des routines. Analyse de variables, corrections automatiques et revue IA restent à réaliser. La 0.41 (symboles/usages) et la 0.42 (mesures d’exécution) restent distinctes de ce modèle statique.


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


## Qualification 0.40.3

[ADR 0052](../adr/0052-resumes-retours-basic.md). L’exemple [returns.bas](../../examples/control-flow/returns.bas) affiche **6**, revient d’un groupe récursif 100/200 puis appelle 300, qui termine par END. Le tableau indique un chemin RETURN possible pour 100/200 et absent pour le début/300. Les instructions 50 et 60 n’ont plus de chemin depuis le début. « Possible » reste une surapproximation : conditions, variables, erreurs et profondeur de pile ne sont pas évaluées. « Aucun chemin » ne signifie pas « boucle infinie ».

Six nouvelles assertions firmware vérifient appels imbriqués, récursion mutuelle avec cas de base, sélecteurs ON hors liste, sélection d’une routine retournante et RETURN conditionnel. Trois essais négatifs (END, STOP et cycle GOTO) atteignent un marqueur RAM dans la routine, laissent intact celui de la continuation et n’atteignent pas la signature de fin dans les trois secondes après démarrage. Ils prouvent cette observation bornée, pas une non-terminaison générale. ROM CPC 6128 anglais identifiées, moteur WASM intégré uniquement ; aucune ROM publiée.

Les tests unitaires couvrent également récursion sans base, continuations partagées, fin physique, source opaque, dépendances identiques et propagation itérative sur mille appels. Le parcours Chromium contrôle les libellés du tableau, le sous-format JSON 2, les instructions sans chemin et l’absence de liaison de retour pour GOSUB 300. La notice et les roadmaps conservent IDE-076/J2 partiels ; aucun installateur supplémentaire n’est produit par cet incrément.


## Qualification 0.40.4

[ADR 0053](../adr/0053-cartographie-evenements-basic.md), exemple [events.bas](../../examples/control-flow/events.bas). La carte indique trois opérations : déclaration de l’erreur vers 300, minuteur unique vers 200 et désactivation de l’erreur. Le listing affiche **Minuteur 1 Suite 1**, après l’erreur volontaire à la ligne 60. Il reste partiel : aucun verdict d’inaccessibilité, aucune complexité numérique ni résumé RETURN conclusif sur ce listing.

Formes cartographiées : `ON ERROR GOTO n` (0 désactive), `ON BREAK GOSUB n`, `ON BREAK CONT/STOP`, `ON SQ(expression) GOSUB n`, `AFTER délai[,minuteur] GOSUB n` et `EVERY délai[,minuteur] GOSUB n`. La cible doit être un entier décimal de 1 à 65535. Les expressions ordinaires de délai/minuteur/canal sont inspectées structurellement, jamais évaluées ni exportées ; cela ne vérifie pas leurs types, plages ou priorités. Les formes mal reconnues gardent le repli opaque. Les mots collés, commentaires, DATA et chaînes ne créent aucun gestionnaire.

Le sous-format flow JSON 3 ajoute `handlers[]` (site, événement, action, numéro cible et nœud cible éventuel). Le registre est borné par le nombre maximal de nœuds ; l’interface affiche les 100 premières déclarations, les exports toutes celles construites. Les 128 résumés d’entrée et les autres plafonds restent communs. Le worker, l’annulation et l’obsolescence des liens sont conservés.

**Dix nouvelles assertions positives sur le vrai firmware** : reprise de l’instruction fautive par RESUME avec ERR/ERL ; RESUME NEXT vers l’instruction suivante sur la même ligne ; RESUME vers une ligne explicite ; AFTER unique ; EVERY arrêté par REMAIN ; DI différant le traitement puis EI le libérant ; ON SQ(1) déclenché une fois sur file disponible ; déclarations ON BREAK GOSUB/CONT/STOP sans appel immédiat ; résultat de l’exemple. L’interruption par touche Escape et les priorités imbriquées ne sont pas qualifiées par ces essais.

Deux observations négatives de trois secondes après démarrage contrôlent les marqueurs RAM : ON ERROR GOTO 0 laisse l’erreur suivante non traitée par l’ancien gestionnaire ; RESUME 0, rencontré dans un gestionnaire après correction du diviseur, ne rejoint pas la continuation observée. Aucune équivalence RESUME 0/RESUME n’est donc introduite ; la forme 0 reste opaque. Ces délais ne prouvent pas une non-terminaison générale.

La copie CPCWiki fournie décrit RESUME NEXT comme passant à la ligne suivante. La recette native vérifie au contraire l’instruction suivante sur la même ligne, sur le jeu CPC 6128 anglais identifié. Les originaux ne sont pas modifiés ; cette qualification ne remplace pas une vérification sur émulateur indépendant ou machine physique.

Tests de domaine : distinction déclaration/appel, absence de faux cycle par auto-déclaration, changements de mode et ordre des colonnes, branches conditionnelles, expressions imbriquées, cibles absentes/mal formées, exports sans arguments, entrées partagées et quota. Chromium contrôle la liste, les pointillés, le JSON 3, la navigation et le blocage après modification du source. Prochain lot : propagation bornée de l’état des gestionnaires et reprise contextuelle d’erreur ; symboles/usages 0.41 ensuite. IDE-076/J2 restent partiels.


## Qualification 0.40.5

[ADR 0054](../adr/0054-contextes-erreurs-explicites.md). L’exemple [error-contexts.bas](../../examples/control-flow/error-contexts.bas) affiche **11** : ERROR 5 à la ligne 30 passe par 100, qui installe 200 ; RESUME NEXT rejoint ERROR 6 de la même ligne, ensuite traité par 200. La dernière reprise rejoint la ligne 40. La liste des contextes et des transferts expose les sites exacts, le gestionnaire et l’ERROR interrompu, sans les confondre avec les déclarations du graphe principal.

Le nouveau calcul parcourt des triplets **instruction / gestionnaire actif avant cette instruction dans le modèle / ERROR en traitement** depuis le début, piège initialement désactivé. ON ERROR remplace ou désactive le piège ; deux branches conservent des états distincts. ERROR rejoint le piège ou arrête le chemin s’il est désactivé. Une nouvelle erreur pendant un traitement n’entre pas de nouveau dans le gestionnaire. ON ERROR GOTO 0 pendant le traitement relance l’erreur et arrête ce chemin. RESUME réessaie le même ERROR ; RESUME NEXT utilise sa continuation ; RESUME ligne choisit sa cible. Une reprise efface l’ERROR en traitement mais conserve le gestionnaire installé, y compris lorsqu’il a changé dans le traitement.

**Périmètre assumé : uniquement ERROR explicite, décimal littéral de 1 à 255, hors branche IF.** Conditions non évaluées, donc alternatives possibles plutôt que chemins certifiés réalisables. Les erreurs implicites ne sont pas créées : division par zéro, type, mémoire, I/O, etc. ne font pas partie du modèle. Appels GOSUB/RETURN, FOR/NEXT, événements autres que ON ERROR, formes opaques, syntaxe/construction incertaine et RESUME accessible sans ERROR explicite actif rendent ce calcul hors périmètre ; aucun résultat contextuel partiel n’est conservé. Le graphe principal garde ses propres limites : aucune nouvelle complexité numérique, preuve de retour ou inaccessibilité globale n’est déduite.

Le sous-format flow passe en **version 4**, avec `errorFlow` version 1 et scope `explicit-error`. Statuts : `not-needed`, `covered`, `unsupported`, `limited`. Les contextes exportés gardent leurs corrélations (pas de produit artificiel de listes de gestionnaires/erreurs) ; les transferts indiquent le type et la destination. Aucun argument, code ERROR, chaîne ou nom de variable n’est conservé. Le modèle est séparé des liaisons du graphe principal et ne gonfle pas ses cycles/appels/métriques.

Bornes par source : **8192 états**, **131072 transitions parcourues**, **4096 transferts** ; **65536 états explorés au total** dans un rapport multisource. Les états déjà vus arrêtent les reprises cycliques. Une limite atteinte retire contextes et transferts et fournit sa raison, tout en conservant la carte structurelle. L’interface montre au plus 100 contextes et 100 transferts avec omission annoncée ; les exports contiennent tous les résultats achevés conservés. Pas de recalcul à la frappe ; worker/annulation et délai de 15 secondes inchangés.

**Sept nouvelles assertions firmware** : remplacement du gestionnaire dans son traitement, nouvelle tentative par RESUME puis reprise explicite, observations RESUME NEXT dans THEN/ELSE, deux branches d’installation ON ERROR et résultat de l’exemple. **Trois observations négatives bornées** vérifient qu’une désactivation dans le traitement et une erreur imbriquée (avant/après remplacement du piège) ne reviennent ni dans le gestionnaire ni à la suite testée. Jeu CPC 6128 anglais identifié, moteur WASM intégré ; ni nouvelle qualification matérielle, ni émulateur indépendant.

Subtilité détectée : pour `IF a THEN ERROR 5:x=1 ELSE x=99` avec a=1, RESUME NEXT atteint x=1 ; pour `IF a THEN x=99 ELSE ERROR 5:x=2` avec a=0, le même gestionnaire RESUME NEXT laisse x=0 dans la recette. Le saut lexical vers x=2 serait donc faux. Par prudence, tout ERROR à l’intérieur d’une branche IF reste hors calcul contextuel, même si certaines formes THEN sont qualifiées ; aucune généralisation aux branches imbriquées n’est annoncée.

Tests du domaine : remplacements, branches avec piège désactivé, gestionnaire partagé avec deux erreurs distinctes, reprise cyclique, relance, gardes et tous les plafonds locaux/globaux. Chromium vérifie calcul/exports, destination de la seconde erreur, obsolescence puis passage hors périmètre après ajout d’un événement asynchrone. Suite : qualifier les erreurs implicites, les reprises conditionnelles et les piles avant d’élargir les conclusions ; symboles/usages 0.41 ensuite. IDE-076/J2 restent partiels.


<a id="qualification-0406"></a>
## Qualification 0.40.6 — Reprises conditionnelles

Ce lot lève la garde « ERROR hors IF » de la 0.40.5 pour les formes structurelles couvertes, jusqu’à 16 niveaux. Le code ERROR reste un entier décimal littéral de 1 à 255. Les exclusions des erreurs implicites, appels/RETURN, FOR/NEXT, événements asynchrones et sources opaques demeurent, ainsi que tous les budgets. Aucune nouvelle complexité, preuve de retour ni inaccessibilité globale n’est produite.

Le firmware mémorise le début d’une instruction avant d’entrer dans IF/THEN/ELSE. La première instruction d’une branche conserve ce début ; un deux-points **exécuté** commence une nouvelle instruction. Les séparateurs d’une branche ignorée ne changent pas ce début mémorisé. RESUME réessaie cette instruction, qui peut être un IF englobant ou imbriqué, au lieu de toujours viser ERROR. Les changements de condition faits par le gestionnaire prennent donc effet lors de cette réévaluation.

RESUME NEXT cherche le premier deux-points, ELSE ou fin de ligne depuis ce début mémorisé. Un ELSE ou une fin de ligne mène à la ligne suivante ; un deux-points mène à l’instruction qui suit, même dans une branche précédemment ignorée. Les chaînes, DATA et commentaires sont protégés. Les deux-points consécutifs sont franchis. Une destination non reconnue suspend le calcul. RESUME ligne conserve sa cible explicite et abandonne la reprise conditionnelle.

| Source interrompue | Destination de RESUME | Destination de RESUME NEXT |
| --- | --- | --- |
| `IF a THEN ERROR 5:x=1 ELSE x=99` | IF a | x=1 |
| `IF a THEN x=99 ELSE ERROR 5:x=2` | IF a | ligne suivante |
| `IF a THEN x=99:x=98 ELSE ERROR 5:x=2` | IF a | x=98 |
| `IF a THEN x=10:ERROR 5:x=1` | ERROR 5 | x=1 |
| `IF a THEN x=10:IF b THEN ERROR 5:x=1` | IF b | x=1 |

Les destinations sont calculées pendant la construction à partir des frontières d’instruction ; le parcours contextuel garde les triplets et corrélations de la 0.40.5. Les libellés deviennent **Reprendre l’instruction mémorisée** et **Suite de l’instruction mémorisée**, car « Réessayer ERROR » serait faux pour certains IF. DTO inchangés : flow 4, errorFlow 1. Les arguments et conditions ne sont pas exportés.

**51 nouvelles assertions firmware** : 23 formes avec RESUME puis RESUME NEXT (46), quatre branches imbriquées reprises à une ligne explicite et l’exemple. Les conditions changent dans les gestionnaires ; les compteurs vérifient les instructions exécutées et le nombre d’erreurs. Couverture : THEN/ELSE, imbrications et ELSE IF, préfixes exécutés/ignorés, deux erreurs sur une ligne, DATA/chaînes, séparateurs vides, retour à un IF interne. Jeu CPC 6128 anglais identifié dans le moteur WASM intégré ; aucune nouvelle qualification indépendante ou matérielle.

[conditional-errors.bas](../../examples/control-flow/conditional-errors.bas) affiche **1, 0, 98**. Le navigateur vérifie le vrai worker, les six transferts, les destinations JSON exactes et la navigation vers z=98 ; modifier le source bloque le lien. Les tests de domaine confrontent les destinations aux mêmes cas firmware, vérifient les reprises partagées et conservent les plafonds de la 0.40.5. [ADR 0055](../adr/0055-reprises-erreurs-conditionnelles.md).

Suite : erreurs implicites et piles encore à qualifier ; symboles/usages 0.41 ensuite. IDE-076/J2 restent partiels.


<a id="qualification-0407"></a>
## Qualification 0.40.7 — Divisions et erreurs possibles

Le modèle des erreurs suit désormais les divisions simples dans une affectation scalaire, en plus des ERROR explicites et des reprises conditionnelles. Une origine indique son type (`explicit` ou `division-zero`) et, pour une division, son opérateur. Le nom des variables, valeurs et expressions ne sont jamais conservés dans le rapport. Le panneau s’appelle **Contextes d’erreur** ; les liens utilisent **Instruction interrompue** pour ne pas assimiler une affectation à la commande ERROR.

Grammaire couverte : `[LET] scalaire = opérande opérateur opérande`, avec scalaire/variable non suffixé `$`, opérande variable ou entier décimal signé de valeur absolue ≤ 32767, et opérateur `/`, `\` ou `MOD`. Aucun calcul de valeurs, inférence de type ou propagation des affectations. Les suffixes `%`/`!` sont reconnus lexicalement. Les expressions composées, parenthèses, fonctions, tableaux, littéraux réels/hexadécimaux, variables précédées d’un signe, divisions dans PRINT/IF et autres commandes ne créent pas d’origine dans ce premier lot. Ces exclusions ne certifient pas l’absence d’erreur ; autres erreurs implicites et conversions restent ignorées.

Chaque division possède une issue normale **et** une erreur 11 possible, même avec diviseur littéral. Un diviseur réparé dans un gestionnaire n’est pas mémorisé par l’analyse ; le point fixe représente donc la reprise et une réussite possible sans prouver le nombre d’itérations. Le défaut actif reste corrélé au gestionnaire et aux destinations de RESUME/RESUME NEXT/RESUME ligne.

| Contexte de la division par zéro | Chemin fautif représenté |
| --- | --- |
| Gestionnaire actif, aucune erreur déjà traitée | Entrée dans le gestionnaire |
| `/` sans gestionnaire | Avertissement possible, puis suite normale de l’affectation |
| `\` ou `MOD` sans gestionnaire | Arrêt du chemin fautif |
| Nouvelle division fautive pendant le gestionnaire | Arrêt sans réentrée ; l’issue normale reste également possible |
| ON ERROR GOTO 0 pendant le traitement | Relance et arrêt du chemin |

La continuation après avertissement `/` suit la branche où l’affectation s’exécute. Elle ne cherche pas la suite du IF mémorisé comme RESUME NEXT. Poursuivre l’évaluation n’exclut pas une autre erreur, par exemple une conversion vers une variable entière. `ERROR 11` explicite sans piège arrête le chemin : il n’est pas assimilé à l’avertissement d’une division réelle.

Exports : **flow version 5**, **errorFlow version 2**, scope `explicit-and-simple-division`, liste `sites` et transfert `warning`. Le rapport englobant reste en version 2. Les bornes 8192 états/4096 transferts/131072 transitions et 65536 états multisource demeurent. Sites, contextes et transferts sont retirés ensemble en cas d’abandon après exploration ; 100 origines, 100 contextes et 100 transferts maximum sont affichés. Les sites sont bornés par le quota de nœuds. Le graphe global reste partiel sur ces divisions : complexité, retours et inaccessibilité globale non conclus.

**52 nouvelles assertions firmware positives** : 45 combinaisons de trois opérateurs, trois reprises et cinq formes conditionnelles ; trois affectations sans erreur avec suffixes/LET ; trois avertissements `/` sans gestionnaire dans THEN/ELSE/après préfixe ; un exemple complet. **Neuf observations négatives bornées** : division entière/MOD sans piège, erreur imbriquée et désactivation pour les trois opérateurs, ERROR 11 explicite sans piège. Les observations négatives contrôlent les marqueurs RAM après trois secondes ; elles ne prouvent pas une propriété temporelle illimitée. Recettes sur le jeu CPC 6128 anglais identifié dans le moteur WASM intégré, sans ROM publiée ni qualification indépendante/matérielle supplémentaire.

Tests de domaine : reconnaissance stricte, confidentialité, conservation des issues normales, reprise après réparation, gestionnaire partagé, erreurs imbriquées, continuations conditionnelles, avertissement sans piège, retrait sur quota/hors périmètre et exports. Le navigateur vérifie l’exemple [division-errors.bas](../../examples/control-flow/division-errors.bas), les trois opérateurs, les six transferts, les versions JSON, les destinations et l’obsolescence. [ADR 0056](../adr/0056-divisions-et-erreurs-possibles.md).

Suite : piles d’appels/boucles et autres erreurs implicites encore ouvertes ; symboles/usages 0.41 suivent. IDE-076/J2 restent partiels.


<a id="qualification-0408"></a>
## Qualification 0.40.8 — Piles d’appels dans les contextes d’erreur

Le produit fini ajoute la pile des sites GOSUB/ON GOSUB à l’instruction courante, au gestionnaire et à l’instruction fautive. Les appels d’une routine partagée restent distincts, même lorsque l’ERROR et le gestionnaire sont identiques. Chaque site possède une continuation structurelle : après GOSUB, ou après ON GOSUB. Un appel sélectionné empile son site et entre dans la cible ; GOSUB n’emprunte pas directement sa continuation. ON GOSUB conserve aussi une issue hors liste, sans empiler. Les valeurs du sélecteur restent ignorées.

RETURN dépile le site le plus récent et rejoint sa continuation. ON ERROR ne pousse aucune trame d’appel ; un RETURN dans le gestionnaire peut donc dépiler l’appel interrompu. Ce RETURN ne supprime pas l’erreur active : une nouvelle erreur sur le chemin retourné reste imbriquée. RESUME, RESUME NEXT et RESUME ligne effacent l’erreur active mais conservent **la pile courante**, y compris les appels faits par le gestionnaire et qui n’ont pas encore exécuté RETURN. Il ne faut pas restaurer artificiellement une copie de la pile à l’instant de l’erreur.

| Chemin | Effet vérifié |
| --- | --- |
| Erreur dans deux sous-routines imbriquées, RESUME NEXT | Retour dans la routine fautive, puis dépilement des deux appelants |
| GOSUB auxiliaire dans le gestionnaire, RETURN puis RESUME | L’auxiliaire revient au gestionnaire ; la reprise conserve les appels antérieurs |
| RESUME depuis l’auxiliaire sans son RETURN | Son appel reste empilé ; le prochain RETURN rejoint sa continuation dans le gestionnaire |
| RETURN directement dans le gestionnaire | Dépile l’appel interrompu, conserve l’erreur active |
| Changement de ON ERROR dans l’auxiliaire | Le nouveau gestionnaire demeure après RETURN et RESUME |
| END, STOP ou cycle sans RETURN dans une routine | Aucune continuation directe inventée vers l’appelant |

Le calcul démarre toujours depuis le début avec pile vide et piège désactivé. RETURN accessible sans appel rend le modèle hors périmètre : son erreur implicite n’est pas ajoutée. FOR/NEXT et événements asynchrones restent exclus ; une source combinant appels et WHILE/WEND est également refusée tant que leur interaction de pile n’est pas qualifiée. Les WHILE/WEND sans appel gardent le périmètre antérieur. Les divisions restent des alternatives possibles sans valeurs/types ; une réparation du diviseur n’est pas prouvée.

**Budget de 16 appels imbriqués**, distinct de la capacité réelle du CPC. Dépasser ce budget retire sites, contextes et transferts. Une récursion avec cas de base peut atteindre cette borne car toutes les conditions sont explorées. Les autres limites restent 8192 états/4096 transferts/131072 transitions par source et 65536 états multisource. Les nouveaux appels et retours consomment le même budget de transferts. Piles immuables pendant le parcours, profondeur bornée, aucune récursion du moteur d’analyse.

Exports : **flow version 6**, **errorFlow version 3**, scope `explicit-and-simple-division` inchangé. Chaque contexte/transfert contient `calls`, tableau de sites du plus ancien au plus récent, décrivant l’état **avant** le transfert. Types de transferts `call` et `return` ajoutés. Aucun argument, nom de variable ou valeur n’est exporté. Le graphe structurel et ses résumés ne sont pas recalculés à partir de ces piles : conclusions globales toujours suspendues.

L’interface présente une pile dépliable par contexte/transfert, au plus 16 liens ; les plafonds de 100 origines/contextes/transferts restent explicites. Les liens rejoignent les colonnes exactes et suivent la garde d’obsolescence. Markdown donne l’ordre des sites, JSON leurs identifiants. [call-errors.bas](../../examples/control-flow/call-errors.bas) affiche **Total 222, Erreurs 2** : 43 états, 18 contextes, 16 transferts dans le modèle courant.

**18 nouvelles assertions firmware positives** : appels imbriqués, auxiliaire rendu, RETURN direct du gestionnaire, RESUME ligne préservant la pile, auxiliaire sans appelant initial, réparation d’une division, trois reprises avec auxiliaire encore empilé, appels dans THEN/ELSE, récursion finie, quatre sélecteurs ON GOSUB, remplacement du gestionnaire et exemple complet. **Deux observations négatives bornées** vérifient l’erreur restée active après RETURN du gestionnaire et la non-réentrée après erreur dans son auxiliaire. Jeu CPC 6128 anglais identifié dans le moteur WASM intégré ; aucune qualification indépendante ou matérielle supplémentaire.

Tests de domaine : séparation des appelants, contexte actif préservé, retours précis, ON hors liste, absence de continuation inventée, profondeur 16/17 et récursion, quotas, exclusions et confidentialité. Chromium vérifie les piles des deux reprises, le lien vers le premier site de la ligne 30, les formats et l’obsolescence. [ADR 0057](../adr/0057-piles-appels-contextes-erreur.md).

Suite : interaction avec les piles de boucles et autres erreurs implicites encore ouvertes ; symboles/usages 0.41 suivent. IDE-076/J2 demeurent partiels.

<a id="qualification-0409"></a>
## Qualification 0.40.9 — Boucles et reprises d’erreur

FOR/NEXT et les appels mêlés à WHILE/WEND rejoignent les contextes d’erreur lorsque la structure est couverte. Chaque état possède maintenant une pile ordonnée de trames d’appel, FOR et WHILE, du plus ancien au plus récent. La pile décrit l’état **avant** l’instruction ou le transfert. `calls` reste la projection des appels ; `stack` expose les objets `{kind: call|for|while, node}`. Le sous-format passe à **flow 7 / errorFlow 4**, sans changer le scope des erreurs ni le rapport englobant. Les variables, conditions et valeurs restent absentes des exports.

| Instruction | Effet dans le modèle qualifié |
| --- | --- |
| FOR / WHILE | Issue d’entrée avec une trame, ou saut initial sans trame |
| NEXT | Recherche son FOR actif, abandonne les boucles plus récentes, puis poursuit le corps ou sort ; aucune réinitialisation du compteur |
| WEND | Recherche son WHILE actif, abandonne les boucles plus récentes et rejoint le test sans conserver cette trame |
| RETURN | Retire le dernier appel et les boucles ouvertes depuis lui ; conserve les boucles de l’appelant et l’erreur active |
| RESUME / RESUME NEXT / RESUME ligne | Conserve la pile courante, y compris les boucles laissées ouvertes par le gestionnaire ; efface l’erreur active |

Une fermeture recherche l’ouverture associée à son emplacement dans le programme : NEXT sans variable ne ferme pas arbitrairement le FOR le plus récemment empilé par le gestionnaire. Une trame GOSUB constitue une barrière pour NEXT/WEND. Les recettes vérifient ERR 1 / ERR 30 lorsque la fermeture est atteinte depuis l’autre côté d’un appel, sans ouverture active ou à un emplacement distinct de la fermeture associée. Le modèle suspend alors ses conclusions ; il ne simule pas ces nouvelles erreurs implicites.

Réentrer directement dans une boucle déjà active, ou ouvrir un FOR avec un compteur potentiellement déjà actif dans le même appel, reste hors périmètre. Cela n’affirme pas que le programme est invalide : deux recettes de réentrée s’exécutent correctement sur le firmware. La garde des compteurs rapproche conservativement les suffixes numériques et les 40 premiers caractères ; elle ne constitue pas une analyse des types ou des symboles. Les boucles traversant les branches IF, fermetures intermédiaires de NEXT à saut initial non qualifié, événements asynchrones et formes opaques conservent leurs limites antérieures.

Le modèle n’évalue ni conditions, ni bornes, ni pas, ni réparations de variables. Une boucle littéralement vraie conserve une issue abstraite de sortie ; les résultats sont des possibilités. Un parcours impossible en pratique peut donc déclencher une garde ou atteindre un budget. Les états incluent l’ordre des trames : les mêmes ERROR et gestionnaire sous des piles différentes ne sont pas fusionnés.

**16 boucles actives et 16 appels imbriqués**, soit 32 trames maximum par état. Les autres plafonds restent 8192 états, 4096 transferts, 131072 transitions parcourues par source et 65536 états multisource. Les quatre types `loop-enter`, `loop-skip`, `loop-repeat`, `loop-leave` consomment le plafond des transferts. Un budget ou une exclusion retire ensemble origines, contextes et transferts ; aucun résultat incomplet n’est conservé. Calcul toujours local, à la demande, avec worker et annulation ; aucune nouvelle analyse à la frappe.

La pile dépliable indique le nombre d’appels et de boucles, puis permet de rejoindre chaque GOSUB, FOR et WHILE à sa colonne exacte. Les listes restent limitées à 100 origines/contextes/transferts ; chaque pile compte au plus 32 liens. L’obsolescence désactive ces liens. Markdown conserve l’ordre avec les étiquettes FOR/WHILE ; JSON conserve les types et identifiants de nœuds.

[loop-errors.bas](../../examples/control-flow/loop-errors.bas) affiche **Total 42, Erreurs 2**. Le FOR appelant survit aux retours de la sous-routine, tandis que son WHILE est abandonné par RETURN. Le gestionnaire utilise une autre boucle FOR terminée avant RESUME NEXT. Le modèle courant explore **30 états, 12 contextes et 15 transferts** ; il représente aussi la sortie abstraite du WHILE littéralement vrai.

**36 nouvelles assertions firmware** : boucles simples, appels et retours anticipés, boucles du gestionnaire équilibrées ou en attente, trois modes RESUME, imbrications mixtes, NEXT sans variable, NEXT multiple, THEN/ELSE, réentrées et fermetures invalides avec code ERR observé. Les attentes sont centralisées dans `tests/fixtures/loop-error-cases.ts`. Le jeu CPC 6128 anglais identifié fonctionne dans le moteur WASM intégré ; aucun octet de firmware publié ni qualification indépendante/matérielle supplémentaire.

Tests du domaine : initialisation FOR distincte des répétitions NEXT, conservation/abandon des trames, appels barrières, piles distinctes au même défaut, gardes, profondeur 16/17, plafond partagé et confidentialité. Chromium vérifie le vrai worker, l’export, les trames FOR/appel/WHILE du RETURN de la ligne 110, la navigation vers le FOR de la ligne 30 et l’obsolescence. [ADR 0058](../adr/0058-piles-boucles-contextes-erreur.md).

Suite : erreurs implicites de pile et autres erreurs implicites, réentrées et franchissements non qualifiés restent au backlog. Le socle borné appels/boucles est disponible ; la prochaine tranche produit est **0.41, symboles et usages**. IDE-076/J2 restent partiels.
