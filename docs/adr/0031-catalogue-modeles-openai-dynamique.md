# ADR 0031 — Catalogue OpenAI dynamique pour l’agent

Statut : acceptée pour l’alpha 0.25. Date : 2026-10-06.

## Contexte

L’utilisateur devait saisir un identifiant de modèle dans un input. Une liste figée dans une release deviendrait obsolète et ne refléterait pas les permissions de sa clé.

## Décision

Le processus main interroge `GET https://api.openai.com/v1/models` avec la clé de l’utilisateur, à la connexion, à la demande, puis automatiquement toutes les 15 minutes au repos/reprise de focus. Aucun catalogue distant tiers, scraping HTML ou liste statique de modèles dans le renderer. Le chargement initial ne conserve la nouvelle clé qu’après succès ; clé et catalogue restent en mémoire.

Le select propose les familles GPT numériques, o numériques et Codex accessibles, par date de création décroissante. Audio, realtime, transcription, recherche spécialisée, modèles hors familles candidates et modèles dont `shutdown_date` est passé sont exclus. Les nouvelles générations GPT entrent sans modification de la liste. Les retraits annoncés figurent dans les options.

Une connexion neuve exige un choix explicite. Le main valide le modèle choisi dans le dernier catalogue ; le changement de modèle conserve la clé sans la renvoyer au renderer. Actualiser conserve une sélection toujours présente. Une disparition oblige à choisir un autre modèle. Une erreur réseau conserve la dernière liste avec son horodatage et un message d’échec ; aucun catalogue hors ligne n’est présenté comme actuel.

## Limites et invariants

L’endpoint officiel décrit disponibilité, propriétaire et date de création, sans contrat de capacités Responses/tool calling/vision. Le filtre de familles est une candidature, pas une certification. Les erreurs de capacités sont retournées lors de la mission, sans retry facturé. Aucune requête Responses n’est faite pour sonder les modèles pendant le chargement.

Endpoint fixé, redirections refusées, timeout 15 s, réponse limitée à 1 Mio, validation/déduplication des entrées. Les erreurs ne recopient jamais le corps fournisseur ni la clé. Une lecture retardée ne peut restaurer une configuration oubliée/modifiée. La mission active empêche le changement/actualisation. Le mode aperçu sans port main affiche le select indisponible avec explication.

## Preuves et référence

Tests du transport et du contrôleur : endpoint/headers/cache, nouveautés, filtres, retrait, données invalides, quota de réponse, secret, sélection explicite, copies défensives et course avec oubli. Recette UI : select, choix, actualisation, nouveauté, conservation après panne et oubli. Recette Electron : liste officielle simulée dans main puis mission réelle à transport contrôlé.

Référence consultée le 2026-10-06 : [OpenAI API — List models](https://developers.openai.com/api/reference/resources/models/methods/list). Aucun appel à un compte OpenAI réel dans les recettes automatisées.
