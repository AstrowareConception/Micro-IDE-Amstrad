# ADR 0082 — Capture éphémère et adoption humaine des références écran

- Statut : accepté
- Date : 2026-10-21
- Incrément : 0.41.32

## Contexte

L’interface 0.41.31 exigeait une empreinte écran déjà connue. Préparer la première référence nécessitait donc un outil extérieur. Accepter automatiquement une observation aurait permis de transformer un défaut en attente.

## Décision

Ajouter un plan de capture humain (identité, nom, budget, saisies), indépendant des assertions, et réutiliser exactement la session d’exécution des tests. La capture retourne le cadre RGBA opaque au terme du budget, sans verdict ni rapport. Le processus principal valide DSK, ROM, dimensions et durée, puis conserve les pixels et leur provenance en mémoire.

L’aperçu propose un rectangle à la souris ou au clavier et une adoption explicitement déclenchée. Le principal recalcule l’empreinte depuis ses pixels après contrôle du plan, de la session, du projet et de la bibliothèque relue. Le renderer reçoit une attente à ajouter ou remplacer dans son brouillon ; la sauvegarde reste une action séparée, avec son contrôle de révision existant. La bibliothèque et les rapports gardent leur version 1.

## Conséquences

Une première capture est possible sans attente préexistante. Une seule image temporaire est conservée ; rien n’est ajouté à l’historique des tests. Pas de nouvel outil agent, d’adoption automatique, d’archive d’images ou de nouvelle dépendance. Les captures périmées et annulées sont inutilisables. Le caractère correct de l’image reste une décision humaine ; seul un essai ultérieur produit un verdict.

[Guide et preuves](../implementation/project-screen-reference-alpha.md).
