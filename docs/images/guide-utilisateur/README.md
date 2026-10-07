# Provenance des captures — CPCéleste 0.36.0 à 0.39.1

[Notice utilisateur](../../guide-utilisateur.md) · [README du produit](../../../README.md)

Ces captures sont des pixels de l’interface exécutée, sans reconstruction graphique, génération IA ni montage. Les fichiers PNG sont versionnés dans ce dossier et les liens de la notice sont relatifs : aucune dépendance à un hébergeur d’images extérieur ni à l’expiration des artefacts CI.

## Captures réalisées pour la notice

Les images `01-atelier.png` à `07-theme-clair.png` ont été réalisées le 7 octobre 2026 sur le renderer de la version 0.36.0, base `5645a17cbeacb34f437ffa55cf33dc85fa45c296`, dans Chromium 141 sous Linux, à 1600 × 1000. Elles montrent l’aperçu navigateur réel et un listing original de démonstration ; aucun port desktop simulé n’est injecté. Les opérations de qualité et de renumérotation exécutent le code de l’application. Les boutons réservés au desktop gardent leur indisponibilité normale.

Reproduction depuis la racine du dépôt (le script démarre et arrête son propre serveur sur le port 5173) :

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run build:renderer
node scripts/capture-user-guide.mjs
```

Le script utilise un profil navigateur temporaire, ne touche aucun projet personnel, ne configure aucune clé et ne fait aucun appel IA. Les captures peuvent varier légèrement selon les polices et les dates affichées.

## Captures desktop et scénarios de validation

Les images suivantes sont des copies **octet pour octet** des captures de l’artefact `editor-alpha-evidence`, ID `11445524450`, du [workflow Desktop editor sur main](https://github.com/AstrowareConception/Micro-IDE-Amstrad/actions/runs/37536411515), commit `5645a17cbeacb34f437ffa55cf33dc85fa45c296`, exécuté le 6 octobre 2026. Les scénarios utilisent des projets temporaires et des données de test. Les captures de services simulés ne prouvent pas une réponse d’un compte GitHub ou d’un modèle OpenAI réel ; cette distinction figure également près des images concernées dans la notice.

Les ROM restent externes au dépôt ; les captures CPC montrent leur écran d’exécution et des valeurs d’inspection, sans inclure les fichiers firmware. Les captures sont sélectionnées parmi les succès de la recette ; aucune capture d’échec n’est réutilisée comme résultat attendu.

| Image dans la notice | Original de l’artefact | Scénario | Nature de la capture |
| --- | --- | --- | --- |
| [08-projet.png](08-projet.png) | `project-alpha.png` | [tests/desktop-smoke.mjs](../../../tests/desktop-smoke.mjs) | Electron ; projet et sources sur disque |
| [09-diagnostics.png](09-diagnostics.png) | `basic-diagnostics-alpha.png` | [tests/basic-diagnostics-smoke.mjs](../../../tests/basic-diagnostics-smoke.mjs) | Chromium ; buffers de test, analyse réelle en worker |
| [10-recherche.png](10-recherche.png) | `search-alpha.png` | [tests/desktop-smoke.mjs](../../../tests/desktop-smoke.mjs) | Electron ; recherche et remplacement sur projet de test |
| [11-execution-cpc.png](11-execution-cpc.png) | `emulator-desktop-alpha.png` | [tests/emulator-ui-smoke.mjs](../../../tests/emulator-ui-smoke.mjs) | Electron ; moteur WASM et ROM de référence, RUN réel |
| [12-inspection-cpc.png](12-inspection-cpc.png) | `cpc-inspection-desktop.png` | [tests/emulator-ui-smoke.mjs](../../../tests/emulator-ui-smoke.mjs) | Electron ; lecture réelle de la machine en pause |
| [13-historique.png](13-historique.png) | `local-history-alpha.png` | [tests/desktop-smoke.mjs](../../../tests/desktop-smoke.mjs) | Electron ; snapshots et restauration réels sur projet de test |
| [14-agent.png](14-agent.png) | `agent-missions-desktop-alpha.png` | [tests/agent-desktop-smoke.mjs](../../../tests/agent-desktop-smoke.mjs) | Electron ; outils et fichiers réels, réponses OpenAI et tarifs simulés |
| [15-documents.png](15-documents.png) | `documents-alpha.png` | [tests/desktop-smoke.mjs](../../../tests/desktop-smoke.mjs) | Electron ; import et lecture sur documents de test |
| [16-git-reseau.png](16-git-reseau.png) | `git-network-desktop-alpha.png` | [tests/git-desktop-smoke.mjs](../../../tests/git-desktop-smoke.mjs) | Electron ; dépôts Git réels et serveur de test local TLS |
| [17-github.png](17-github.png) | `github-private-desktop-alpha.png` | [tests/git-desktop-smoke.mjs](../../../tests/git-desktop-smoke.mjs) | Electron ; API GitHub et comptes simulés |
| [18-brouillons.png](18-brouillons.png) | `drafts-alpha.png` | [tests/desktop-smoke.mjs](../../../tests/desktop-smoke.mjs) | Electron ; copie et comparaison de brouillons de test |
| [19-notifications.png](19-notifications.png) | `notifications-desktop-alpha.png` | [tests/notifications-smoke.mjs](../../../tests/notifications-smoke.mjs) | Electron ; notifications de scénarios de recette |
| [20-terminal.png](20-terminal.png) | `workbench-alpha.png` | [tests/desktop-smoke.mjs](../../../tests/desktop-smoke.mjs) | Electron ; commande hôte réelle dans un dossier temporaire |

La reproduction des captures natives suit les prérequis et commandes du [workflow](../../../.github/workflows/editor.yml) : build desktop, environnement graphique Electron sandboxé et, pour le CPC, fourniture séparée des ROM de référence. Aucun service payant n’est nécessaire aux scénarios agent et GitHub contrôlés.

## Vérifier ou actualiser les images

Le fichier [manifest.json](manifest.json) fournit chemin, dimensions, origine et SHA-256 de chaque PNG. Lors d’une évolution de l’interface, régénérer les images concernées, réviser les légendes et actualiser ce manifeste. Ne pas présenter des réponses simulées comme une mission réellement facturée ou un compte connecté.

## Capture 21 — Scénarios BASIC 0.39.1

`21-tests-scenarios.png` provient de `tests/basic-tests-firmware-smoke.mjs`, exécuté localement le 7 octobre 2026. Vrai worker navigateur, moteur CPC/WASM qualifié repris de l’artefact CI de la PR #46 (moteur C inchangé), jeu ROM 6128 anglais identifié. Une saisie programmée et une fixture ASCII produisent une assertion native et deux observations réussies (fichier et rectangle écran). Le listing de recette est nommé tests-basic.bas ; son contenu de scénario est fourni par l’exemple du projet. L’image est une capture directe de l’article de résultat, sans modification des pixels. Aucun octet ROM, secret API ou contenu utilisateur privé n’est inclus.
