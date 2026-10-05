# Agent de programmation OpenAI — alpha 0.6

Date : 2026-10-03. [ADR 0011](../adr/0011-agent-openai-metier.md). Périmètre : projets BASIC de l'alpha 0.5, sans pièces jointes ni exécution CPC. L'expérience vise celle d'un agent d'IDE ; ce n'est pas le plugin Codex officiel.

## Utilisation

Construire/lancer l'application avec les commandes du README. Ouvrir ou créer un projet. Dans **Agent de programmation**, conserver le modèle proposé ou fournir un ID Responses compatible, saisir sa clé API OpenAI puis cliquer **Configurer la clé**. La saisie est vidée et la clé reste uniquement en mémoire du main. Cette configuration ne vérifie pas l'accès distant ; les erreurs de clé/modèle/quota apparaissent lors de la mission. **Oublier la clé** retire la configuration, sans modifier les sources.

Saisir par exemple : « Crée un écran de titre CPC en MODE 1 avec PRINT, puis construis le DSK. Consulte les références du langage. » Cliquer **Lancer l'agent** autorise les sources déclarées sous `src/`, leur transmission progressive à OpenAI et leurs mutations locales réversibles. Chaque fichier utile n'a pas besoin d'une confirmation supplémentaire. La clé doit avoir un accès API et la facturation adaptée au modèle ; l'abonnement ChatGPT n'est pas la clé de cette application.

Le journal montre tours, outils et messages publics ; les totaux de tokens sont connus à la fin. Les sources sont enregistrées automatiquement après les mutations réussies et les onglets synchronisés par polling, sans copier/coller de la réponse. Les buffers manuels de départ sont inclus dans le snapshot ; un fichier non touché conserve sa version disque distincte. Pendant la mission, les commandes disque et l'édition manuelle sont verrouillées. L'arrêt interrompt le prochain travail et la requête en cours, sans annuler les étapes déjà enregistrées.

Une consigne de suivi rejoint le prochain tour modèle. La comparaison **Avant/Après** montre les fichiers modifiés/créés. **Restaurer le checkpoint initial** vérifie que les buffers n'ont pas changé depuis la mission et que le disque correspond aux dernières empreintes connues. En cas de conflit, restauration refusée et edits étrangers conservés. Une restauration réussie remet versions disque, manifeste et buffers initiaux, et retire seulement les sources créées par la mission. Le contrôle CRLF préserve les octets des fichiers non touchés ; une source effectivement réécrite suit la normalisation LF de l'éditeur.

## Outils disponibles

Depuis l'alpha 0.8, [language_renumber](renumber-alpha.md) réalise une transformation conservatrice des numéros et références, avec le même contrôle de mutation/checkpoint. Les capacités ci-dessous décrivent la tranche initiale 0.6.

Depuis l'alpha 0.9, [documents_list, documents_read_text et documents_search](documents-alpha.md) consultent les copies TXT/MD explicitement autorisées au lancement. Aucun contenu documentaire complet n'est envoyé automatiquement ; la liste documentaire est préservée par les mutations/restaurations, avec refus si elle a changé depuis la mission.

Les aliases API utilisent underscores ; leur fonction correspond au catalogue métier du document 14.

Depuis l'alpha 0.10, [documents_inspect_image](images-alpha.md) retourne un aperçu PNG nettoyé des PNG/JPEG autorisés sous forme de contenu image Responses avec provenance. Pas de transmission initiale de pixels, OCR qualifié ou conversion CPC ; modèle vision requis et recette distante réelle différée.

| Outil | Preuve/capacité réelle |
| --- | --- |
| `project_list_files` | Liste complète des IDs/chemins CPC et hashes des buffers autorisés |
| `project_read_file` | 1–200 lignes, 16 Kio d'extrait maximum ; hash du fichier entier et pagination explicite |
| `project_search` | Recherche littérale insensible à la casse ; 30 résultats maximum, total/troncature annoncés |
| `reference_search`, `reference_read` | 48 fiches éditoriales et sources fournies, empreintes/provenance ; HTML extrait comme texte inerte |
| `project_replace_source` | Hash de base, limites, commandes couvertes consultées, écriture réelle et nouveau hash |
| `project_create_source` | Source plate 8.3, destination absente, fichier réel et manifeste validé |
| `language_analyze` | Diagnostics partiels de toutes les sources, pas une grammaire complète |
| `build_project` | DSK réellement construit/relu ; hash, taille et noms CPC ; aucune preuve de RUN |

Une commande couverte par les fiches doit être lue avant introduction dans une mutation. Lire un intervalle d'un original ne prétend pas qualifier toutes les commandes. Les commandes hors fiches et les familles complètes restent à enrichir ; le bilan et les prompts signalent la couverture partielle. Les originaux sont importés dans le build desktop sans modification et gardent leurs conditions tierces. Aucun script du snapshot HTML n'est exécuté.

## API, secret et budgets

Requête HTTPS fixe vers `api.openai.com/v1/responses`, authentification en main, redirection refusée, outils `strict`, propriétés exactes, `parallel_tool_calls:false`, `store:false`. Les sorties de reasoning sont retransmises avec les résultats d'outils et leur contenu chiffré est demandé. Le contexte reste local pendant la mission, sans `previous_response_id` stocké. `store:false` ne constitue pas une promesse d'absence de toute conservation fournisseur : voir [politiques API](https://developers.openai.com/api/docs/guides/your-data).

Limites de cette tranche : 12 tours, 60 appels, 60 000 tokens d'usage agrégé observé, 15 minutes, timeout HTTP 90 secondes, 4096 tokens de sortie par requête, réponse 1 Mio et historique de requête 512 K caractères. Un appel déjà traité peut avoir un coût après annulation ; le compteur n'est pas un plafond monétaire exact. Aucun tarif EUR inventé. Les projets/versions disque de mission sont limités à 256 Kio, 64 Kio par source. Les grands projets restent éditables hors mission.

Une réponse incomplète ou invalide ne déclenche aucun outil. Le même `callId` rejoué renvoie son résultat en mémoire ; des arguments différents échouent. Trois erreurs identiques pour le même appel déclenchent une stagnation. Un bilan fournisseur sans construction réussie de la révision finale est `blocked` ; une fin avec build indique toujours la limite structurelle, sans exécution CPC. Les tours/calls/context/tokens arrêtent la boucle aux frontières d'outils ; pas de continuation automatique facturable.

## Checkpoints et récupération

**Évolution 0.21** : les écritures de sources/manifeste disposent désormais d’un [journal durable de mutation et d’une reprise native](agent-durability-alpha.md). Les limites ci-dessous décrivent le checkpoint de conversation/mission 0.6, distinct du journal de mutation ; elles ne signifient plus que les écritures de projet sont dépourvues de reprise.

Le main écrit `<userData>/agent-checkpoints/<taskId>/checkpoint.json`, permissions demandées 0700/0600 sur les hôtes POSIX. Il contient manifeste, sources avant/après, versions disque et brouillons initiaux, phase, résultats et activité publique. Ni clé, ni ROM, ni conversation complète du fournisseur ; il est hors projet/Git/DSK. Ce contenu est privé et peut inclure le texte du projet. Les ACL Windows héritent du profil utilisateur ; aucun chiffrement du checkpoint n'est revendiqué.

Les phases initial/prepared/committed/finished/restore-prepared/restored aident à examiner un incident. En cas de crash, **ne pas rejouer les mutations automatiquement** : copier d'abord le projet courant et le checkpoint, comparer leurs fichiers, restaurer les sources initiales dans un dossier de travail séparé, puis seulement reprendre volontairement. Il n'y a pas encore de navigateur de checkpoints, migration, effacement UI ou reprise après redémarrage. La restauration du bouton ne concerne que la mission courante dans le processus courant. Un échec de journal ou rollback est signalé ; le projet est bloqué si la restauration in-process est incomplète. Les courses avec un processus externe entre contrôle hash et rename, et la panne électrique, restent ouvertes.

## Vérification et suite

Local : typecheck, **43 tests**, construction desktop, contrôle documentation/schémas et parcours Chromium. Les sept tests dédiés couvrent préconditions/scope/références, boucle correction/build, reasoning, replay `callId`, annulation tardive, steering/budgets, HTTP/secret et batch/rollback/restauration. Le daemon agent-browser n'a pas démarré ; le parcours Playwright existant et sa capture sont les preuves navigateur effectives.

Le parcours Electron étendu utilise un transport contrôlé en remplaçant `fetch` seulement dans le processus de test : il exerce le vrai adaptateur Responses, le main/preload/renderer, les outils et fichiers réels, les drafts, checkpoint, comparaison, conflit de restauration et arrêt. Aucun endpoint alternatif ni mode de simulation n'est exposé par le produit. Consulter le résultat réel du workflow `Desktop editor` dans la PR ; sa seule configuration ne vaut pas réussite. Aucun appel OpenAI facturé ou programme CPC réel n'a été exécuté par ces tests.

Contribution partielle à J5-01/02/03/04/05, REQ-AI et ACC-15/18/22/27/28/29/30 selon les capacités ci-dessus ; aucun de ces scénarios globaux n'est clôturé. Suite : recette volontaire avec clé réelle, crash recovery transactionnel, persistance clé via stockage OS sûr, pause/reprise, continuation de budget, modes Revue/Explication, documents/images/PDF et outils de machine qualifiée. [Intégration de l'émulateur](emulator-integration.md).
