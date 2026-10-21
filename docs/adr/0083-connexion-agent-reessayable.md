# ADR 0083 — Dissocier la mémorisation de clé et le catalogue OpenAI

- Statut : accepté
- Date : 2026-10-21
- Incrément : 0.41.32

## Contexte

L’interface ne conservait la clé qu’après réussite du catalogue et effaçait la saisie même sur erreur réseau. L’utilisateur devait la recoller à chaque tentative. Le transport Node ne partageait pas la configuration proxy native de l’application. Une ancienne disposition masquée pouvait aussi cacher la fonction IA au démarrage.

## Décision

La configuration humaine avec modèle vide conserve la clé en mémoire et impose ensuite un choix dans le catalogue chargé. La requête de modèles est séparée et réessayable ; ses erreurs ne suppriment pas la clé et n’autorisent aucune mission. Les requêtes IA passent par `net.fetch` dans le processus principal. Les tests natifs remplacent seulement les endpoints OpenAI par leurs fixtures déterministes ; le routage fichier de l’application demeure natif.

À chaque démarrage, le panneau agent est visible et ancré à droite. Les autres dispositions restent conservées ; masquer ou détacher l’agent reste possible pendant la session.

## Conséquences

Ni secret persistant, ni contournement TLS, ni choix de modèle implicite, ni retry facturable automatique. Les diagnostics distinguent mémorisation et vérification. Le correctif ne présume pas de la cause exacte du réseau utilisateur et demande une observation sur son poste après installation.

[Guide](../implementation/agent-connection-alpha.md).
