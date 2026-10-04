# Reprise des sauvegardes globales — alpha 0.17

Suite R2 et contribution partielle à IDE-007/008. [ADR 0022](../adr/0022-journal-sauvegarde-et-reprise.md), [roadmap](../specifications/17-roadmap-ide-complet.md). Le schéma de projet reste v1 ; aucune nouvelle dépendance.

## Parcours utilisateur

Enregistrer tout garde son parcours 0.16, mais conserve désormais un journal avant la première source écrite. Si l’application s’arrête pendant cette opération, relancer CPCéleste et **Ouvrir projet** sur le même dossier. Un journal pending reconnu déclenche un dialogue natif donnant la date et les fichiers concernés :

| Choix | Résultat |
| --- | --- |
| Annuler, choix par défaut | Aucun fichier de reprise écrit ; la fenêtre actuelle reste intacte |
| Terminer la sauvegarde | Appliquer les sources du snapshot envoyé à Enregistrer tout, puis ouvrir le projet |
| Rétablir les anciennes versions | Remettre les octets précédant le lot, CRLF compris, puis ouvrir le projet |

Les fichiers identiques à la cible ne sont pas réécrits. Les sources/manifeste sont contrôlés de nouveau après le dialogue : un changement externe, un journal altéré ou une version future refuse la récupération et conserve les données. Le message désigne le conflit ; comparer et conserver les versions avant toute intervention manuelle. Aucun écrasement automatique d’une version inconnue n’est proposé. Le journal reste local ; ne pas le supprimer avant examen d’un échec.

Une reprise interrompue reste pending et peut être relancée. Un projet déplacé garde la reprise grâce aux chemins relatifs et à son UUID. Les succès terminaux ne déclenchent pas de nouveau dialogue ; un « Enregistrer tout » sans modification n’écrit pas le journal.

## Données conservées

`.microide/save/pending.json` contient une seule transaction, avant/après de toutes les sources déclarées, leurs SHA-256, le projet, le manifeste et la phase. 1–64 sources, 1 Mio/source, 8 Mio pour chaque ensemble, 24 Mio JSON au maximum. Format strict version 1 et base64 canonique. La phase terminale reste conservée jusqu’au prochain lot modifié ; ce n’est pas encore une liste de versions ni un historique local.

Les fichiers sont privés (0600) et les répertoires nouvellement créés 0700. `.microide` est exclu des projets Git initialisés par l’IDE. Les temporaires interrompus ne sont pas interprétés et sont conservés ; une accumulation de plus de huit fichiers dans le dossier bloque une nouvelle préparation plutôt que de supprimer des fichiers inconnus. La récupération vérifie sources et métadonnées ordinaires sans liens ; le journal ne peut pas désigner un chemin arbitraire.

## Qualification et limites

111 tests Node, dont huit du journal avec six arrêts réels par SIGKILL (trois positions × deux choix). Les processus de fixture utilisent le vrai journal, les vrais remplacements et l’orchestrateur de sauvegarde ; le parent repart uniquement des fichiers. Le contrôle couvre également les originaux CRLF, conflits tardifs, manifeste modifié, versions/corruption/liens, déplacement, révision et no-op. `npm run typecheck`, build desktop, recette navigateur et contrôle documentaire font partie des checks. La recette Electron sandboxée Linux vérifie le vrai parcours d’ouverture/IPC avec sélection native de test : annuler, terminer, restaurer et refus d’une modification externe pendant la confirmation. Capture `out/recovery-alpha.png`, conservée sept jours dans les artefacts du workflow Desktop editor ; résultats effectifs dans la PR.

Pas de garantie de panne électrique ni de stockage réseau ; Windows/macOS restent non qualifiés. Les répertoires sont synchronisés sous Linux ; le cas Windows est explicitement non qualifié. Pas de verrou interprocessus : une course externe entre vérification et rename reste possible. Les buffers jamais soumis à Enregistrer tout restent volatils, et Ctrl S actif seul, agent/manifestes et historique local ne sont pas encore couverts par cette reprise. La récupération ne constitue pas une transaction atomique de projet. Ni R2, ni J1-03, ni ACC-02 ne sont clos.

Prochaine tranche : historique local durable et comparaison/restauration, avec extension de la journalisation aux autres mutations. ROM réelles, API OpenAI réelle et exécution CPC restent des qualifications distinctes.
