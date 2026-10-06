# Agent : expérience, reprise et consommation API

Statut : spécification, 6 octobre 2026. Complète [14 — Missions](14-programmation-agentique.md), [15 — Corpus](15-corpus-locomotive-basic.md) et [18 — Incréments](18-increments-ide-production.md). La réalisation initiale et ses limites figurent dans le [rapport 0.29](../implementation/agent-missions-alpha.md).

## Incident de référence et objectif

Mission : « fais moi un ecran de titre pour mon jeu de mahjong en mode 1, le plus détaillé possible ! ecran fixe, je veux de la finesse dans les détails ».

Observé : arrêt `paused-limit` à 12 tours/12 outils/39 888 tokens ; nombreuses recherches, tentative `project_replace_source`, puis recherche ; zéro changement visible. Cela prouve un budget de tours atteint, pas un rejet de clé/modèle ni une erreur BASIC de l’utilisateur. Le suivi vide est valide.

Défaut identifié dans le code antérieur : `reference_search` fournissait les fiches complètes mais ne les comptait pas comme consultées ; l’écriture pouvait ensuite être refusée par `reference-required`. Le journal n’affichait pas les résultats/erreurs d’outils. C’est une explication plausible de la mission rapportée, impossible à confirmer exactement sans ces résultats. Ne pas présenter une hypothèse comme son diagnostic historique certain.

L’objectif produit est qu’un utilisateur puisse décrire son besoin, suivre le travail, voir le résultat ou la cause d’arrêt, puis reprendre/corriger/restaurer sans comprendre le protocole des outils. Augmenter seulement le nombre de tours n’est pas une correction suffisante.

## Configuration distincte de l’usage

**AG-UX-01** — Le panneau agent contient mission, contexte autorisé, démarrer/arrêter/reprendre, messages publics, résultat, changements et consommation. Bouton « Réglages IA » ouvrant une fenêtre dédiée ; clé, catalogue des modèles et budgets ne prennent pas la place de la conversation.

**AG-UX-02** — Réglages : clé masquée conservée côté main, oubli, modèle dans le catalogue officiel accessible au compte, date/actualisation, budgets, disponibilité tarifaire et capacités. Pas de modèle saisi à la main. La liste reste actualisée via `GET /v1/models` ; un modèle candidat n’est pas une preuve de compatibilité outils/vision. Changer de modèle ne transforme pas silencieusement une mission existante.

**AG-UX-03** — La mission suffit ; « Consigne de suivi (facultatif) » permet de préciser pendant le travail. Exemples : palette, nom du jeu, correction d’une préférence. Aucun champ de suivi obligatoire ou instruction cachée nécessaire au succès. Le champ n’autorise jamais l’agent à publier ni élargir le scope.

## Parcours et états

| État présenté | Sens | Actions |
| --- | --- | --- |
| Prêt | Configuration/projet valides | Saisir et lancer une mission |
| En cours | Réponse ou outil en traitement | Arrêter, ajouter une précision |
| En pause — limite atteinte | Budget atteint, travail conservé | Reprendre si contexte encore exploitable ; inspecter/restaurer |
| Validation non obtenue | Fin du modèle sans construction finale réussie | Voir preuve manquante, mission ciblée |
| Erreur | Fournisseur/protocole/contrôleur échoué | Cause visible, fichiers conservés, nouvelle mission |
| Arrêtée | Arrêt volontaire ou délai | Voir dernières étapes conservées |
| Terminée | Modèle terminé et construction finale attestée | Comparer, exécuter humainement, restaurer |

**AG-UX-04** — Indiquer explicitement « Aucun fichier modifié », fichiers enregistrés et validation obtenue. Ne pas afficher seulement « Mission démarrée » après un arrêt. Une tentative d’écriture n’est pas une modification. La réussite du DSK n’est pas la réussite visuelle du jeu.

**AG-UX-05** — Les messages publics du modèle sont lisibles ; le journal technique est repliable. Pour chaque outil : début, réussite/échec, nom et résultat utile (source enregistrée, DSK relu, raison du refus). Les erreurs récentes restent visibles hors du journal. Pas de clé, image base64, sortie documentaire complète ni raisonnement interne dans la restitution.

## Boucle, références et reprise

**AG-RUN-01** — Compter comme consultées uniquement les fiches complètes effectivement retournées par recherche/lecture. `reference_read_many` accepte 1–32 noms et indique fiches/missing/provenance. Une liste de sources ou une plage de corpus ne vaut pas consultation de toutes les fiches. La garde de mutation reste active pour commandes couvertes non consultées et hashes périmés.

**AG-RUN-02** — Éviter les recherches successives inutiles : demander les fiches ensemble, produire une première version après les lectures nécessaires, analyser, construire et corriger. Enregistrer les résultats d’outils pour le tour suivant. Trois erreurs identiques avec arguments identiques mettent en pause avec cause de stagnation. Aucun contournement automatique de scope.

**AG-RUN-03** — Défaut par lancement : 20 tours, 60 appels, 60 000 tokens et 15 minutes. Réglages entiers bornés : 1–100 tours, 1–200 appels, 1 000–500 000 tokens ; contexte limité à 512 Kio JSON, source 64 Kio et ensemble 256 Kio. Le budget tokens est une limite observée après réponse, pouvant être dépassée par celle-ci, jamais un plafond monétaire garanti. Les compteurs de mission sont cumulés et visibles pendant le travail.

**AG-RUN-04** — Une reprise volontaire après limite tours/outils/tokens accorde le même budget supplémentaire. Afficher le budget et la facturation possible avant le bouton. Conserver ID, objectif, conversation, état opaque fournisseur, appels en attente, table d’idempotence, fiches consultées, fichiers, coûts et checkpoint initial. Les outils déjà exécutés ne sont pas rejoués ; un même callId avec arguments différents est refusé.

**AG-RUN-05** — Vérifier projet, manifeste, session, buffers et empreintes disque avant reprise. Une édition humaine/externe bloque avec explication. Restauration, changement de clé ou oubli de clé invalident la reprise ; aucun appel ultérieur avec les identifiants oubliés. Après saturation du contexte ou stagnation, proposer une nouvelle mission ciblée plutôt qu’un bouton répétant le même blocage. Initialement : reprise en mémoire dans la même session, dix continuations maximum ; une fermeture de l’application conserve les journaux de mutations mais pas la conversation complète. Reprise durable de conversation = tranche ultérieure, avec version/migration et confidentialité définies.

**AG-RUN-06** — Une réponse incomplète ou tardive n’exécute pas ses mutations. Comptabiliser son usage connu quand reçu ; absence de réponse réseau ou usage invalide signifie consommation potentielle inconnue. Aucun retry facturable automatique. Timeout fournisseur 90 s ; arrêt/timeout de mission conserve les mutations déjà terminées.

## Tokens et estimation financière

**AG-COST-01** — Enregistrer par réponse : total, entrée, sortie, cache lu/écrit, raisonnement (sous-ensemble de sortie), modèle effectif et service tier. Cumuler l’usage : le contexte et les résultats d’outils sont retransmis aux tours suivants et peuvent consommer des tokens à chaque requête, avec tarification cache lorsqu’elle s’applique ; ne jamais additionner à nouveau le raisonnement aux sorties. Distinguer données complètes, partielles et absentes. Les 39 888 tokens agrégés de l’incident ne permettent pas de reconstruire exactement une facture.

**AG-COST-02** — Le catalogue de modèles ne fournit pas de prix. Charger les tarifs depuis la fiche officielle publique du modèle (`developers.openai.com/api/docs/models/<id>.md`), sans clé ou code envoyé. Profil : modèle exact, USD par million entrée/cache/sortie, règles de cache écrit/contexte long, URL, date de récupération. Vérifier l’identité et refuser format ambigu/nouvelle règle inconnue ; aucune approximation par nom de famille. Catalogue et tarif ont des actualisations distinctes.

**AG-COST-03** — Tarif lu lors du choix du modèle, actualisation manuelle et avant mission si âgé de plus d’une heure. La mission fige sa provenance tarifaire. Si le modèle effectif diffère, le tier diffère, le tarif expire ou l’usage est incomplet, afficher « estimation indisponible ou incomplète », jamais zéro comme facture. Une nouvelle tarification ne réécrit pas rétroactivement les estimations historiques. Alias/snapshots : accepter uniquement le snapshot par défaut explicitement nommé par la fiche officielle ; un ancien snapshot sans correspondance reste inconnu. Le repli d’une URL datée vers la fiche de son alias exige cette correspondance exacte.

Pour chaque réponse complète, avec N tokens d’entrée, C cache lu, W cache écrit, O sortie et prix Pentrée/Pcache/Psortie par million :

`coût = ((N − C − W) × Pentrée + C × Pcache + W × Pentrée × multiplicateurÉcriture + O × Psortie) / 1 000 000`.

Appliquer les majorations de contexte à la réponse concernée avant cumul, jamais au total global de mission. Afficher monnaie, date/provenance et données manquantes. Hors taxes, conversion, promotions/remises et services distants non pris en charge ; facture OpenAI faisant foi. Les outils locaux du projet ne sont pas des outils hébergés facturés par OpenAI. Futur plafond USD optionnel : décision avant requête fondée sur une borne documentée, avec marge et arrêt ; pas un total de tokens multiplié par un tarif unique.

## Contrats et séparation des responsabilités

Le domaine expose budget, événements, résultats/usage, estimation pure et état de reprise interne. Le provider valide les réponses OpenAI ; l’adaptateur de tarification réalise la requête publique et son parsing borné. Le contrôleur possède clé, modèle de mission, état privé de conversation, préconditions et journalisation. L’UI reçoit seulement vue, événements bornés, compteurs et changements. Le schéma persistant de mission du document 14 reste distinct du DTO de vue courant ; aucune conversation opaque/clé n’est ajoutée au projet.

Les futurs paramètres incluent effort de raisonnement/capacités, rétention de missions, coûts historiques, modes Revue/Explication et commande d’exécution CPC. Ne pas exposer un bouton dont la capacité n’est pas réellement disponible.

## Recette et critères d’acceptation

| Recette | Preuve requise |
| --- | --- |
| AG-ACC-01 — Mission Mahjong sans suivi | Explore, consulte en batch, écrit une source MODE 1, analyse/construit ; résultat et limites expliqués |
| AG-ACC-02 — Recherche puis écriture | Fiches complètes reconnues ; commande non consultée toujours bloquée ; erreur visible |
| AG-ACC-03 — Pause à 12 tours | Bouton reprise ; contexte/checkpoint conservés ; fichiers visibles et counters cumulés |
| AG-ACC-04 — Limite pendant appels multiples | File d’attente conservée, chaque outil exécuté une fois ; collision callId refusée |
| AG-ACC-05 — Projet modifié après pause | Reprise refusée ; texte humain/externe conservé ; aucune écriture distante |
| AG-ACC-06 — Tokens/coût | Comptage entrée/cache écrit/lu/sortie/raisonnement, contexte long par requête, données absentes et tarif périmé |
| AG-ACC-07 — Configuration/UI | Clé/modèles dans dialogue ; mission et suivi facultatif séparés ; focus/Escape ; erreur et résultat compréhensibles |
| AG-ACC-08 — Fournisseur/arrêt | 401/429, réponse incomplète, délai, réponse tardive : usage connu conservé, mutations non terminées ignorées |
| AG-ACC-09 — Mission réellement créative | Modèle réel choisi, source et capture relançables examinées ; qualité visuelle évaluée humainement |

Les tests contrôlés couvrent la mécanique et n’appellent pas une API payante. AG-ACC-09 et exécution agent/CPC restent ouverts tant que les outils et preuves ne sont pas disponibles. Une sortie est terminée seulement avec construction réussie de la révision finale ; tests supplémentaires revendiqués uniquement sur résultats réels.

## Sources officielles

- [Liste des modèles](https://developers.openai.com/api/reference/resources/models/methods/list).
- [Responses et usage](https://developers.openai.com/api/reference/resources/responses/methods/create).
- [Prompt caching : usage et calcul cache lu/écrit](https://developers.openai.com/api/docs/guides/prompt-caching).
- [Tarification](https://developers.openai.com/api/docs/pricing).
- [Fiche GPT-5.6 Luna consultée le 6 octobre 2026](https://developers.openai.com/api/docs/models/gpt-5.6-luna) : source illustrative de format/règles, jamais tarif universel ni valeur immuable embarquée.
