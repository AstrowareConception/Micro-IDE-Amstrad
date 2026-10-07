# ADR 0048 — Scénarios BASIC reproductibles et observations exactes

## Statut

Accepté pour l’alpha 0.39.1, deuxième lot de la 0.39, le 7 octobre 2026.

## Contexte

Les suites persistantes regroupent des listings autonomes, mais un programme qui attend une saisie ou un fichier initial ne peut pas encore être vérifié. Le pont CPC expose déjà les touches, le framebuffer et l’export du DSK. Il est possible d’ajouter ces scénarios sans modifier le moteur C ni interpréter le BASIC en JavaScript.

## Décision

Un scénario appartient à son listing et se déclare par des commentaires numérotés entiers. Le domaine reconnaît `@CPCINPUT`, `@CPCFIXTURE`, `@CPCFILE` et `@CPCSCREEN`, selon le [contrat](../specifications/10-donnees-contrats.md). Il conserve les assertions natives `@CPCTEST` et la signature de fin du banc 0.37. Les suites 0.39.0 restent inchangées.

Le clavier est programmé sur le temps émulé après relâchement du RETURN de RUN, avec une résolution de 20 ms, des appuis de 60 ms et des relâchements de 60 ms. Les créneaux ne se chevauchent pas, le budget doit couvrir la séquence entière et un scénario fini avant des appuis encore prévus est bloqué. Les touches sont libérées lors de chaque sortie ; annulation et délai réel restent gérés par le worker jetable.

Les fixtures sont des fichiers ASCII sans en-tête, créés dans une copie du disque autonome. Le fichier MAIN.BAS reste réservé. Aucun chemin hôte, document projet, fichier de l’utilisateur ou disque interactif n’est consulté ou modifié.

À la première signature de fin observée, les vérifications comparent des contenus ASCII exacts du DSK exporté (jusqu’au CTRL-Z, sans normalisation) et des SHA-256 de rectangles RGBA affichés. Les couleurs proviennent de la palette matérielle du moteur, alpha fixé à 255. Une palette, géométrie ou ROM hors profil ne reçoit pas de succès automatique. La comparaison d’écran est exacte : pas d’OCR, de tolérance perceptuelle, de texte déduit ou de validation IA. Le listing doit stabiliser son affichage et fermer ses fichiers avant la signature.

## Résultats et limites

Les observations entrent dans le verdict global et les exports. Le rapport conserve type, nom, ligne, empreintes attendue/observée et verdict, sans contenu attendu des fichiers, séquence saisie, texte de fixture ou ROM. Les anciens rapports restent lisibles ; les nouvelles métadonnées `checks` et `observations` sont facultatives dans le format version 1 et validées ensemble.

Un aperçu des seules zones capturées est disponible pendant la session et téléchargeable en PNG. Il n’est pas conservé dans l’historique ni dans les exports JSON/Markdown. La référence visuelle doit être examinée humainement : aucun bouton ne transforme automatiquement un échec en résultat attendu.

Bornes : 8 saisies, 64 touches ASCII/RETURN au total, 4 fixtures totalisant 4 Kio, 8 observations, 16 384 pixels par rectangle. Les limites BASIC, disque, durée, mémoire et nombre de listings restent actives. La qualification est propre au moteur et au jeu ROM 6128 anglais identifié ; aucun autre émulateur ou matériel réel n’est qualifié par ces tests.
