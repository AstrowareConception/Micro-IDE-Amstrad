# ADR 0005 — Programmation agentique avec outils métier

Statut : acceptée, révisée en version 0.2. Date : 2026-10-03.

## Contexte

L'utilisateur veut une programmation agentique comparable à un assistant de code intégré dans un IDE : le prompt déclenche exploration, création et modification des fichiers, utilisation des ressources, construction et tests. Une interaction limitée à des propositions à appliquer manuellement ne satisfait pas ce besoin. Les références Locomotive BASIC doivent guider effectivement le code.

## Décision

Le mode principal est Agent. Un runner local orchestre appels d'outils typés et fournisseur de modèle. Les opérations locales réversibles autorisées par la mission sont exécutées automatiquement, avec hashes, journal, checkpoints et budgets. L'agent consulte le corpus BASIC, construit, exécute dans le CPC émulé, observe et corrige. Un diff cumulé et la restauration rendent le travail contrôlable. Revue et Explication sont des modes optionnels.

## Options considérées

La revue obligatoire avant chaque fichier ralentit le parcours demandé et reste disponible comme préférence. Un terminal hôte libre n'est pas nécessaire pour manipuler un projet CPC : des outils métier offrent lecture, édition, conversion, analyse, build et machine. Un simple chat avec copier/coller ne fournit pas ce parcours ni ses garanties de reprise.

## Conséquences

Prévoir AgentTask, ToolCall, TaskCheckpoint et journal idempotent. Le scope de mission couvre lectures et transmissions progressives ; pas de confirmation répétée pour les fichiers déjà autorisés. Une consigne de suivi prend effet à une frontière sûre. Les boucles sont normales mais bornées, et les tests doivent reposer sur des résultats d'outils. Les documents ne peuvent pas élargir les permissions. Les opérations extérieures et non réversibles restent hors des droits locaux courants.

Cette révision remplace la politique initiale qui imposait la revue de chaque proposition comme mode principal. L'historique Git conserve cette décision précédente ; les autres choix techniques sont inchangés. Une nouvelle intégration fournisseur, y compris Codex, devra satisfaire le même contrat de missions et capacités.
