# ADR 0040 — Centre de notifications de session

- Statut : accepté, alpha 0.33
- Date : 6 octobre 2026
- Périmètre : IDE-029, lot 7 partiel

## Contexte

La barre d’état et les panneaux affichent seulement leur dernier résultat. Une erreur disparaît lors de l’opération suivante ; les missions et commandes hôte conservent leurs propres journaux. L’utilisateur demande de poursuivre les fonctionnalités manquantes après intégration des PR 26–34.

## Décision

L’atelier possède un registre en mémoire, borné à 100 messages de 1 200 caractères. Les composants reçoivent un callback explicite ; aucun bus global ni accès disque, fournisseur ou shell n’est ajouté. Un module pur normalise les résumés, regroupe les répétitions consécutives de moins de cinq secondes et filtre par origine/niveau/lecture/texte. Une nouvelle occurrence redevient non lue ; la lecture et l’effacement sont explicites.

Les opérations sur les sources, Git, le terminal, les transitions de mission et les états du CPC publient des résumés. Les erreurs Git/IA/CPC et terminal ont un résumé générique et renvoient à leur panneau existant. Aucun objectif de mission, réponse fournisseur, code, diff, commande ni sortie shell n’est copié dans ce registre. Les messages restants masquent les URL et formats reconnaissables de credentials avant limitation ; ce filtre n’est pas un classificateur universel de secrets arbitraires.

Les cibles sont uniquement des vues connues, jamais des URL ou fonctions de mutation. Une notification liée à une session projet ne peut ouvrir son panneau après changement de projet. « Voir les détails » marque le message lu et rejoint la vue ; cela ne relance ni opération ni mission. Quitter Concentration pour montrer la vue restaure sa disposition antérieure.

La cloche, Affichage, la palette et la keymap partagent la même commande. Le dialogue possède recherche, filtres, états vides et actions explicites ; le focus revient à l’éditeur. Un aperçu non modal reste disponible sans focus forcé et peut être masqué sans effacer le message. Le réglage `notificationPopups` accepte `all`, `errors`, `off` ; il est ajouté à l’enveloppe de préférences version 2 et aux profils par liste blanche. Les anciennes valeurs absentes prennent `all`. Si une ancienne keymap attribue déjà la combinaison de la nouvelle commande, celle-ci reste sans raccourci ; les anciennes attributions sont préservées.

## Conséquences

Historique consultable sans nouvelle persistance de données privées, dépendance ni IPC. La fermeture/redémarrage commence un registre vide ; seul le réglage d’aperçu persiste. Annulation et arrêt restent les commandes existantes des panneaux. Journal de tâches durable, progression unifiée, couverture de toutes les erreurs de dialogues, notifications OS et audit lecteur d’écran restent ouverts : IDE-029 n’est pas clos.
