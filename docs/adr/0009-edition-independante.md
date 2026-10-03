# ADR 0009 — Livrer l'édition indépendamment de la qualification CPC

Statut : acceptée le 2026-10-03, à la demande du responsable produit de poursuivre la construction et d'ajouter coloration et complétion.

## Décision

La condition J0 go reste obligatoire pour intégrer l'exécution qualifiée. Elle n'empêche plus les fonctions indépendantes : shell Electron, buffer BASIC, assistance Monaco, sauvegarde d'un listing et construction structurelle du DSK. Cette décision remplace uniquement la dépendance séquentielle absolue J0 → J1 ; elle ne remplace pas l'ADR 0003 ni ses preuves requises.

Une alpha 0.4 livre un seul listing, pas un projet multifichier durable. Le domaine `basic-language` ne dépend d'aucun framework et réutilise `cpc-disk` pour l'artefact. Electron implémente le port de fichiers, React compose l'interface, Monaco fournit le buffer et les fournisseurs de langage. Aucun service IA ou shell général n'est exposé au renderer.

Les fiches sont un sous-ensemble éditorial sourcé, non une qualification du dialecte sur ROM. Les signatures sont indicatives, les variantes et options ne sont pas exhaustives. Pas de faux parser complet, de renumérotation improuvée, d'émulateur fictif ou d'agent simulé présenté comme connecté.

## Conséquences

- npm et son lockfile sont utilisés pour l'incrément ; migration pnpm/workspaces et Electron Forge reportée jusqu'à un besoin de packaging. Les versions directes sont exactes.
- Monaco est importé avec ses contributions utiles, sans charger tous les langages web ni un serveur LSP. Le worker de base est local. Le mode textarea (`editContext: false`) facilite une interaction clavier reproductible sur Chromium/Electron.
- L'application Electron charge uniquement ses fichiers construits ; isolation de contexte, sandbox, CSP, refus des fenêtres externes, validation IPC et dialogs natifs. L'aperçu navigateur utilise un adaptateur distinct à téléchargements, jamais un faux accès disque.
- Les sauvegardes utilisent un fichier temporaire dans le même dossier puis un renommage. Le hash du fichier ouvert détecte une modification externe avant écriture. Ce n'est pas encore une transaction durable, un verrou partagé ou une garantie contre une course entre deux processus.
- La qualification des ROM, l'exécution extérieure, les projets, l'autosave/récupération, les ressources et l'agent restent des travaux identifiés. Cette alpha n'est pas le MVP produit.

Voir le [guide de l'alpha](../implementation/editor-alpha.md) et le [rapport J0](../implementation/j0-report.md).
