# ADR 0039 — Préférences versionnées, profils et keymap de l’atelier

- Statut : accepté, alpha 0.32
- Date : 6 octobre 2026
- Périmètre : IDE-027/028/030, lot 7 partiel

## Contexte

Les préférences simples et les panneaux persistants existent. Les raccourcis sont répétés dans un gestionnaire global et dans les libellés ; le zoom du menu modifie Monaco sans actualiser le réglage. L’utilisateur demande une personnalisation poussée, notamment adaptée à ses habitudes JetBrains.

## Décision

Étendre les préférences connues avec présentation, lecture du code et keymap. Une enveloppe version 2 migre les anciennes valeurs ; l’original version 1 reste conservé. Une version inconnue ou un JSON illisible ne sont pas remplacés automatiquement. Les options changent l’instance Monaco existante et ne recréent ni modèle ni pile d’annulation. Le zoom devient un réglage unique persisté.

Le module pur `keymap.ts` possède les combinaisons des commandes de l’atelier, leur normalisation et les réservations/conflits. Le registre de commandes conserve comportements et garde-fous ; les détails affichés et le dispatcher utilisent la même keymap. Supprimer l’ancienne binding Monaco d’Enregistrer évite un deuxième déclencheur. Les bases inspirées VS Code/JetBrains ne revendiquent pas une reproduction exhaustive de ces IDE.

Les profils locaux sont des copies de préférences, avec stockage distinct, nom/budget/version et export par liste blanche. Charger/importer prépare un draft sans appliquer ; enregistrer un profil est une action explicite immédiate. L’auto-save fait partie du profil et reste désactivé par défaut. Pas de secret, chemin, contenu utilisateur ni état de mission dans le fichier portable. Import ne peut pas créer de capacité hôte.

Trois dispositions réutilisent les panneaux existants ; Concentration garde un snapshot temporaire de visibilité/géométrie et préserve la disposition persistée. Aucun lancement, arrêt machine ou requête IA implicite ne résulte du choix de disposition.

## Conséquences

Configuration locale et profils portables sans dépendance ajoutée. Pas d’overrides projet, de transaction inter-stockages, de synchronisation cloud, de fenêtres OS ni de keymap sémantique BASIC. Conservation de versions inconnues peut rendre une session non persistante ; le message l’indique. Recettes Node, navigateur et Electron/redémarrage ; audits clavier/dispositions OS/macOS et accessibilité globale restent distincts.
