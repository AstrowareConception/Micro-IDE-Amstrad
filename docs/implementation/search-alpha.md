# Recherche et remplacement des sources — alpha 0.15

Cette tranche commence R1 de la [roadmap qualifiée](../specifications/17-roadmap-ide-complet.md) (IDE-022/023). [ADR 0020](../adr/0020-recherche-sources-et-remplacement-buffers.md).

## Utilisation

1. Ouvrir un projet ou un listing. `Ctrl/Cmd Maj F`, ou Édition → Rechercher dans toutes les sources, ouvre le panneau.
2. Saisir un texte et choisir casse/mot entier, puis **Rechercher toutes les sources**. Toutes les sources déclarées chargées sont incluses, avec leur texte non enregistré. Les résultats donnent fichier, ligne physique, colonne et extrait ; cliquer sélectionne l’occurrence exacte, même dans un autre onglet.
3. Saisir un remplacement, éventuellement vide, puis **Prévisualiser les remplacements**. Chaque fichier propose un aperçu avant/après des premiers 4 000 caractères et un nombre d’occurrences. Décocher les fichiers à préserver.
4. **Appliquer les remplacements sélectionnés** modifie les buffers uniquement. `Ctrl/Cmd Z` annule une opération dans l’onglet actif ; les autres fichiers gardent leur propre pile. Enregistrer reste une action distincte pour chaque source.

Un contenu ou périmètre modifié invalide l’aperçu et impose une nouvelle recherche. Changer requête/options efface les résultats ; changer remplacement impose un nouvel aperçu. Les boutons de mutation sont désactivés pendant les opérations disque, terminal et agent, comme l’éditeur. Fermer le panneau ou changer de projet efface sa session.

## Périmètre et limites

Recherche littérale, non chevauchante, y compris dans chaînes/commentaires ; aucune regex ni transformation BASIC implicite. Casse ASCII ; mot entier incluant les suffixes BASIC et le point. Offsets UTF-16, lignes physiques distinctes des numéros BASIC. 64 sources, 1 Mio/source, 4 Mio/recherche, 1 000 occurrences maximum : les dépassements sont refusés intégralement. Recherche 1–256 et remplacement 0–4 096 caractères sans saut de ligne/NUL. Résultat par fichier limité à 1 Mio. Documents, ressources, historique et fichiers non déclarés exclus.

Il n’y a pas de sauvegarde automatique, transaction disque, annulation globale ni récupération après crash. Les buffers, dont les remplacements, restent volatils avant enregistrement. L’historique local durable est prévu en R2 ; Git et les ROM ne sont pas des prérequis de cette recherche.

## Vérification

`npm run typecheck`, `npm test` (94 tests dont cinq de recherche), `npm run build:desktop`, `python scripts/check_specs.py --schemas` et `npm run test:editor`. `tests/desktop-smoke.mjs` contient la recette Electron sandboxée Linux exécutée en CI : trois occurrences dans deux sources dont un brouillon, navigation intersource, choix d’un fichier, remplacement des deux, undo indépendant, aperçu périmé, et comparaison octet pour octet des sources/manifeste restés sur disque. Capture : `out/search-alpha.png`, conservée sept jours dans l’artefact CI.

Qualification Windows/macOS, API OpenAI réelle et boot CPC réel restent ouverts. Cette tranche ne clôture ni J0 ni le MVP.
