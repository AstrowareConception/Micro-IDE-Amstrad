# ADR 0001 — Application de bureau Electron

Statut : acceptée. Date : 2026-10-03.

## Contexte

Le produit manipule projets locaux, pièces jointes, disquettes, firmware et clés API. Il doit fonctionner hors réseau, embarquer une machine CPC et proposer un éditeur riche. L'utilisateur laisse le choix des technologies, avec une préférence pour un logiciel installé.

## Décision

Construire une application Electron, UI React, TypeScript et Monaco ESM. Windows est qualifié d'abord. Le runtime Chromium uniforme facilite workers, canvas, audio et WASM ; le main contrôle fichiers et réseau. Electron Forge réalise le packaging. Les versions sont fixées à J1 et maintenues.

## Options considérées

Une PWA réduit l'installation mais complique permissions persistantes, secrets et distribution locale ; elle n'est pas la première livraison. Tauri peut réduire la taille, mais ajoute Rust et des différences de webviews systèmes à qualifier pour une machine audio/vidéo. Une application Qt/C++ offre une intégration native mais augmente le coût d'un éditeur moderne et de l'assistance multimodale. Electron est retenu pour réduire le nombre de difficultés simultanées.

## Conséquences

Accepter coût disque et mémoire, mesuré à J0/J6. Isoler renderer et privilèges, utiliser uniquement ressources locales, limiter IPC et garder le métier indépendant du shell. Aucune promesse d'extensions VS Code à partir de Monaco. Une future édition web ou Tauri réutiliserait les ports et domaines, mais ne motive pas deux frontends au démarrage.

Révision : si les objectifs de performance restent hors d'atteinte après profiling ou si le besoin principal devient navigateur partagé, produire une nouvelle ADR avec mesures et impact sur les parcours.
