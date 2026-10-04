# Atelier et outils IDE — alpha 0.14

Date : 2026-10-04. [ADR 0019](../adr/0019-outils-atelier-et-terminal-humain.md). Incrément indépendant de la qualification ROM, suivant l’alpha Git 0.13.

## Gestes disponibles

| Outil | Accès | Comportement |
| --- | --- | --- |
| Palette CPCéleste | Commandes ou Ctrl/Cmd Maj P | Recherche d’une action/source, flèches et Entrée, Échap pour fermer ; actions indisponibles désactivées |
| Ouverture rapide | Sources ou Ctrl/Cmd P | Recherche parmi les sources chargées ; sélection sans abandon des brouillons |
| Menus | Fichier, Édition, BASIC, Affichage | Ouverture/enregistrement/export ; annuler/rétablir ; recherche/remplacement/navigation ; renumérotation/complétion ; minimap/zoom code/terminal |
| Contexte éditeur | Clic droit Monaco | Cible BASIC, enregistrer, renuméroter, exporter DSK, commandes CPCéleste |
| Contexte source | Clic droit onglet/explorateur, Maj F10 sur onglet ou bouton ⋯ | Ouvrir, enregistrer cette source, la définir comme entrée ; aucune suppression/renommage ajouté implicitement |
| Historique Git | Bouton dans panneau Git | 20 commits par page, OID/date/sujet, HEAD capturé ; relire pour voir de nouveaux commits |
| Terminal | Affichage → Afficher le terminal | Commande hôte du projet, confirmation native, stdout/stderr, code de sortie, bouton Arrêter |

La ligne physique de l’éditeur est distincte du numéro BASIC. F12 conserve sa navigation vers la cible littérale ; la commande « Aller à une ligne physique » utilise Monaco. Minimap et taille 12–28 px sont des préférences de session, sans persistance revendiquée. Les menus courants utilisent les comportements clavier HTML ; la palette piège le focus via `dialog.showModal`.

## Historique et versionnement

L’index sélectif et les diff index/disque 0.13 restent disponibles. L’historique lit uniquement les commits déjà présents : un dépôt vide affiche « Aucun premier commit ». La page suivante reste rattachée au même HEAD même si un autre client crée un commit. Une nouvelle lecture invalide le curseur précédent ; limite 2 000 commits, 1 Mio de sortie et 10 s par commande, refus explicite d’erreur/troncature. Aucun checkout/restauration/commit ni affichage automatique des contenus historiques n’est ajouté.

## Terminal hôte

Projet desktop requis. Enregistrer/arbitrer tous les brouillons puis saisir, par exemple, `git status --short`. La confirmation native montre la racine et la ligne complète. Annuler n’exécute rien. Chaque commande lance un nouveau shell non interactif ; stdout/stderr sont combinés, affichés en texte inerte, bornés et gardés en mémoire jusqu’à la prochaine commande/changement de projet. Aucun journal de commande ni historique shell n’est persisté ou envoyé au modèle.

Limites : 4 Kio sur une seule ligne, 30 secondes, 64 Kio de sortie ; stdin fermé, ni PTY ni REPL. Les variables nécessaires aux outils usuels (PATH, HOME, identité locale, langue/temp, dossiers Windows, socket SSH) sont sélectionnées ; les autres variables du processus ne sont pas héritées. Certains outils nécessitant des variables supplémentaires doivent être lancés/configurés autrement. Les profils shell ne sont pas chargés.

Ce terminal n’est pas un sandbox : un utilisateur confirmé peut supprimer/écrire au-delà du cwd, lancer Git avec ses hooks/configurations ou utiliser le réseau et les credentials locaux. Ces capacités ne sont pas accordées à l’agent et ne qualifient pas les futurs boutons pull/push. La politique Git conservatrice concerne le panneau Git, pas le shell humain. L’arrêt vise le groupe/arbre des processus ordinaires ; un processus hostile qui s’en détache n’est pas contenu par ce mécanisme.

Commande active : édition et opérations disque/IA bloquées, fermeture refusée avec explication. Arrêter attend la fin effective avant de réactiver les opérations. Le terminal conserve ses contrôles d’arrêt même si le panneau est masqué. Une commande qui modifie des sources sur disque ne remplace pas les buffers : rouvrir le projet après arbitrage, les garde-fous d’empreinte préviennent l’écrasement. Linux/Ubuntu est la plateforme de recette de cet incrément ; Windows/macOS, taskkill et stockage réseau non qualifiés.

## Preuves

Trois tests Node ajoutés : historique Git réel paginé et HEAD stable malgré commit externe, refus de curseur/configuration non qualifiés, conservation index/source ; shell dans cwd avec stdout/stderr et contrôle des identités/entrées ; arrêt de groupe, concurrence refusée et sortie bruyante bornée. Fixtures originales et temporaires, sans remote ni credential personnel.

Parcours Chromium étendu : palette/minimap, ouverture rapide, contexte d’onglet et contexte Monaco, puis recette complète existante d’édition/renumérotation/export. Electron : historique Git réel, commande printf, commande avec enfant puis arrêt, blocage d’opération disque et des brouillons. Capture `out/workbench-alpha.png`. Résultats effectifs consignés dans la PR après exécution ; pas de test OpenAI ou CPC réel ajouté.

## Suite des outils d’IDE

1. Identité Git et commit du contenu exact de l’index, inspection de version d’une source avec préconditions.
2. Historique local durable des sauvegardes, comparaison/restauration, quotas/rétention et récupération après crash.
3. Recherche dans le projet, navigation entre diagnostics/fichiers, sauvegarde coordonnée et fermeture d’onglets avec arbitrage.
4. Profils de construction, console CPC et exécution quand J0 est qualifié ; outils d’images/sprites spécifiques au CPC.
5. PTY interactif, configuration des shells et qualification Windows ; remotes/branches/fetch/pull/push comme prévu au jalon JG.

Pas de debugger Java/JavaScript, gestionnaire de paquets BASIC inventé, génération de framework ou outillage distribué sans besoin CPC.
