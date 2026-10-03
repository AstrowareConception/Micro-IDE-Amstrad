# 02 — Interface et parcours

## Organisation de l'atelier

La fenêtre principale dispose de quatre espaces redimensionnables : explorateur de projet à gauche, éditeur central, machine CPC à droite et panneau inférieur pour problèmes, construction et disque. L'assistant utilise un volet latéral ouvrable ; lorsqu'il est ouvert sur une petite fenêtre, l'utilisateur peut alterner machine et assistant sans réduire le listing à quelques caractères. La disposition est mémorisée par utilisateur, pas imposée au projet partagé.

La barre supérieure affiche le projet, la cible exacte, l'état d'enregistrement et les actions **Vérifier**, **Exécuter**, **Pause/Reprendre**, **Interrompre**, **Réinitialiser** et **Exporter DSK**. Les actions indisponibles expliquent pourquoi : ROM absente, diagnostic bloquant, construction en cours, aucune session. Le bouton Exécuter construit la révision choisie puis lance sa disquette ; il ne masque pas un échec de construction par l'exécution d'une version précédente.

| Zone | Informations essentielles | Actions |
| --- | --- | --- |
| Projet | Sources, ressources CPC, documents de contexte, profil | Nouveau, importer, renommer, révéler dans le dossier |
| Éditeur | Onglets, ligne physique/BASIC, diagnostics, sélection | Chercher, renuméroter, compléter, expliquer la sélection |
| Machine | Profil, révision exécutée, état, focus clavier | Pause, ESC, reset, son, zoom, joystick, capture |
| Problèmes | Gravité, code, fichier, plage, provenance | Aller à la ligne, voir l'aide, donner à l'IA |
| Disque | Noms 8.3, tailles logiques, allocation, capacité | Export de construction ou copie modifiée en session |
| Assistant | Intention, contexte choisi, réponse, proposition | Ajouter pièce, envoyer, annuler, comparer, appliquer |

L'écran CPC est affiché à une échelle entière lorsque possible, avec correction optionnelle du rapport d'aspect. Le mode pixel net est le défaut ; un effet CRT est une option cosmétique ultérieure. Aucun effet ne doit changer les données de capture utilisées pour la recette.

## Première ouverture

L'accueil propose **Créer un projet**, **Ouvrir un projet**, **Essayer le listing d'exemple**. La configuration ROM indique les trois composants 6128 nécessaires et permet d'importer un fichier combiné valide ou des fichiers de 16 Ko distincts. Elle explique leur rôle, montre les empreintes et signale un jeu non qualifié. Le produit ne fournit ni lien de téléchargement douteux ni promesse implicite de firmware inclus.

Un projet peut être créé et édité avant cette configuration. Exécuter donne accès à la configuration manquante. Le parcours IA est indépendant : configuration du fournisseur à la première demande d'assistance, sans compte du produit. Une fiche courte présente les trois gestes principaux : écrire, exécuter, exporter. Les détails techniques restent dans l'aide contextuelle.

## Écrire et exécuter

1. Choisir le dossier, le nom et le profil 6128 ; un `MAIN.BAS` numéroté est créé.
2. Éditer ; l'analyse différée annule ses résultats périmés si la source change.
3. Appuyer sur F5 ou Exécuter. Les buffers concernés sont proposés à l'enregistrement ; Annuler laisse la session existante intacte.
4. Un rapport de construction indique la révision, les avertissements et le disque produit.
5. Si une session existe, l'outil annonce qu'un nouveau lancement la réinitialise et propose de conserver sa copie de disque modifiée. Le choix peut être mémorisé dans les préférences.
6. Le clavier va à la machine seulement lorsqu'elle reçoit explicitement le focus. Une bordure et un texte l'indiquent.
7. Revenir à l'éditeur restitue ses raccourcis ; toutes les touches CPC pressées sont relâchées.

La touche ESC dans la machine correspond à ESC CPC. Un bouton visible permet l'interruption même si le clavier est capturé. La pause de l'émulateur fige aussi le temps émulé et l'audio ; elle ne remplace pas l'instruction BASIC STOP. Un raccourci hôte dédié doit toujours sortir du focus machine, y compris lorsque le programme redéfinit ses touches.

## Décrire une intention avec pièces jointes

L'utilisateur écrit sa demande, choisit **Créer**, **Modifier**, **Expliquer** ou **Diagnostiquer**, et sélectionne les sources utiles. Chaque pièce montre type, taille, rôle et mode de transmission : extrait texte, image ou pages rendues. Le volet contexte récapitule explicitement fichiers, pages, sélection de code, capture et cible. Les références de langage fournies par l'application sont identifiées séparément.

L'envoi démarre un état visible avec possibilité d'annulation. Le texte arrive progressivement, mais les modifications ne deviennent applicables qu'après validation de la réponse complète. Le diff oppose la révision transmise au résultat proposé. Les diagnostics sont recalculés sur cette proposition. Le bouton **Appliquer** indique le nombre de fichiers acceptés ; les opérations sont atomiques sur cette sélection. Les fichiers non acceptés restent hors transaction.

Si l'utilisateur a changé une source pendant la génération, la proposition devient périmée. L'interface ne transforme pas un diff périmé en remplacement forcé ; elle propose comparaison manuelle ou nouvelle génération. Après application, **Exécuter** reste une action distincte. **Annuler la proposition** restaure la base seulement si les documents concernés n'ont pas changé depuis ; sinon une comparaison évite d'écraser le travail récent.

## Importer et convertir une image

L'import initial ajoute un document. **Convertir pour le CPC** ouvre un outil avec original, aperçu CPC et paramètres : mode, cadrage, fond, palette verrouillée ou optimisée, tramage, adresse standard. Un compteur indique couleurs et taille binaire. Le choix valide une recette reproductible et ajoute une ressource ; une proposition BASIC montre MODE, INK et LOAD requis. L'utilisateur choisit son emplacement dans le listing.

Une conversion n'écrit jamais automatiquement `MEMORY` ou `LOAD` dans le programme. L'IDE explique les conflits d'adresse possibles et relie le résultat au profil. Le texte d'un PDF scanné ne surgit pas dans l'aperçu : le mode visuel doit être sélectionné et le fournisseur compatible.

## Exporter

Une boîte affiche la révision à exporter, les fichiers 8.3, les ressources sélectionnées et l'espace libre. Deux sources d'export sont nommées sans ambiguïté : **Disquette construite depuis les sources** et **Disquette modifiée pendant l'exécution**. La seconde n'est pas reproductible à partir des seules sources et reçoit un rapport de provenance distinct.

Le résultat affiche le chemin et `RUN"MAIN.BAS"`. Un bouton ouvre le dossier ; aucune fenêtre externe n'est ouverte sans cette action. « Export réussi » signifie fichier final écrit et relu avec contrôles, pas programme intégralement validé. La dernière exécution et la validation externe, lorsqu'elles existent, sont présentées séparément.

## Accessibilité et messages

Tout état possède un libellé et pas seulement une couleur. Les commandes disposent d'une navigation clavier, d'un ordre de focus stable et d'une aide de raccourci. Les dialogues ne cachent pas l'action permettant de récupérer le travail. Taille de police, thème clair/sombre et largeur des panneaux sont réglables. Les messages montrent le problème, son emplacement et une action possible.

Exemples : « La ligne 120 vise la ligne 900, absente du programme. Aller à 120. » ; « Le nom IMAGE-DEBUT.BIN dépasse 8 caractères. Choisir un nom CPC. » ; « Ce PDF ne contient pas de texte extractible. Choisir des pages pour analyse visuelle. » ; « Cette réponse utilise une version antérieure de MAIN.BAS. Comparer avant d'appliquer. »

Les confirmations de l'application sont limitées aux pertes potentielles, transmissions choisies et changements IA. La politique produit doit permettre des préférences explicites afin de ne pas transformer chaque action courante en obstacle.
