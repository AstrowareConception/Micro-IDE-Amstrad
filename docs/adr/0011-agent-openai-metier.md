# ADR 0011 — Agent OpenAI à outils CPC, tranche indépendante

Statut : acceptée pour l'alpha 0.6. Date : 2026-10-03.

## Besoin et décision

La demande du 3 octobre précise une expérience comparable à Codex dans JetBrains, avec clé API OpenAI : prompt, exploration, mutations de fichiers, essais et retour arrière. L'alpha 0.6 réalise le premier périmètre BASIC en avance sur J5 complet, à la demande produit. Elle ne clôture ni J4 multimodal ni J0 moteur.

Le choix reste OpenAI Responses API, derrière le port fournisseur. Ce n'est pas l'embarquement du plugin JetBrains ou du binaire Codex officiel. Leur expérience est la référence ergonomique ; l'orchestrateur local et les outils métier du document 14 portent les droits réels. L'adaptateur utilise `fetch` fourni par Node 24, sans nouvelle dépendance. Le modèle par défaut est le snapshot `gpt-5.4-2026-03-05`, configurable ; son accès dépend du compte API.

Le main possède clé de session, projet et contrôleur. Le renderer dispose de start/status/cancel/steer/restore et d'une configuration sans retour de secret. Aucun shell, terminal hôte, MCP distant ou URL fournisseur arbitraire. Une mission peut transmettre ses sources déclarées et les extraits de corpus consultés ; le panneau expose ce périmètre avant démarrage.

Les appels d'outils sont sérialisés et validés localement. Lecture avec hash, consultation de fiches, création, remplacement, analyse et construction utilisent les domaines existants. Les modifications sont enregistrées automatiquement et synchronisées dans Monaco ; aucun bouton d'application de chaque fichier n'est requis.

## Checkpoints et garanties exactes

Un checkpoint initial et un état `prepared` précèdent les écritures, hors projet dans les données applicatives. Les drafts initiaux et leurs versions disque sont distincts. La publication de sources et manifeste utilise écritures individuelles atomiques, rollback en cas d'erreur observée et blocage de l'adaptateur si le rollback échoue. Le processus interdit les autres commandes disque pendant une mission.

La restauration de la mission courante vérifie les buffers et les hashes disque avant retour à l'état initial. Les sources créées par cette mission sont retirées ; les drafts initiaux retrouvent leur état modifié, sans être assimilés à la version disque. Les fichiers préexistants ne sont pas supprimables par le modèle.

Cette livraison n'est **pas** le journal transactionnel/crash recovery complet J1-03/J5-04 : pas de reprise automatique après crash, de fsync garanti, de verrou interprocessus ou de replay durable des `callId`. L'idempotence des appels est assurée seulement dans la boucle en mémoire. Le checkpoint est conservé pour une récupération manuelle prudente ; sa présence ne rend pas le renommage multifichier atomique.

## Conséquences

La clé n'est ni persistée ni transmise au renderer après configuration ; la saisie password est vidée. Le stockage protégé OS et la rétention/effacement d'historique viendront ensuite. Aucun retry facturable automatique en cas de réseau ambigu. Les quotas bornent chaque mission et les réponses complètes sont validées avant appel d'outil.

Le mode Agent seul, sans pause/reprise ni modes Revue/Explication, est livré ici. Avant/après, arrêt, consigne de suivi à une frontière sûre et restauration sont disponibles. Pièces jointes, conversion d'images et outils de machine restent absents, clairement annoncés. Une construction sans erreur ne vaut jamais exécution CPC. Les essais avec transport contrôlé ne prouvent pas une génération OpenAI réelle ; une clé utilisable et une mission volontaire seront nécessaires pour cette dernière recette.

Références primaires consultées le 3 octobre : [function calling](https://developers.openai.com/api/docs/guides/function-calling), [reasoning](https://developers.openai.com/api/docs/guides/reasoning), [modèle GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4). Cette ADR précise l'implémentation indépendante ; elle ne remplace pas les exigences finales de l'ADR 0005.
