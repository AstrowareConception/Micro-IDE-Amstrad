# ADR 0013 — Documents texte incrémentaux

Date : 2026-10-04. Statut : acceptée pour l'alpha 0.9.

## Contexte

L'agent de programmation doit exploiter les ressources du projet, indépendamment de la recette firmware reportée. Le contrat de projet v1 contient déjà les métadonnées documentaires. Le MVP multimodal reste plus large que la présente tranche.

## Décision

Implémenter TXT/MD UTF-8 avec les APIs existantes, sans dépendance supplémentaire. Le main importe un fichier ordinaire choisi dans le sélecteur natif, conserve ses octets dans `documents/`, calcule SHA-256 et publie le manifeste après la copie. Les fichiers sont identifiés par UUID, sans utiliser le nom original comme chemin de destination. Chaque lecture vérifie le hash ; les symlinks/jonctions du projet sont refusés. Les contrôles du descripteur limitent taille et remplacement pendant la lecture ; aucune résistance absolue aux processus hôtes concurrents n'est revendiquée.

Limites provisoires plus strictes que la cible du document 08 : 1 Mio par document, 4 Mio et 10 documents par projet. L'encodage UTF-8 doit être valide ; BOM initial autorisé et CRLF conservés dans l'original. Seule la vue dérivée enlève le BOM et normalise LF. NUL, contrôles binaires et UTF-16 sont refusés. La validation du contenu s'ajoute à l'extension TXT/MD ; aucun HTML/Markdown n'est exécuté ni rendu comme page.

Le consentement documentaire est désactivé par défaut et réinitialisé à chaque ouverture de projet. Lorsqu'il est activé au lancement, tous les documents déclarés et vérifiés du projet forment le scope documentaire de cette mission. Le contexte initial transmet seulement leurs métadonnées ; des outils bornés retournent les extraits utiles. Aucun outil de mutation documentaire, shell, ouverture de liens ou accès à un chemin hôte arbitraire n'est ajouté. Le texte fourni ne peut pas donner de droits ni satisfaire les consultations obligatoires du corpus BASIC.

Les snapshots documentaires sont privés à la mission, séparés des buffers BASIC. La mutation et la restauration des sources conservent la liste documentaire ; une liste modifiée depuis le checkpoint refuse la restauration avant toute écriture. Les documents ne participent pas au build DSK.

## Conséquences

Le schéma v1 reste compatible ; son sous-ensemble runtime s'élargit aux documents texte. Les types image/PDF, ressources binaires, encodages et quotas du MVP restent explicitement refusés, sans perte silencieuse. Ni J4 ni J5 n'est déclaré terminé. Export de projet partagé, suppression/remplacement documentaire, sélection individuelle pour mission, extraction PDF et conversion d'image sont des incréments ultérieurs. La reprise après crash continue de suivre les limites de l'ADR 0011.
