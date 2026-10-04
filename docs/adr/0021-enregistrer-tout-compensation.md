# ADR 0021 — Enregistrer tout avec compensation en cours de processus

Date : 2026-10-04. Statut : acceptée pour l’alpha 0.16, première tranche R2.

## Décision

La commande humaine « Enregistrer tout » reçoit un snapshot complet des sources déclarées. Le main valide session, cardinalité, identifiants, encodage et budgets ; aucune racine ni aucun chemin fourni par le renderer n’est utilisé. Le ProjectStore vérifie manifeste, chemins et empreintes de toutes les sources avant toute écriture. Les sources inchangées gardent leurs octets originaux, notamment CRLF.

L’application Workspace coordonne un port de lecture/remplacement/contrôle du manifeste (`save-batch.ts`), sans Node ni framework. Chaque fichier modifié est remplacé via le temporaire exclusif et rename existants. Une nouvelle vérification précède chaque remplacement ; une vérification finale porte sur tout le lot. En cas d’échec, les fichiers déjà remplacés sont restaurés en ordre inverse uniquement si leurs octets correspondent encore à notre version écrite. Les erreurs de restauration n’empêchent pas les autres restaurations d’être tentées. Une restauration incomplète bloque la session du ProjectStore, y compris sauvegarde active et outils agent ; elle exige examen des fichiers et réouverture.

Le renderer ne marque aucun buffer enregistré sur erreur. Sur succès il mémorise le snapshot effectivement envoyé, conserve les textes/piles Monaco et annonce le nombre de sources écrites. La route reste sérialisée et bloquée pendant terminal/mission agent.

## Limites et suite

Ce mécanisme est une compensation en mémoire, pas une transaction durable : aucun journal, fsync, reprise après crash, verrou interprocessus ni historique local. Un autre processus peut encore intervenir entre lecture et rename. Une panne peut laisser un sous-ensemble écrit ; aucune atomicité de projet n’est revendiquée. Les erreurs conservent les brouillons dans l’éditeur, mais ceux-ci restent volatils. Le port `write` doit échouer avant remplacement ou réussir après remplacement ; le temporaire natif respecte cette frontière hors arrêt brutal.

IDE-007 reste P jusqu’à la qualification durable J1-03. IDE-008 est la prochaine tranche : journal versionné, reprise explicite, originaux et nouvelles versions identifiés, refus de conflit externe et injections d’arrêt entre étapes. IDE-009/010 suivent pour l’historique/restauration durable. Pas de modification du schéma projet ni de nouvelle dépendance.

## Validation

Tests de l’orchestrateur avec panne injectée à la seconde écriture, conflit pendant le lot, modification externe d’un fichier écrit, erreur de manifeste et lot dupliqué. Tests du vrai ProjectStore : sauvegarde/réouverture, hashes rafraîchis, CRLF intacts, conflit tardif sans mutation et payloads invalides. Recette Electron : deux brouillons, conflit tardif, sauvegarde globale réussie, états propres et undo/redo conservés, no-op, manifeste inchangé et garde terminal.
