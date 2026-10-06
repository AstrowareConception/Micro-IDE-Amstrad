# 02 — Interface et parcours

## Organisation de l'atelier

Réalisation partielle 0.14 : [guide atelier](../implementation/workbench-alpha.md), [ADR 0019](../adr/0019-outils-atelier-et-terminal-humain.md). Menus, palette globale, ouverture rapide, contextes éditeur/sources, zoom/minimap, historique Git et terminal humain non interactif sont disponibles. Les tranches 0.24–0.26 ajoutent machine intégrée, préférences, séparateurs et panneaux flottants persistants dans l’IDE ; voir [guide 0.26](../implementation/production-workbench-alpha.md) et [ADR 0033](../adr/0033-panneaux-flottants-et-ecran-cpc.md). Les fonctionnalités restantes ci-dessous sont des cibles produit.

La fenêtre principale sépare outils de projet à gauche, éditeur central, assistant IA à droite et sorties en bas (Problèmes, CPC, Terminal, Git). Les séparateurs ajustent les dimensions ; chaque groupe latéral ou inférieur peut flotter dans l’IDE puis retrouver son ancrage d’origine. La machine utilise commandes à gauche et écran à droite dans les sorties. L'assistant utilise un volet latéral ouvrable ; lorsqu'il est ouvert sur une petite fenêtre, l'utilisateur peut alterner machine et assistant sans réduire le listing à quelques caractères. La disposition est mémorisée par utilisateur, pas imposée au projet partagé.

La barre supérieure affiche le projet, la cible exacte, l'état d'enregistrement et les actions **Vérifier**, **Exécuter**, **Pause/Reprendre**, **Interrompre**, **Réinitialiser** et **Exporter DSK**. Les actions indisponibles expliquent pourquoi : ROM absente, diagnostic bloquant, construction en cours, aucune session. Le bouton Exécuter construit la révision choisie puis lance sa disquette ; il ne masque pas un échec de construction par l'exécution d'une version précédente.

| Zone | Informations essentielles | Actions |
| --- | --- | --- |
| Projet | Sources, ressources CPC, documents de contexte, profil | Nouveau, importer, renommer, révéler dans le dossier |
| Éditeur | Onglets, ligne physique/BASIC, diagnostics, sélection | Chercher, renuméroter, compléter, expliquer la sélection |
| Machine | Profil, révision exécutée, état, focus clavier | Pause, ESC, reset, son, zoom, joystick, capture |
| Problèmes | Gravité, code, fichier, plage, provenance | Aller à la ligne, voir l'aide, donner à l'IA |
| Disque | Noms 8.3, tailles logiques, allocation, capacité | Export de construction ou copie modifiée en session |
| Assistant | Mission, plan, outils, fichiers modifiés, preuves et budget | Agent/Revue/Explication, orienter, suspendre, arrêter, comparer, restaurer |

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

## Confier une mission avec pièces jointes

L'utilisateur écrit sa demande et choisit **Agent** par défaut, **Revue** ou **Explication**. Il peut demander création, modification ou diagnostic. La mission montre les dossiers de code et ressources accessibles, les documents choisis, la cible et le budget. Chaque pièce montre type, taille et rôle. L'agent pourra rechercher et lire progressivement les contenus de ce périmètre, y compris les références du langage, sans demander une confirmation pour chaque extrait.

En mode Agent, le volet affiche plan court, outil en cours, fichiers créés/modifiés, builds et essais. Les changements locaux autorisés sont appliqués par transactions réversibles au fil de la mission et immédiatement visibles dans l'éditeur. L'agent peut convertir une ressource, lancer le CPC, envoyer des touches et lire les observations. Le diff cumulé reste consultable ; il n'est pas une barrière systématique avant chaque écriture.

L'utilisateur peut préciser « garde cette mécanique », « utilise le mode 0 » ou « arrête les essais » pendant le travail. La consigne prend effet à la prochaine frontière d'outil sûre. Une édition manuelle concurrente fait échouer la précondition d'une écriture ; l'agent relit la source et adapte son travail. Arrêter conserve les transactions terminées ; Restaurer permet de revenir à un checkpoint avec arbitrage des edits manuels plus récents.

En mode Revue, les changements restent des propositions jusqu'à application des fichiers choisis ; une réponse fondée sur une source devenue ancienne est marquée périmée. En mode Explication, aucun fichier n'est modifié. Le bilan de mission expose ce qui a changé, ce qui a été testé et ce qui nécessite encore une vérification utilisateur.

## Importer et convertir une image

L'import initial ajoute un document. **Convertir pour le CPC** ouvre un outil avec original, aperçu CPC et paramètres : mode, cadrage, fond, palette verrouillée ou optimisée, tramage, adresse standard. Un compteur indique couleurs et taille binaire. Le choix valide une recette reproductible et ajoute une ressource. En manipulation manuelle, une proposition montre MODE, INK et LOAD ; dans une mission Agent, l'outil peut produire la ressource puis intégrer ces instructions sous contrôle des préconditions et du journal.

Une conversion seule ne modifie pas le programme. L'agent peut l'intégrer dans une étape distincte qui analyse les conflits d'adresse et consulte les références mémoire. Le texte d'un PDF scanné ne surgit pas dans l'aperçu : un outil visuel et un fournisseur compatibles doivent réellement être utilisés.

## Exporter

Une boîte affiche la révision à exporter, les fichiers 8.3, les ressources sélectionnées et l'espace libre. Deux sources d'export sont nommées sans ambiguïté : **Disquette construite depuis les sources** et **Disquette modifiée pendant l'exécution**. La seconde n'est pas reproductible à partir des seules sources et reçoit un rapport de provenance distinct.

Le résultat affiche le chemin et `RUN"MAIN.BAS"`. Un bouton ouvre le dossier ; aucune fenêtre externe n'est ouverte sans cette action. « Export réussi » signifie fichier final écrit et relu avec contrôles, pas programme intégralement validé. La dernière exécution et la validation externe, lorsqu'elles existent, sont présentées séparément.

## Accessibilité et messages

Tout état possède un libellé et pas seulement une couleur. Les commandes disposent d'une navigation clavier, d'un ordre de focus stable et d'une aide de raccourci. Les dialogues ne cachent pas l'action permettant de récupérer le travail. Taille de police, thème clair/sombre et largeur des panneaux sont réglables. Les messages montrent le problème, son emplacement et une action possible.

Exemples : « La ligne 120 vise la ligne 900, absente du programme. Aller à 120. » ; « Le nom IMAGE-DEBUT.BIN dépasse 8 caractères. Choisir un nom CPC. » ; « Ce PDF ne contient pas de texte extractible. Choisir des pages pour analyse visuelle. » ; « Cette réponse utilise une version antérieure de MAIN.BAS. Comparer avant d'appliquer. »

Les confirmations de l'application concernent les pertes potentielles, transmissions choisies, changements IA et commandes hôte du terminal. Dans l’alpha 0.14, chaque commande système est confirmée avec racine et texte exact ; aucune confirmation n’est ajoutée aux menus d’édition ordinaires. La politique produit doit permettre des préférences explicites afin de ne pas transformer chaque action courante en obstacle.
