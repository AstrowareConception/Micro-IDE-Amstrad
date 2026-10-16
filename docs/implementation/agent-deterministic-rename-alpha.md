# Renommage déterministe dans les missions IA — alpha 0.41.17

## Objectif

Jusqu'à la 0.41.16, l'agent pouvait suggérer une meilleure dénomination, mais appliquait généralement les modifications par `project_replace_source`. L'utilisateur disposait déjà d'un renommage sûr par F2, sans que l'agent l'exploite directement.

Cette tranche expose **le moteur de renommage BASIC existant** à l'agent par deux opérations distinctes :

- `language_rename_preview` : prépare un plan **sans aucune écriture** ; paramètres : ID réel de fichier, SHA-256 du buffer lu, position physique du curseur (ligne à partir de 1, colonne à partir de 0) et nouveau radical de nom.
- `language_rename_apply` : applique **le plan préalablement obtenu**, identifié par son jeton `previewId`, uniquement si l'ID, le contenu, le hash et l'état du projet sont restés identiques. L'application passe par la persistance contrôlée habituelle du projet, avec checkpoint de mission et invalidation de la construction DSK antérieure.

Les résultats exposent l'identité et la portée du symbole, les positions substituées, les avertissements, le SHA-256 avant/après et un aperçu borné du listing. Les entrées du panneau **Renommages BASIC contrôlés** affichent l'avant/après, le nombre de substitutions et le statut : préparé, appliqué ou périmé.

L'agent reçoit l'instruction de **préférer cette séquence à une réécriture libre** et de ne pas contourner un refus d'ambiguïté par remplacement aveugle. Les entrées de prévisualisation sont limitées en nombre et en volume ; seules les informations nécessaires apparaissent dans l'interface. Chaque mutation doit toujours être suivie d'une construction DSK puis, si possible, de suites CPC portant sur les vraies sources modifiées (contrôle 0.41.16).

## Prérequis et restrictions

Les mêmes restrictions que F2 restent en vigueur : aucun renommage partiel d'une identité ambiguë, de formes opaques, de variables sous directives de types dynamiques, de redéfinitions FN non qualifiées ou d'interactions machine susceptibles d'affecter la résolution. Les suffixes BASIC `$`, `%` et `!`, les chaînes, les instructions DATA et les numéros de ligne sont préservés par le moteur dans les profils admis.

La consultation préalable des fiches de commandes BASIC demeure nécessaire pour enregistrer le fichier. L'agent ne peut pas appliquer un aperçu inexistant, issu d'un autre fichier, remplacé, périmé ou portant sur une ancienne révision. Les scripts provenant de projets binaires Z80 n'obtiennent pas ces outils BASIC.

**Approbation et restauration :** les opérations restent soumises à l'autorisation générale donnée lors du lancement de la mission IA. L'aperçu fait partie du journal visible, **ce n'est pas encore une validation manuelle obligatoire pour chaque renommage**. Les modifications sont enregistrées et restaurables au moyen de **Restaurer le checkpoint initial**, avec les mêmes préconditions de révision que les autres mutations agentiques.

## Limites et suite

Ce lot ne livre ni renommage multifichier ni équivalence comportementale prouvée. Les noms plus longs peuvent changer la consommation mémoire et les temps d'exécution. Il n'apporte pas non plus de formatage global ni de découpage automatique du code. Les refus explicites du moteur F2 sont conservés. Un aperçu n'est pas un test CPC ; l'absence de suites reste signalée.

Suite recommandée : amélioration de la présentation et des commentaires, puis protocole de découpage multifichier compatible avec le firmware et les chargements disque.
