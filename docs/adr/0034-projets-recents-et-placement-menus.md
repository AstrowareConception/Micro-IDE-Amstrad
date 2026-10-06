# ADR 0034 — Projets récents et placement des menus

Statut : acceptée pour l’alpha 0.27. Date : 2026-10-06.

## Contexte

L’alignement à droite appliqué aux menus à partir du cinquième bouton coupe le menu Projet sur certaines fenêtres. L’utilisateur demande aussi un accès aux projets ouverts précédemment.

## Décision

Le menu actif est mesuré avant affichage, placé sous son bouton et recadré horizontalement dans le viewport. Sa hauteur disponible est limitée, avec défilement. ResizeObserver et resize/scroll mettent à jour la géométrie. L’ancienne règle fondée sur l’index du menu est retirée. Les menus conservent leur exclusivité, navigation et niveau d’affichage au-dessus des panneaux flottants.

Un port applicatif RecentProjects expose liste, ouverture par identifiant opaque, retrait et oubli. L’adaptateur main conserve un fichier privé versionné de 128 Kio maximum, vingt entrées : clé UUID, identifiant de projet, nom, racine canonique et dernière ouverture. Un succès d’ouverture/création promeut la racine, sans doublon. La préférence est remplacée atomiquement avec les primitives existantes. Registre invalide, version inconnue ou lien sont conservés ; une erreur de mémorisation n’annule pas l’ouverture réussie.

Le renderer ne fournit pas de chemin à l’IPC de réouverture ; main résout l’identifiant dans le registre. L’identité du projet est comparée avant les reprises. La réouverture partage la fonction d’ouverture ordinaire : récupération agent/sauvegarde, chargement des documents et sources, session renouvelée seulement après succès. Une entrée périmée produit une erreur explicite ; aucune substitution silencieuse, suppression automatique ou perte du projet courant. La présence de dossier/manifeste est une indication, pas une validation intégrale.

Fichier → Projets récents, palette et Ctrl/Cmd R ouvrent un dialogue avec recherche nom/dossier, dates, sélection, retrait, effacement et choix d’un autre dossier. Les chemins restent dans le profil/renderer de l’utilisateur, jamais ajoutés au contexte agent, DSK ou ticket de retour. Effacer concerne la préférence seulement. Les projets ouverts avant cet incrément doivent être ouverts une fois pour entrer dans le registre.

## Vérification et limites

Tests de registry/persistence/déduplication/borne, erreurs, chemins déplacés et non-suppression. Recette navigateur des huit menus et trois tailles, puis liste/filtre/annulation dirty/erreur/retrait/oubli/raccourci. Recette Electron avec dossiers réels, identifiant de projet remplacé, refus de racine arbitraire, réouverture sans chooser et persistence après redémarrage. Le circuit de reprise existant reste couvert par la recette native complète.

Les modèles de projets et l’assistant de démarrage d’IDE-005 restent ouverts. Pas de recherche automatique des projets déplacés ni de partage de la liste entre ordinateurs. La durabilité électrique globale Windows et la concurrence de plusieurs processus écrivant un profil ne sont pas qualifiées par cette préférence.
