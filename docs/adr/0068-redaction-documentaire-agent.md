# ADR 0068 — Rédaction documentaire par l’agent

- Date : 2026-10-14
- Statut : accepté, alpha 0.41.10

## Besoin

L’espace Connaissances permet l’édition humaine et la consultation du corpus. L’agent doit maintenant conserver ses analyses, roadmaps et journaux sous forme de notes Markdown lisibles, sans transformer une référence importée en document modifiable ni effacer une décision humaine. Une mission peut toucher simultanément le code et la documentation ; son checkpoint doit couvrir les deux.

## Décision

Deux outils sont ajoutés au catalogue BASIC et Z80 : `documents_create_note` et `documents_replace_note`. Les nouvelles notes sont consultables par défaut. Le remplacement exige une note éditable dans le corpus autorisé, une lecture réelle avec `documents_read_text` et sa révision exacte. Le catalogue indique la capacité d’édition ; une simple liste ne suffit pas à autoriser un remplacement. Aucun outil ne supprime une note, n’élève son accès à Essentiel ou ne modifie les politiques. Les références importées restent immuables. Le prompt demande de préserver les apports humains et de séparer faits, hypothèses et vérifications restantes ; cette distinction éditoriale n’est pas un oracle de vérité.

Le contrôleur vérifie le snapshot courant avant la mutation, écrit une préparation de checkpoint privé, puis utilise la publication de versions Markdown immuables de l’ADR 0067. Le manifeste n’est déplacé qu’après l’écriture de la nouvelle version. L’adoption en mémoire suit immédiatement le commit disque ; une erreur ultérieure du journal arrête la mission et conserve l’état enregistré. Les lectures et recherches de mission sont mises à jour, y compris après une pause.

La restauration globale utilise le journal de projet existant. Pour le mode agent uniquement, celui-ci accepte des changements de pointeurs de notes éditables autorisées, sans changement de métadonnées fixes, et un snapshot borné de `binary-z80.json` pour les projets Z80. Les références des deux côtés sont vérifiées avant chaque étape. Les sources BASIC restent soumises aux bornes précédentes ; l’analyse Z80 est bornée à 1 Mio. Les versions Markdown ne sont ni écrasées ni supprimées. Une note créée par la mission quitte le corpus actif lors de la restauration, mais son fichier reste sur disque. Le choix de reprise après interruption couvre manifeste, sources et analyse. Les journaux d’organisation humaine des sources conservent leurs règles antérieures.

## Interface et limites

Le bilan affiche les notes créées/révisées, une comparaison textuelle bornée et un accès direct au lecteur. La liste et le document ouvert s’actualisent après adoption. Un brouillon documentaire interdit lancement, reprise et restauration. Le bouton Documenter avec l’IA prépare une consigne modifiable ; il ne lance aucun appel fournisseur.

La construction DSK finale demeure requise par le contrôleur, même pour une mission documentaire ; elle ne valide ni le Markdown ni ses affirmations. Aucun RUN CPC, outil web, shell, import de fichiers externes, recherche vectorielle ou nouvelle dépendance n’est ajouté. La restauration de la mission complète reste disponible dans la session ; après redémarrage, la reprise porte sur une transaction interrompue, pas sur la conversation IA entière. La concurrence multi-fenêtres et la panne matérielle universelle restent hors qualification.

## Vérification

Tests de frontières, de révisions et d’imports immuables ; missions contrôlées BASIC/Z80, pause/reprise, restauration commune, conflit manuel et interruption avec version altérée ; scénario navigateur avec vrai contrôleur/stockage et recette Electron IPC. Fournisseur simulé, sans clé réelle ni appel facturé. Voir le point de reprise pour les résultats effectivement exécutés.
