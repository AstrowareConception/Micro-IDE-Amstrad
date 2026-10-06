# Atelier CPCéleste — alpha 0.25

L’atelier sépare outils du projet à gauche, code au centre, assistant IA à droite et sorties en bas. La barre d’activité donne accès à l’explorateur, la recherche, Git, les documents, la référence BASIC, la récupération et les ROM. Les menus reprennent ces fonctions ; Git propose accès au panneau, actualisation, historique et préparation du formulaire de commit. Le panneau conserve aperçu/confirmation pour les mutations Git.

Un seul menu reste ouvert. Clic extérieur, Échap, Tab, perte de focus et activation d’une commande le ferment. Les flèches naviguent parmi les actions et les menus. Les actions comportent des icônes SVG et des noms accessibles.

## Raccourcis

| Action | Clavier / souris |
| --- | --- |
| Palette / ouverture rapide | Ctrl Maj P / Ctrl P |
| Listing / projet | Ctrl O / Ctrl Maj O |
| Enregistrer actif / tout / sous | Ctrl S / Ctrl Maj S / Ctrl Alt S |
| Explorateur / recherche projet / Git | Ctrl Maj E / Ctrl Maj F / Ctrl Maj G |
| Documents / IA / ROM | Ctrl Maj D / Ctrl Maj A / Ctrl Alt R |
| Outils / sorties | Ctrl B / Ctrl J |
| Terminal | Ctrl ` |
| Exécuter / référence | F5 / F1 |
| Problème suivant / précédent | F8 / Maj F8 |
| Source suivante / précédente | Ctrl Tab / Ctrl Maj Tab |
| Fermer une vue de source | Ctrl W, bouton × ou clic molette ; buffer conservé |
| Cible BASIC | F12 ou Ctrl clic |
| Recherche / remplacement / ligne physique | Ctrl F / Ctrl H / Ctrl G |
| Complétion / renumérotation | Ctrl Espace / Ctrl Maj R |
| Commenter / décommenter | Ctrl / ; numéro BASIC conservé |
| Dupliquer / déplacer / supprimer une ligne | Maj Alt ↓ / Alt ↑ ou ↓ / Ctrl Maj K |
| Ajouter occurrence / curseur | Ctrl D / Alt clic |
| Zoom du code | Ctrl molette ; commandes de menu |
| Actions de source / code | Clic droit ; Maj F10 ou touche menu sur un onglet |

Outils → Raccourcis clavier et souris présente la fiche intégrée. Les actions d’atelier acceptent Cmd sur macOS ; la recette interactive de cette plateforme reste à réaliser. Les modèles et états undo des sources restent présents quand leur vue se ferme ; la dernière vue est conservée. Le clic molette ferme après relâchement, hors focus de saisie, pour éviter le collage de la sélection primaire sous Linux. Entrée dans l’ouverture rapide est consommée avant le retour au code.

## Diagnostics avant exécution

Les expressions ordinaires d’affectation, MODE/MEMORY/ERROR/WHILE et conditions IF passent par un parser Pratt. L’analyse détecte notamment opérateur/argument manquant, instruction inconnue évidente, parenthèses non équilibrées et formes IF/FOR incomplètes. Les contraintes de numérotation, cibles littérales et export existantes s’ajoutent à ces inspections. Les erreurs sont visibles dans le code, la marge, la règle et la liste des problèmes ; clic/F8 naviguent à la position physique.

Les commentaires, chaînes, DATA et RSX ne sont pas interprétés comme du code. Les formes compactes ambiguës et certaines grammaires natives restent opaques. Un listing sans diagnostic n’est pas garanti exécutable. Cette analyse supplémentaire de l’éditeur ne modifie pas les règles de construction DSK ni les préconditions de renumérotation.

## Paramètres et retours utilisateurs

Outils → Paramètres (Ctrl/Cmd virgule) applique des réglages conservés entre les sessions : thèmes clair/sombre/système, police et taille, indentation et espaces, retour visuel, parenthèses, minimap, largeurs des colonnes et hauteur des sorties. Les valeurs initiales de renumérotation sont configurables. L’annulation conserve les anciens réglages et le bouton valeurs par défaut prépare leur restauration.

L’enregistrement automatique est désactivé par défaut. Une fois activé, une pause de saisie enregistre les sources du projet par le chemin natif existant, avec contrôle des conflits disque. Il se suspend pendant les opérations disque, missions IA et commandes terminal. Le statut affiche Auto-save. Les listings isolés restent enregistrés avec Ctrl S.

Le dock propose aussi Git : journal paginé des commits, actualisation et chargement des pages suivantes. Git → Historique des commits ouvre cette zone. Il s’agit de l’historique des commits, pas d’une console de commandes Git.

Aide → Proposer une amélioration ou signaler un problème ouvre un formulaire de retour, disponible aussi dans la palette. Usage, difficulté et résultat attendu composent une description copiable et consultable. Le bouton ouvre un ticket GitHub prérempli dans le navigateur ; l’utilisateur le relit et le publie avec son compte. Les tickets sont publics et seules les saisies du formulaire composent le ticket. [ADR 0032](../adr/0032-preferences-et-retours-utilisateurs.md).

## Recette

L’assistant propose désormais un menu déroulant chargé par l’API officielle OpenAI avec la clé configurée. Il faut choisir un modèle après chaque nouvelle connexion. La liste est triée par création, datée et actualisée à la demande ou toutes les 15 minutes au repos ; un échec conserve la dernière liste explicitement datée. Les modèles dont le retrait est annoncé portent la date ; ceux déjà retirés sont exclus. La disponibilité API ne prouve pas la prise en charge des outils : voir [ADR 0031](../adr/0031-catalogue-modeles-openai-dynamique.md).

```sh
npm run typecheck
npm test
npm run build:desktop
npm run test:editor
xvfb-run -a npm run test:desktop
python scripts/check_specs.py --schemas
```

La recette navigateur vérifie aussi fermeture/réouverture de buffers modifiés, undo/redo entre sources, absence de collage molette et de saut de ligne parasite dans l’ouverture rapide, puis menus exclusifs, focus/flèches/Échap/clic extérieur, réouverture de la recherche par raccourci, panneaux masquables, Git découvrable, assistant séparé, icônes, trois erreurs pendant la saisie, F8, commentaire BASIC et éditeur visible pendant l’exécution. Les recettes Electron conservent les contrôles de persistence, IA, documents, terminal, Git, récupération et protection des buffers. Les preuves sont produites dans `out/` et publiées par CI ; aucune ROM dans Git.

Cette tranche améliore l’ergonomie de l’alpha sans qualifier le produit 1.0 : explorateur intégral des fichiers, séparateurs déplaçables, ancrage/fenêtres détachées, keymap configurable, parser BASIC complet, PTY et branches/synchronisation Git restent ouverts. Voir [ADR 0030](../adr/0030-atelier-menus-diagnostics.md).
