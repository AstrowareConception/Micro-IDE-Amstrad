# ADR 0036 — Reprise, résultats d’outils et consommation agent

Date : 6 octobre 2026. Statut : accepté pour l’incrément 0.29. Complète les ADR 0011, 0026 et 0031.

## Problème

Une mission graphique a atteint douze tours sans changement visible. Les résultats/erreurs d’outils étaient masqués à l’utilisateur. La recherche retournait des fiches complètes sans les compter comme consultées ; une mutation pouvait être refusée ensuite. L’état de conversation était perdu à la limite. Un total de tokens seul ne permet pas d’estimer correctement la facture.

## Décision

Reconnaître les fiches effectivement fournies et ajouter une lecture groupée bornée. Conserver hashes, scopes, garde documentaire et persistance existantes. Restituer des résultats utiles sans exposer le contenu documentaire/image ni le raisonnement opaque.

Le runner possède un état fourni par le contrôleur : conversation, appels en attente, idempotence, erreurs et compteurs. Chaque reprise volontaire accorde un budget supplémentaire ; elle vérifie buffers/projet/disque et conserve le checkpoint initial. Limite de contexte/stagnation impose une nouvelle mission ; dix continuations maximum. Conversation en mémoire uniquement ; la récupération des écritures après crash reste celle de l’ADR 0026. Aucun journal de clé/conversation ajouté au projet.

Une fenêtre de réglages distincte contient clé, catalogue dynamique, budgets et tarif. Cumuler les consommations reçues, même pour réponses incomplètes/tardives connues. Le provider demande le service standard et ne retry pas automatiquement. Calculer le coût par réponse : cache lu/écrit, contexte long, sortie incluant raisonnement. Charger la fiche publique officielle sans clé, avec parsing strict et date ; format inconnu, tier différent, alias effectif inconnu ou données manquantes désactivent l’estimation. La facture OpenAI reste l’autorité.

## Conséquences et vérification

Les ports UI exposent budget/vue/usage/pricing/reprise ; le domaine reste sans Electron, réseau ou provider. Les [specs 18](../specifications/18-increments-ide-production.md) et [19](../specifications/19-agent-experience-consommation.md) détaillent critères et suite. Aucun outil RUN/capture CPC n’est accordé à l’agent.

Tester garde des références, pause/reprise à douze tours, file d’appels et rejeu/collision, progression/erreurs, coût/cache/contexte long, réponse incomplète/tardive, préconditions buffers/disque, restauration, dialogue UI et routes Electron/fichiers réels. Les recettes contrôlées ne prouvent pas la qualité artistique d’un modèle réel.
