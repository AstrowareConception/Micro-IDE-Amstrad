# ADR 0041 — Analyse BASIC en worker et monitoring à la demande

Statut : acceptée pour l’alpha 0.34. Date : 6 octobre 2026. Complète [ADR 0030](0030-atelier-menus-diagnostics.md).

## Contexte

Le renderer analysait la source active à chaque frappe et la lexait deux fois. Complétion et F12 reconstruisaient également l’index complet sur le thread de l’interface. Les diagnostics des autres sources étaient invisibles ; aucune mesure ne permettait de distinguer analyse, attente et réactivité de l’interface.

## Décision

- Un worker de module analyse les buffers après 200 ms de pause. Un seul travail en vol, source active prioritaire, demandes remplacées par la dernière révision. La comparaison de contenu dans le rendu retire immédiatement les anciens résultats ; la révision protège réception, undo et changement de projet.
- Le worker partage une lexification entre analyse des lignes et inspection syntaxique, avec cache LRU par texte exact de ligne. Les références, ordre des lignes et diagnostics sont toujours recalculés pour le listing courant : aucune sémantique globale périmée n’est mise en cache.
- La coloration conserve son lexer local, limité à 8 192 caractères / 1 024 tokens par ligne. Complétion et navigation utilisent l’index du worker associé à la version Monaco. La navigation explicite peut attendre un résultat pendant 2 s, sans polling ; changement de version ou destruction du modèle annule cette attente.
- Les sources sont inspectées indépendamment. Marqueurs par modèle, une icône de gouttière par ligne, badge d’onglet et liste globale filtrable. F8/Maj F8 traversent aussi les sources ; sélection de la plage avec protection du contenu attendu.
- Une panne ou un travail de plus de 5 s termine/recrée le worker, signale les sources en attente et attend une relance humaine. Aucun fallback synchrone ni boucle automatique de redémarrage. La fenêtre masquée suspend les nouvelles demandes ; un travail déjà envoyé peut terminer.
- Performance expose les compteurs/durées du worker. Un observateur des tâches longues et un minuteur de 1 s fonctionnent uniquement pendant l’affichage du panneau dans une fenêtre visible ; déconnexion/arrêt à fermeture, changement d’onglet ou destruction. Aucun polling BASIC au repos, stockage ou envoi de mesures.

## Bornes et limites

64 sources ; par source, 1 048 576 caractères UTF-16 / 10 000 lignes, 8 192 caractères / 2 048 tokens par ligne, 500 diagnostics, 100 zones détaillées et 4 096 variables. Une source au-delà de la limite de caractères est tronquée à limite + 1 avant transfert au worker, pour produire un avertissement de suspension sans copier tout le buffer. Les buffers originaux restent intacts. Le cache partagé retient au plus 50 000 tokens, 2 097 152 caractères et 10 000 lignes exactes. Complétion bornée à 1 000 cibles et 256 variables ; F12 conserve l’index complet.

La grammaire est une inspection structurelle partielle, pas une certification ROM. Productions opaques, profondeurs non couvertes et saturation sont visibles. Les corps IF simples sont inspectés ; association ELSE des IF imbriqués, sorties formatées, définitions FN et RSX restent partiels. Types, arité des fonctions, piles de contrôle et états matériels ne sont pas déduits. Le chemin d’export conserve son analyse de domaine et sa politique ASCII ; l’inspection additionnelle de l’éditeur ne le remplace pas.

Les durées de calcul excluent temporisation, démarrage et transport du worker. Le monitoring de réactivité mesure retard du minuteur et tâches de plus de 50 ms, sans prétendre mesurer pourcentage CPU ou mémoire totale du processus. Les coûts des autres panneaux et de l’émulateur restent distincts.

## Vérification

Corpus positif/négatif, cache comparé à une analyse fraîche après insertion/suppression de cible, limites et expressions profondes ; ordonnanceur déterministe pour frappe rapide, undo, retrait de source, visibilité, panne, réponse d’un worker terminé et repos sans timer. Index Monaco versionné, navigation et cleanup. Recette navigateur globale et dédiée : filtres, sources, plages, undo/redo, cache, absence d’analyse au repos, démontage du monitoring, panne/reprise explicite. Benchmark reproductible et limites dans le [rapport](../implementation/basic-diagnostics-alpha.md).
