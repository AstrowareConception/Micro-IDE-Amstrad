# Projets récents — alpha 0.27

Fichier → Projets récents, la palette et Ctrl/Cmd R ouvrent la liste des vingt derniers projets ouverts ou créés avec succès. Le nom, le dossier complet et la date permettent de distinguer des projets homonymes. Le filtre cherche dans nom et dossier. Cliquer une entrée rouvre ses sources sans sélectionner à nouveau le dossier.

La liste est commune aux projets, conservée dans le profil local de CPCéleste et exclue du manifeste partagé, du DSK et du contexte agent. Réouvrir un projet le remonte en tête, sans doublon de racine canonique. Les projets antérieurs à l’installation de cette version ne sont pas retrouvés automatiquement : les ouvrir une fois les ajoute.

Les mêmes règles qu’Ouvrir projet s’appliquent : arbitrage des brouillons, blocage pendant opérations/terminal/mission, dialogues de reprise de sauvegarde ou mutation agent interrompue, chargement et vérification des fichiers. Annuler ou échouer conserve les buffers et le projet courant. Si un autre identifiant de projet occupe le dossier, une ouverture explicite avec Ouvrir projet est demandée.

Un dossier déplacé/supprimé/inaccessible ou un manifeste absent reste dans la liste, marqué indisponible. Cette présence n’est pas une validation complète du projet ; celle-ci se fait à l’ouverture. Ouvrir un autre projet permet de retrouver un dossier déplacé. Retirer une entrée ou Effacer la liste ne supprime aucun fichier. Une erreur de registre est affichée et n’empêche pas l’ouverture ordinaire ; un échec de mémorisation conserve le projet ouvert avec une information dans le statut.

Les menus se placent sous leur bouton puis se recadrent dans les bords de la fenêtre. Largeur/hauteur et défilement restent bornés ; redimensionnement de fenêtre et variations de contenu recalculent leur position. Les raccourcis et labels peuvent se replier. Le menu Projet ne déborde plus à gauche selon son ancien alignement à droite.

## Vérification

```sh
npm run typecheck
npm test
npm run build:desktop
npm run test:editor
xvfb-run -a npm run test:desktop
python scripts/check_specs.py --schemas
```

Tests du registre : persistence, ordre/déduplication, limite de vingt, racine absente, retrait/oubli sans effacement, identifiants inconnus, registre invalide/surdimensionné/version inconnue et lien symbolique. Le workflow Windows ajoute ces tests au contrôle du toolchain (lien symbolique réservé à Linux).

Recette navigateur : tous les menus entièrement dans le viewport à 1440, 729 et 420 px, liste homonyme, filtre, ouverture, refus d’abandonner un brouillon, erreur visible d’un dossier indisponible, retrait, effacement et raccourci. Recette Electron : racine réelle mémorisée après création/ouverture, réouverture sans chooser, refus d’une racine arbitraire et d’un projet différent, dossier déplacé conservé, persistence après arrêt/redémarrage et parcours de récupération existants. Aucun projet utilisateur ni chemin privé dans les preuves versionnées.
