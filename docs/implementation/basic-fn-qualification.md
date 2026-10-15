# DEF FN — qualification préalable des identités

Date : 15 octobre 2026. Tranche de qualification après 0.41.11, avant l'extension de l'index. [ADR 0070](../adr/0070-qualification-fn-avant-renommage.md). Lors de cette tranche, l’interface et le rapport Symboles version 2 conservaient leurs exclusions FN. La [vue FN 0.41.12](basic-symbols-alpha.md#fonctions-fn-et-parametres--04112) exploite désormais ces témoins ; aucun renommage de fonctions n’est livré.

## Pourquoi ces essais

La [référence fournie](../../knowledge/locomotive-basic/originals/command-reference.txt), lignes 60–61, donne `DEF FN name(parameters)=expression`. Elle ne suffit pas à établir les portées, les alias de type ou les erreurs. Les listings originaux de cette tranche discriminent ces hypothèses sur le jeu ROM déjà identifié ; ils ne sont pas une nouvelle grammaire exhaustive.

Une attente expérimentale réfutée n'est pas masquée : le premier passage a montré que la variable libre d'une fonction imbriquée ne lit pas le paramètre homonyme de l'appelante. Des sondes RAM ont confirmé le résultat 104 et la globale 99. Il a aussi montré les erreurs 2 d'arité, le contrôle différé d'une liste de paramètres vide et l'affectation partielle avant l'erreur d'un appel vide. Deux témoins supplémentaires sur les appels répétés ont révélé la séquence 6/102/103 décrite ci-dessous, confirmée par sondes RAM ; sa cause interne n’est pas qualifiée par ces seuls essais. Ces observations sont devenues des assertions précises de non-régression, conservant les échecs comme verdicts bloquants.

## Matrice de comportement

Les identifiants ci-dessous correspondent aux cas de [basic-fn-cases.ts](../../tests/fixtures/basic-fn-cases.ts). Chaque listing indépendant vérifie ses valeurs, ERR et ERL, puis écrit la signature de fin. Les nombres et chaînes sont des témoins, pas une affirmation sur toutes les valeurs possibles.

| Famille et cas | Résultat attendu sur le profil identifié | Conséquence pour l'index futur |
| --- | --- | --- |
| `zero-arguments`, `one-argument`, `multiple-arguments`, `case-and-space` | Fonction sans parenthèses : 42 ; un argument : 14 ; trois arguments : 321 ; casse et espace après FN acceptés | Distinguer fonction et scalaire, reconnaître les deux écritures FN |
| `global-restored`, `nested-local`, `argument-before-binding` | Globale 99 conservée ; appels imbriqués : 11 ; second argument lu avant liaison des paramètres : 110 | Paramètres propres à chaque définition, arguments dans le contexte appelant |
| `free-variable-live`, `nested-free-variable` | Variable libre relue après changement global : 12 puis 22 ; appel imbriqué : 104 avec globale 99 | Ne pas associer une variable libre au paramètre homonyme de l'appelante |
| `scalar-array` | Paramètre scalaire 3 + tableau global 7 = 10 ; scalaire global 99 conservé | Ne pas confondre paramètre scalaire et tableau homonyme |
| `explicit-integer`, `explicit-real`, `explicit-string`, `typed-homonyms` | 14 entier, 1,5 réel, chaîne `[local]` ; deux suffixes homonymes restent distincts | Conserver les suffixes dans les identités |
| `implicit-real-alias`, `implicit-integer-alias`, `implicit-string` | Paramètre sans suffixe associé à son type implicite courant ; aliases explicites lus dans le corps | Le texte seul ne sépare pas toujours deux noms suffixés/non suffixés |
| `function-variable-distinct`, `function-suffixes`, `function-default-letter` | Scalaire et fonction distincts ; variantes `%`, `!`, `$` séparées ; DEFSTR V concerne FNvalue | La lettre de type appartient au nom de fonction, hors préfixe FN |
| `parameter-type-at-call`, `parameter-alias-after-type-change` | Après DEFINT X, le paramètre implicite utilise l'entier ; `x+x!` donne 102, globals 7/99 préservés | Ne pas figer le type implicite au seul site textuel de définition |
| `parameter-type-between-calls`, `parameter-type-same-call-site` | Appels avant DEFINT X, après DEFINT X, puis après DEFREAL X : **6, 102, 103** ; boucle au même site : 6 puis 102 | Contre-exemple à une résolution naïve refaite uniquement selon le dernier DEF* ; garder cette situation ambiguë |
| `function-type-at-call`, `explicit-call-after-type-change` | Après DEFINT V, FNvalue devient introuvable (18/40) ; FNvalue! retrouve 42 | Un appel implicite peut changer d'identité sans nouvelle définition |
| `redefinition`, `skipped-redefinition`, `definition-after-call-text`, `changed-arity` | 4 puis 5 ; définition sautée sans effet ; définition atteinte par GOSUB utilisée ; nouvelle arité utilisée | L'ordre textuel ne prouve pas quelle définition est active |
| `duplicate-parameters` | Deux paramètres `x,x` sont acceptés dans ce témoin ; le dernier donne 7, globale 99 préservée | Forme ambiguë à exclure d'un premier renommage, malgré son exécution |

## Erreurs et effets partiels

Notation : `ERR / ERL`. Les lignes sont celles des fixtures, sans extrapoler leur attribution à tous les contextes.

| Cas | Observation vérifiée par l'assertion |
| --- | --- |
| `undefined`, `skipped-definition` | Fonction introuvable : 18/30 et 18/40 ; résultat inchangé |
| `too-few-arguments`, `too-many-arguments` | Erreur de syntaxe 2/40 ; résultat inchangé |
| `argument-type-error`, `result-type-error` | Erreur de type 13/40 ; résultat inchangé ; globale préservée dans le cas d'argument |
| `empty-definition-not-called`, `empty-parameter-list` | DEF FNvalue()=1 n'échoue pas au seul passage sur la définition ; l'appel testé provoque 2/40, sans résultat |
| `empty-call-list` | FNvalue sans paramètre suivi de `()` : 2/40, mais la cible a déjà reçu 1 |
| `body-error-restores-parameter` | MOD 0 dans le corps : 11/40 ; globale 99 préservée après RESUME vers le point de contrôle |

Une erreur BASIC ne prouve donc pas que l'instruction n'a eu aucun effet. La forme vide n'est pas à présenter comme une syntaxe valide ; son comportement différé fait partie de la qualification négative.

## Exemple à lire et exécuter

[functions.bas](../../examples/symbols/functions.bas) montre une fonction interne dont `x` est libre et une fonction externe dont `x` est un paramètre. Il affiche **Resultat 104 Globale 99**. Le calcul est `(99 + 2) + 3`. Renommer uniquement le paramètre externe ne doit pas modifier le `x` libre de la fonction interne. L'exemple est aussi exécuté par la recette.

Le panneau Symboles actuel reste partiel sur ce fichier : les définitions et appels FN y sont omis. Cette distinction entre résultat firmware et capacité disponible dans l'IDE est volontaire.

## Reproduire et contrôler la preuve

Après installation des dépendances et construction du moteur Emscripten **4.0.15** verrouillé :

```sh
CPC_TEST_ROM_DIR=/chemin/vers/roms npm run test:basic-fn
```

Le répertoire doit contenir `cpc6128_os.bin`, `cpc6128_basic.bin` et `cpc6128_amsdos.bin`. Le runtime compare les trois empreintes à `BASIC_TEST_FIRMWARE` avant toute qualification et vérifie le prompt Ready ; une autre ROM produit un blocage, jamais un succès.

[qualify-basic-fn.mjs](../../scripts/qualify-basic-fn.mjs) exécute **41 témoins et un exemple**, chacun dans une machine neuve, avec un budget de trois secondes émulées après RUN. Un délai, une assertion fausse, un résultat bloqué ou invalide fait échouer la commande. Le rapport `out/basic-fn-qualification.json` porte l’empreinte du moteur, son verrou de dépendances, les empreintes des fixtures, de chaque source et DSK, les codes/numéros d'erreur observés et les verdicts. Aucun octet ROM n'y est copié. La CI Desktop Linux conserve ce rapport comme artefact et garde la recette bloquante.

La version applicative reste **0.41.11**. Voir le [point de reprise](../reprise.md) pour les exécutions effectivement terminées et l'état de publication.

## Limites et suite

Cette matrice qualifie les témoins sur le CPC 6128 anglais **du moteur intégré**. Ni nouvelle preuve sur matériel, ni comparaison avec un émulateur indépendant, ni qualification 464/664/Plus. Récursion/débordement, interruptions pendant FN, appels machine et modification du programme, mélanges de chargements, conversions numériques limites et toutes les syntaxes non testées restent ouverts.

Prochaine tranche : index FN borné, fonctions/paramètres/variables libres distingués, liens prouvés et ambiguïtés visibles, quotas et snapshots conservés ; puis accès depuis le curseur et renommage avec diff, collisions, contrôle de révision et annulation. Les témoignages positifs ne suffisent pas à annoncer une résolution sémantique universelle. IDE-015 reste partiel et IDE-017 non réalisé.
