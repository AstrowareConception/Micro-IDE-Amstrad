# ADR 0064 — Agent Z80 sur zones enregistrées et comparaison des copies

- Statut : acceptée pour la tranche 0.41.6.
- Complète [0063](0063-atelier-projets-binaires.md) et le [lot Z80-C](../specifications/21-retro-ingenierie-z80.md).

## Décision

Réutiliser la boucle, le fournisseur, les budgets, le journal et les réglages de l’agent. Un catalogue métier Z80 distinct et des instructions spécifiques remplacent les outils BASIC dans un projet binaire. Le domaine agent ne reçoit ni Electron ni filesystem ; le ProjectStore applique les annotations validées via le BinaryWorkbench.

Le scope porte sur les zones déjà enregistrées. La mission peut lire, annoter, remplacer un listing à taille/origine constantes et construire une copie DSK. Elle ne peut modifier le manifeste, les ressources brutes, les plages ni les documents. Lecture/hash et consultation du dialecte précèdent la mutation. Le corps d’une ressource ne peut jamais autoriser un outil supplémentaire.

Le snapshot agent ajoute facultativement `binaryAnalysis`. Les ressources restent en mémoire côté hôte pour la construction ; le statut destiné au renderer les omet pour les projets binaires. Les snapshots initiaux servent à la restauration avec révision courante attendue. Le contrôleur adopte la nouvelle révision immédiatement après le commit disque, y compris si l’écriture du journal suivant échoue.

Le comparateur présente jusqu’à 128 différences et un total exact, sur demande. Une modification invalide le résultat. Les limites de lecture et d’édition IA sont affichées/documentées ; aucune analyse coûteuse en continu.

## Conséquences

Pas de nouvelle dépendance ni de moteur de mission parallèle. Les projets BASIC gardent leur catalogue et leurs références. La qualification structurelle ne remplace pas l’exécution CPC ; celle-ci reste une action utilisateur distincte. La restauration de mission est limitée à la session ; les snapshots durables ne constituent pas une reprise automatique après crash. Le guide expose ces limites et la provenance contrôlée des captures.
