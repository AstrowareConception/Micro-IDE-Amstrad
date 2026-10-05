# ADR 0028 — Profil privé d’identité Git

- Statut : accepté
- Date : 2026-10-05
- Périmètre : alpha 0.23, R3/JG-A partiels

## Décision

Mémoriser une seule identité nom/email dans le profil local de CPCéleste, sur action explicite. L’actualisation initiale du panneau la charge ; un bouton permet de la recharger après modification. Les champs restent libres pour chaque commit. L’oubli concerne le profil et conserve les champs courants ; aucune écriture de configuration Git locale/globale, aucun fournisseur ou outil agent n’intervient.

Le port VersionControl ajoute identity, rememberIdentity et forgetIdentity. Main valide session et émetteur, sérialise les routes et refuse les opérations pendant terminal/mission active. La préférence peut être modifiée avec des buffers dirty car elle n’écrit pas le projet. Nom/email partagent exactement la validation des commits.

L’adaptateur hôte utilise `userData/git-profile/identity.json`, v1 strict : version, UUID et identité nullable. Révision SHA-256 des octets exacts, contrôle avant remplacement ; oubli écrit un record neuf sans identité, ce qui empêche de réutiliser une ancienne révision d’absence. Temporaire exclusif, fsync, rename, synchronisation du dossier ; droits 0700/0600 sous Linux. Fichier 4 Kio maximum, liens/hardlinks/fichiers spéciaux et versions inconnues refusés et conservés. Aucune erreur système contenant un chemin hôte n’est renvoyée.

## Conséquences et limites

Le choix d’une préférence d’application évite une mutation implicite de .git/config et rend l’identité disponible à tous les projets de cet utilisateur. Cela ne réalise pas encore le réglage par dépôt prévu au document 16. IDE-033 reste P ; signatures/hooks, plateformes et Git local complet restent ouverts.

Nom/email sont des données personnelles locales en clair, pas des secrets chiffrés. Oublier ne retire ni auteurs des commits existants, ni copies de sauvegarde du système ; pas d’effacement physique garanti. Aucun message, source, prompt, clé API ou chemin de projet persisté ici. Pas de verrou contre une autre instance/processus entre dernier contrôle et rename ; panne électrique et Windows/macOS restent non qualifiés. Une erreur de sync après rename exige de recharger le profil avant reprise. Une interruption peut laisser un temporaire non interprété.

[Guide et preuves](../implementation/git-identity-alpha.md). Suite : liste/création de branches locales, puis bascule avec protection et revalidation du projet.
