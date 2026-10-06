# ADR 0035 — Atelier Git réseau et GitHub

Statut : acceptée pour l’alpha 0.28. Date : 2026-10-06.

## Contexte

Le produit doit proposer les opérations Git quotidiennes dans des menus et panneaux d’IDE : dépôt local/distant, branches, synchronisation, GitHub privé et messages de commit proposés par IA. Le terminal humain ne constitue pas une intégration Git.

## Décision

Ajouter des ports typés GitOperations/GitHub, sans framework ni système de fichiers, et des adaptateurs main natifs. Étendre la qualification conservatrice existante aux références/configuration avant chaque commande. Les mutations utilisent un aperçu opaque consommable, revérification et confirmation humaine. Pull est fetch puis fast-forward seulement. La cible est matérialisée dans un dossier temporaire, validée comme projet et vérifiée contre les fichiers locaux ignorés avant checkout. Après mutation des sources, une nouvelle session Workspace est ouverte ; les anciens buffers ne peuvent écrire sur un projet devenu invalide.

Clone crée un dossier exclusif, contrôle le projet avant checkout et conserve tout résultat partiel. Push cible un OID et une référence explicites, revérifie le remote et analyse tous les nouveaux commits, contenus privés et pièces documentaires manquantes. Ni force-push ni reprise automatique. L’arrêt termine seulement le groupe/processus possédé ; limites et résultat incertain sont visibles, sans prétention transactionnelle.

GitHubSession détient uniquement en mémoire le jeton saisi ou importé de `gh auth token`. API officielle bornée sans redirection et en-tête Git HTTPS limité à github.com ; rien dans argv/config/IPC public. Dépôts privés paginés, création personnelle privée par défaut, sélection/association/clone, liste/création de PR brouillon et liens PR/CI. SSH reste l’authentification hôte non interactive préexistante. OAuth et coffre système suivront séparément.

La suggestion de commit réutilise le fournisseur et modèle OpenAI sélectionnés, avec consentement pour le diff indexé borné et aucun outil. Elle ne modifie qu’un champ éditable. Commit et publication gardent leurs confirmations humaines indépendantes. Le modèle n’obtient aucun droit Git.

## Conséquences et vérification

[Guide et limites](../implementation/git-network-alpha.md). Tests réels de deux clones et HTTPS/TLS/authentification/arrêt ; fixtures API GitHub/OpenAI et recettes navigateur/Electron. CI Windows Git local/build ; Linux réseau chiffré et Electron sandboxé. Merge/rebase/conflits, stash/tags, signatures, autres plateformes et qualification SSH restent ouverts. IDE-035/036/039 progressent à P ; aucun jalon Git complet ou IDE de production clos.
