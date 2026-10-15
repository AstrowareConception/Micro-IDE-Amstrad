# ADR 0073 — Premier renommage de variables BASIC avec aperçu

- Date : 2026-10-15
- Statut : accepté pour 0.41.14
- Périmètre : IDE-017 partiel

## Contexte

L’index textuel et la navigation au curseur ne prouvent pas toutes les identités du langage. Les témoins FN ont montré des dépendances aux types actifs, aux appels et aux redéfinitions. Un remplacement global risquerait aussi de confondre scalaire/tableau, texte et code. La lisibilité assistée doit disposer d’une première mutation déterministe explicite et réversible sans prétendre résoudre ces cas.

## Décision

Limiter F2 à une variable ou un tableau d’un fichier autonome ASCII, lancé depuis le début sans état antérieur. Refuser FN, DEFINT/DEFREAL/DEFSTR, alias suffixés du nom sélectionné, accès machine/mémoire/temps et état externe reconnus. Exiger un index complet et une correspondance de chaque identifiant lexical à une position indexée, puis valider le listing par le codec BASIC existant avant et après transformation. Le domaine reste TypeScript pur, sans Monaco ni accès disque.

L’identité retenue est nom insensible à la casse + suffixe + nature scalaire/tableau. Tous les usages de cette identité doivent être présents. Un nouveau nom, sans suffixe, est limité à 40 lettres/chiffres ASCII et ne doit ni être réservé ni commencer par FN. Toute collision de radical avec un nom existant est refusée, même dans une autre catégorie. Un changement de casse seul n’est pas une transformation d’identité. Les suffixes, espaces et caractères hors des occurrences restent identiques ; le scalaire et son tableau homonyme ne sont pas fusionnés.

Budgets : 65 535 caractères de source, 255 par ligne avant/après, 2 000 occurrences. Les positions sont physiques (ligne 1-based, colonne UTF-16 0-based, fin exclue). Les limites des collecteurs existants restent applicables. Les erreurs sont des refus explicites, jamais des transformations partielles.

## Cycle de vie et interface

Une demande capture projet, document, nom, texte, URI du modèle et version Monaco. L’analyse initiale et la préparation du plan utilisent un worker jetable, annulable, séquencé et limité à 15 secondes. La saisie du nouveau nom retire le plan mais ne lance pas de calcul. Le panneau non modal montre les deux listings et les 100 premières positions, avec total exact.

L’application vérifie à nouveau texte et révision du modèle, puis utilise les plages exactes entre deux bornes d’annulation. Une modification suivie d’undo invalide toujours l’ancien aperçu. Un changement de projet ou de document interdit l’application sur la mauvaise source. Les réponses annulées/tardives ne réactivent pas le plan. L’action modifie uniquement le buffer ; sauvegarde et export restent explicites.

Aucun outil agent, droit documentaire, contrat SymbolReport ni obfuscateur n’est modifié. Les traitements IA existants restent soumis à leurs checkpoints et tests. Renommer les FN, résoudre les types dynamiques et propager entre fichiers demandent des décisions supplémentaires.

## Preuves et conséquences

[Guide et matrice](../implementation/basic-variable-rename-alpha.md). Tests de domaine, parcours Chromium avec vrai worker et huit couples de programmes sur le firmware CPC 6128 anglais identifié. Les attentes après transformation sont écrites indépendamment du plan ; les 16 verdicts sont bloquants en CI Linux. L’instrumentation mémoire du banc est ajoutée après le plan et n’élargit pas le profil de production.

Les noms influencent taille mémoire et temps ; l’outil le signale et demande de tester le programme. Les témoins prouvent des cas précis, pas l’équivalence de tout programme ni une qualification matérielle. Suite : étendre la résolution des identités à partir de témoins discriminants, puis FN/types dynamiques, avec les mêmes gardes d’aperçu et d’annulation.
