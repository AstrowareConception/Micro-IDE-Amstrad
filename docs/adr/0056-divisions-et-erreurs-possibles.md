# ADR 0056 — Divisions simples et erreurs possibles

- Statut : accepté
- Date : 2026-10-08
- Portée : alpha 0.40.7, REQ-EDT-008 / ACC-36, IDE-076 partiel

## Contexte

Les ERROR explicites seuls ne représentent pas les opérations pouvant échouer pendant un calcul. Simuler toutes les valeurs/types serait un autre projet ; il faut un premier périmètre vérifiable sans annoncer une analyse exacte.

## Décision

Reconnaître les affectations scalaires simples avec deux opérandes (variables non suffixées $ ou entiers décimaux signés ≤ 32767 en valeur absolue), séparés par /, division entière ou MOD ; LET facultatif. Créer un site de division par zéro possible, sans conserver les opérandes et sans calculer le diviseur. Garder l’issue normale et l’issue d’erreur ; réutiliser les frontières de reprise qualifiées en 0.40.6.

Qualifier séparément le comportement sans piège : / émet un avertissement et poursuit l’évaluation, division entière et MOD arrêtent le chemin fautif. Une erreur imbriquée ne réentre pas dans le gestionnaire ; ON ERROR GOTO 0 dans le traitement relance l’erreur. ERROR 11 explicite conserve sa sémantique d’arrêt sans piège. Les conversions et autres erreurs restent hors modèle.

Ajouter sites typés/opérateurs et transfert warning ; flow passe en version 5, errorFlow en version 2, scope explicit-and-simple-division. Les contextes conservent l’instruction fautive et le gestionnaire, sans fusionner artificiellement leurs destinations. Renommer les libellés UI/Markdown pour inclure les affectations. Conserver quotas, annulation, garde d’obsolescence, plafonds d’affichage et suspension des conclusions globales.

## Preuves et limites

[52 assertions positives et neuf observations négatives bornées sur firmware](../implementation/basic-control-flow-alpha.md#qualification-0407), tests de domaine et parcours Chromium complet. Les variantes firmware regroupent les trois opérateurs par démarrage pour limiter le coût de la CI.

Aucune preuve de valeur n’est fournie, même pour un diviseur constant. Les expressions composées, tableaux/fonctions, autres commandes et erreurs implicites, types, piles et événements asynchrones restent ouverts. Aucun nouveau format projet ni qualification matérielle/indépendante supplémentaire.
