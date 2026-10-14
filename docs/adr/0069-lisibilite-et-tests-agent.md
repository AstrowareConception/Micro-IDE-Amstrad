# ADR 0069 — Lisibilité assistée et suites CPC de l’agent

Statut : accepté. Date : 14 octobre 2026.

## Contexte

Les programmes importés demandent noms explicites, commentaires et organisation. Le BASIC CPC impose types implicites, numéros de ligne, portée des deux-points et dépendances mémoire. Un build DSK ne vérifie pas leur comportement. Les suites existantes exécutent des listings autonomes, sans couverture implicite du programme principal.

## Décision

Ajouter une préparation de mission de lisibilité paramétrable, sans appel fournisseur avant lancement. L’utilisateur peut modifier la consigne et restaurer la précédente. Noms, commentaires, mise en forme et note Markdown sont des demandes à l’agent, soumis aux mêmes lectures, checkpoints et contrôles de révision. L’index textuel borné des symboles devient consultable ; il ne constitue pas un moteur de renommage sémantique. Les fonctions FN ambiguës restent des propositions, le découpage une étude sans déplacement automatique.

Exposer `basic_tests_list` et `basic_tests_run` seulement quand l’adaptateur est disponible, aux projets BASIC. Suites existantes lues avec révision exacte, sources prises dans les buffers de mission ; 5 exécutions par mission, 60 secondes réelles par suite, 1–15 secondes émulées par listing et limites existantes 8 listings/32 assertions. Worker Node jetable par listing, moteur WASM livré, ROM locales privées et contrôlées par le runtime partagé. Le modèle ne reçoit ni chemin hôte ni ROM. Aucun shell ou chargement de module choisi par le modèle.

Les rapports contiennent empreintes et assertions, rejoignent l’historique existant et restent visibles avant/après dans la mission. Une révision différente marque les essais antérieurs. Après une exécution demandée, le dernier résultat de chaque suite exécutée, s’il est non réussi ou périmé, bloque la validation finale. Annulation et délai terminent le worker ; le journal et les changements terminés sont conservés. Une suite n’est jamais présentée comme preuve d’équivalence générale.

## Conséquences et limites

Aucune suite ne référence implicitement les routines d’un autre fichier. Le succès d’une copie de routine ne couvre pas sa source principale. Les tests et attentes peuvent évoluer dans le projet mais la consigne de lisibilité interdit de les affaiblir pour masquer une régression ; aucun oracle sémantique ne garantit la réponse IA. Une transformation de noms/commentaires peut changer consommation mémoire et timing.

Pas de génération de suites, extraction automatique de modules, qualification FN, profilage, pilotage libre du CPC ni tests Z80 dans cette tranche. Les scénarios clavier/écran/fichier déjà présents dans les listings utilisent le runtime existant ; aucune image n’est transmise au modèle. Les preuves firmware indépendantes restent requises pour étendre les capacités annoncées.
