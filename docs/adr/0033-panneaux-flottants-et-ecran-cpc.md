# ADR 0033 — Panneaux flottants et écran CPC

Statut : acceptée pour l’alpha 0.26. Date : 2026-10-06.

## Contexte

Le dock inférieur limité à 42 % et l’empilement des commandes CPC consomment la hauteur nécessaire à l’écran. L’utilisateur demande redimensionnement et détachement, notamment pour lire le terminal et les détails du CPC.

## Décision

Trois groupes (outils, assistant IA, sorties) disposent d’un en-tête commun : détacher/réancrer à l’emplacement initial, agrandir/restaurer, masquer, déplacer et redimensionner le panneau flottant. Les panneaux flottent dans la fenêtre de l’IDE. Leur wrapper et leur contenu gardent la même identité DOM/React ; les transitions changent la disposition CSS. Aucun transfert de worker, remontage de terminal ou nouvelle fenêtre Electron n’est nécessaire.

Les séparateurs ajustent les largeurs et la hauteur du dock, sans limite arbitraire à 42 %. Le code conserve 140 px minimum. Souris/pointer capture, flèches (10 px), Maj (40 px) et annulation Échap sont disponibles. Les contrôles de déplacement et du coin flottant ont aussi une navigation clavier. Le groupe flottant conserve les onglets de sortie.

Le profil renderer conserve les dimensions existantes et une disposition versionnée distincte : uniquement visibilité, mode flottant/agrandi et rectangle pour les trois groupes connus. Validation des types, valeurs finies/bornées et défauts empêchent qu’un stockage corrompu bloque l’atelier. Écriture différée de 150 ms, flush pagehide et information si indisponible. Les rectangles sont recadrés dans le viewport à l’affichage après une réduction de fenêtre. Aucun chemin de projet, ROM, source ou secret dans ce stockage. Restaurer la disposition via menu/palette réaffiche les zones et leurs dimensions initiales sans changer thème ou code.

Le CPC utilise commandes/status à gauche et viewport scrollable à droite. ResizeObserver calcule l’ajustement sur les deux dimensions ; le zoom explicite 100/150/200/300 % autorise les détails plus grands que le viewport. Le ratio d’affichage corrigé 768/544 et image-rendering pixelated conservent les pixels bruts du moteur. Les informations détaillées de session sont repliables ; le focus explicite du canvas et le relâchement du clavier CPC sont préservés.

## Vérification et limites

Tests unitaires de récupération du stockage et recadrage. Recette navigateur intégrée à test:editor : trois séparateurs, chaque groupe flottant, déplacement/redimensionnement souris et clavier, agrandir/restaurer/réancrer, mêmes instances éditeur/assistant, même contenu, persistance après reload et recadrage sur fenêtre réduite. Recette CPC réelle browser/Electron : écran plus grand, commandes à gauche, zoom exact, même canvas/temps en pause/pixels après docking et export de session inchangé. Recette terminal Electron : commande active, formulaire conservé et arrêt possible pendant détachement/réancrage. Les workflows existants Windows/Linux exécutent ces recettes ; ils produisent leurs captures dans out/.

Cette tranche ne crée pas de fenêtres système indépendantes ni de disposition arbitraire. Chaque groupe retrouve son côté initial ; les sorties restent regroupées et le zoom CPC est temporaire. Explorateur intégral, PTY et qualification globale IDE 1.0 restent des incréments distincts.
