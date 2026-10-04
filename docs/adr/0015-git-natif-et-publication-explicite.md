# ADR 0015 — Git natif, hébergements interchangeables et publication explicite

Date : 2026-10-04. Statut : **acceptée pour la conception ; implémentation à venir**.

## Contexte

Le responsable produit demande init, remote, pull, push, branches et les outils usuels Git dans l'IDE. Des fichiers ouverts facilitent Git mais ne constituent pas une intégration utilisateur. Le manifeste porte des empreintes : une opération Git peut rendre le projet incohérent même sans conflit textuel. L'agent dispose déjà de mutations de sources locales ; cela ne doit pas lui donner un droit de publication.

## Décision

Créer le contexte VersionControl et un port de cas d'usage typés, avec un adaptateur CLI Git natif asynchrone côté hôte, sans shell libre. Git installé et maintenu par l'utilisateur dans la première tranche, chemin/version identifiés ; l'édition BASIC reste indépendante. GitHub est un remote comme les autres ; ses API de création/PR sont des capacités distinctes avec autorisation propre.

Livrer via JG-A/B/C : local, synchronisation, puis conflits/historique avancé. Statut porcelain et arguments explicites, politique testée des hooks/filtres/helpers, trust distincte de la mission IA, credentials système hors projet/renderer. Pull fast-forward par défaut et aucun autostash caché. Sérialiser avec Workspace, bloquer les opérations affectant le working tree en présence de brouillons/mission, revalider manifeste et hashes après changement de branche/intégration.

Tout push/publication distante requiert une action humaine sur destination et commits exacts. L'agent peut ultérieurement proposer une publication, pas s'accorder la permission. Checkpoint IA, révision de projet et commit ne sont pas interchangeables. Le [document 16](../specifications/16-integration-git.md) fixe les parcours, préconditions, exclusions et recettes.

## Alternatives et conséquences

Une bibliothèque Git JavaScript limite l'interopérabilité avec les clients natifs, credentials et workflows existants ; libgit2 ajoute binding natif et matrice de distribution sans besoin démontré. Aucun n'est retenu initialement. Une connexion uniquement à l'API GitHub ne couvre ni Git local ni les autres hébergeurs.

La CLI apporte compatibilité et un coût de qualification réel : configurations capables d'exécuter du code, sécurité de version, processus enfants et annulation non transactionnelle. Ne pas la présenter comme sandboxée. Pas de Git embarqué sans audit licence/distribution. Les pièces jointes privées doivent avoir une politique de partage explicite ; un `.gitignore` ne suffit pas à protéger l'historique. Cette décision étend le MVP avec le parcours Git central, sans déclarer l'alpha 0.10 ou le moteur plus qualifiés.
