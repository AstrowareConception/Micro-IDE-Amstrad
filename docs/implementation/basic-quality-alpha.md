# Qualité du code BASIC — alpha 0.36

Date : 6 octobre 2026. Périmètre : REQ-EDT-008 / ACC-36, IDE-076 partiel. [ADR 0043](../adr/0043-rapport-qualite-basic.md).

## Utilisation

**BASIC → Rapport de qualité BASIC…**, palette ou onglet **Qualité** dans les sorties. Choisir **Source active** ou **Sources chargées**, puis **Générer le rapport**. Les buffers, y compris brouillons et onglets fermés conservés, sont analysés sans écriture. Les fichiers non chargés ne sont pas recherchés sur disque. Le rapport ne se lance ni à l’ouverture de l’onglet ni pendant la frappe.

Le tableau décrit chaque listing indépendamment. Cliquer une remarque ou une autre occurrence rejoint le fichier, la ligne physique et la plage ; le numéro BASIC est aussi affiché. Un onglet fermé dont le buffer est conservé est rouvert lors du saut (garde partagée avec Problèmes). Une modification, suppression ou un renommage rend le rapport obsolète et bloque ses liens jusqu’à un nouveau calcul. Un changement de projet retire le rapport et annule la tâche. Les exports **Markdown** et **JSON** portent la date du snapshot et son état à l’export ; ils contiennent métriques, remarques et couverture, jamais le listing ni des extraits de code.

## Métriques et complexité

Longueurs en **unités UTF-16 du texte source**, pas en octets CPC ni mémoire BASIC tokenisée. Lignes physiques hors dernier séparateur vide, caractères totaux, lignes inspectées, lignes de code, commentaires seuls, lignes vides, segments séparés par deux-points hors chaînes/REM/DATA, maximum des lignes inspectées et moyenne des lignes de code. Les lignes DATA comptent comme segments ; un IF avec instructions THEN/ELSE peut contenir plusieurs actions sans deux-points : le compteur de segments n’est pas un compteur sémantique exhaustif d’instructions.

La **complexité cyclomatique estimée** est `1 + IF + FOR + WHILE + cibles des ON sélecteurs` pour un listing contenant du code (zéro sinon). Un sélecteur avec N cibles a N destinations et une issue de continuation hors intervalle ; N branches supplémentaires sont donc comptées. `ON ERROR`, `ON BREAK`, `ON SQ`, simples GOTO/GOSUB et AND/OR n’ajoutent pas de décisions dans cette formule. Les listes ON non reconnues, calculées ou intégrées dans une branche composée annoncent une contribution omise. La formule est un indicateur lexical, **pas un calcul exact du graphe de contrôle** : ni routines GOSUB indépendantes, ni événements, erreurs, CALL/RSX, RUN/CHAIN et sauts calculés ne sont reconstruits. Syntaxe invalide et instructions inaccessibles peuvent gonfler ou réduire la pertinence de l’estimation. Aucun total entre programmes ni seuil arbitraire de mauvaise complexité.

Référence de la distinction : [NIST SP 500-235, Structured Testing (1996)](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication500-235.pdf), §2 et §4 : la métrique exacte appartient au graphe de contrôle ; les raccourcis dépendent de la structure analysée. Le [manuel Amstrad CPC 6128, ON GOTO, chapitre 3 p. 52](https://www.manualslib.com/manual/851404/Amstrad-Cpc-6128.html?page=171) précise notamment la continuation du sélecteur nul ou dépassant la liste ; les erreurs d’argument restent hors graphe. Les formes BASIC sont aussi documentées dans le [corpus local](../../knowledge/locomotive-basic/README.md). L’estimation livrée est notre choix conservateur de produit, pas une certification NIST ou ROM.

## Règles livrées

| Code | Détection | Interprétation et limite |
| --- | --- | --- |
| `long-line` | Ligne de code > 120 caractères | Observation de longueur ; répartir seulement après examen de la portée IF/THEN/ELSE |
| `dense-line` | Plus de 4 segments sur une ligne | Observation de densité ; la compacité peut être intentionnelle sur CPC |
| `conditional-density` | Plus de 2 IF sur une ligne | Piste de revue des conditions/ELSE ; aucun calcul de profondeur de routine |
| `duplicate-block` | Deux lignes physiques de code consécutives répétées, au moins 12 tokens combinés | Numéros, espaces, casse des mots et commentaires ignorés ; chaînes préservées exactement ; DATA exclu ; extraction GOSUB à examiner, jamais automatique |
| `unreachable-tail` | Segment après GOTO à cible décimale littérale ou RETURN nu, sur une ligne sans IF/ON/THEN/ELSE | Piste limitée au flux normal de cette ligne ; pas de conclusion globale. END/STOP exclus car CONT peut poursuivre, DATA suivant exclu |

Les repères figurent dans l’UI et les exports, non configurables dans cette tranche. Pas d’interdiction de GOTO, POKE, OUT, CALL ni des variables courtes. Pas de faux diagnostic de variable non initialisée : les valeurs implicites BASIC et événements exigent une analyse distincte. Aucune suggestion ne modifie le code.

## Bornes, couverture et exécution

- Lot : 100 sources, 4 Mio de caractères au total ; dépassement refusé avant transfert au worker.
- Source : 1 Mio de caractères, 10 000 premières lignes physiques ; ligne : 8192 caractères et 2048 tokens. Source trop grande non analysée ; lignes trop grandes/tokenisées, numérotation invalide/non croissante ou chaîne ouverte ignorées et signalées.
- Résultats : 500 remarques par source, 20 autres occurrences par duplication ; omissions comptées. UI : 200 premières remarques filtrées ; exports de tous les résultats conservés.
- Un worker par demande, maximum 15 s ; terminaison et retrait des callbacks sur toutes les sorties. Annulation et échec permettent un nouvel essai explicite. Les réponses d’une demande abandonnée ne sont pas acceptées.

Le nombre de lignes inspectées inclut les lignes lues lexicalement mais exclut celles trop longues/tokenisées ; les métriques de code excluent aussi les lignes invalides annoncées. Le maximum porte sur les lignes inspectées, y compris commentaires. Le rapport est marqué partiel dès qu’une contribution/ligne/résultat est omis. Une source sans remarque n’est pas certifiée de bonne qualité.

## Vérification

253 tests Node passent, dont sept nouveaux scénarios de métriques, sélecteurs/événements, chaînes/REM/DATA, CONT, duplication sensible aux chaînes, quotas et export sans code. Typecheck strict et build desktop passent. Le scénario navigateur ajouté à `test:editor` couvre demande active/multisource, absence d’analyse au repos/pendant la frappe, navigation intersource, snapshot obsolète, deux exports, annulation, erreur worker, nouvel essai et terminaison. Le parcours navigateur complet puis la recette ciblée finale passent sur Chromium Linux. Cette dernière couvre aussi réponse abandonnée, timeout injecté et changement de projet avec les mêmes IDs de source. La CI Linux/Windows est consignée dans la PR de l’incrément.

## Évolution 0.40

Le [premier lot d’analyse de flux](basic-control-flow-alpha.md) complète les métriques historiques ci-dessus avec un graphe structurel, des résumés par entrée, des appels/cycles et la règle `unreachable-flow`. Le rapport JSON devient version 2. Les limites de la 0.36 décrivent le socle initial ; les formes et limites nouvelles sont détaillées dans le guide 0.40.

## Suite IA et analyses plus précises

Le socle fonctionne hors réseau et sans clé. La revue IA/agents n’est pas livrée dans cette tranche. La suite pourra fournir au modèle choisi les métriques et passages explicitement sélectionnés, avec références BASIC, limites et budget. Les explications contextuelles resteraient distinguées des mesures reproductibles ; toute correction utiliserait les checkpoints et préconditions de mission existants. Un graphe de contrôle et la qualification sur corpus/ROM précéderont une complexité exacte par routine, une détection globale de code mort ou une preuve de terminaison.
