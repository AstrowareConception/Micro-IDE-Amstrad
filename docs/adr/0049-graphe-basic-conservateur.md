# ADR 0049 — Graphe BASIC conservateur à la demande

Statut : acceptée pour la première tranche 0.40. Date : 8 octobre 2026. Complète l’[ADR 0043](0043-rapport-qualite-basic.md), dont la métrique lexicale reste disponible.

## Décision

Ajouter un moteur TypeScript pur dans `basic-language`, sans nouvelle dépendance, appelé uniquement par le worker du rapport Qualité. Construire un graphe d’instructions avec ancres numérotées ; préserver la portée IF à l’échelle de la ligne. Normaliser les boucles FOR/NEXT et WHILE/WEND en un test avec deux issues. Représenter les appels et leur continuation possible, sans simuler de pile ni développer récursivement les sous-routines.

Calculer des résumés par entrée, un graphe des sites d’appel et les composantes fortement connexes. Afficher la complexité locale des décisions accessibles sous les hypothèses du modèle ; ne pas l’annoncer comme une mesure exacte du programme interprété. Les routines peuvent partager leurs blocs. La remarque d’inaccessibilité concerne exclusivement le départ à la première ligne, hors CONT et RUN alternatif ; DATA est exclu.

Suspendre la complexité et les remarques d’inaccessibilité dès qu’une forme de contrôle inconnue, une erreur ou un quota rend le listing partiel. Conserver le graphe reconnu avec ses limites ; ne pas transformer une information manquante en absence de chemin. Borner sources, nœuds, liaisons, entrées, visites, appels, raisons et DOM. Utiliser des parcours itératifs.

Explorer le graphe dans un composant React accessible au clavier. La sélection du voisinage n’altère pas l’éditeur ; la navigation vers le code est une action séparée protégée par le snapshot existant. Exports Markdown/JSON sans texte source ni arguments. Le rapport JSON devient version 2 ; aucun schéma projet ni stockage persistant ne change.

## Preuves et conséquences

[Guide et limites](../implementation/basic-control-flow-alpha.md). Les tests purs vérifient structure, métriques et garde conservatrice. Une recette sur firmware réel vérifie FOR hors bornes, IF/ELSE, ON et GOSUB, WHILE ; elle a conduit à retenir le test initial de FOR dans le modèle. Les preuves sur ce firmware ne sont pas étendues aux autres machines.

IF imbriqués, NEXT multiples, événements, contrôle machine et analyse contextuelle de la pile restent hors de cette tranche. IDE-076 et J2 restent partiels. Le rapport reste local, volontaire, annulable, sans correction automatique ni appel IA.
