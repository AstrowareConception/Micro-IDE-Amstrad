# 09 — Assistance IA et orchestration agentique

## Expérience principale

Le mode principal est **Agent** : l'utilisateur confie une mission et l'IA agit sur le projet à l'aide d'outils locaux. Elle parcourt les fichiers, recherche les ressources, consulte le langage, crée ou modifie le code, prépare des assets, construit, lance le CPC, observe les résultats et corrige. Une réponse textuelle seule ne suffit pas à terminer une mission de programmation.

Le premier adaptateur utilise OpenAI Responses API avec appels d'outils et capacités multimodales adaptées. L'orchestrateur appartient à l'application : les outils, permissions, transactions, budgets et résultats ne dépendent pas du fournisseur. Une intégration Codex ou un autre backend pourra être évalué derrière ce port ; la première réalisation ne nécessite pas un terminal hôte pour exposer les outils de l'IDE.

| Mode | Droits et comportement | Résultat |
| --- | --- | --- |
| Agent, défaut | Lit et manipule les fichiers autorisés, construit et teste automatiquement | Projet modifié, preuves, bilan et checkpoints |
| Revue | Explore et analyse, prépare les changements avant application utilisateur | Proposition structurée et diff |
| Explication | Lit le contexte et les références ; aucune mutation | Explication avec provenance |

Créer, modifier et diagnostiquer sont des intentions de mission, pas des modes d'autorisation différents. L'utilisateur peut changer la politique dans l'interface ; l'application ne repasse pas silencieusement du mode Agent au simple copier/coller.

## Mission et périmètre

Une `AgentTask` fixe objectif, projet, cible, mode, dossiers lisibles/transmissibles, documents choisis, outils autorisés et budgets. Le démarrage d'une demande de programmation autorise les opérations locales réversibles correspondant à cette demande dans le périmètre visible. Créer un programme implique créer ses sources et ressources, les analyser et les tester ; aucune confirmation supplémentaire par fichier n'est nécessaire.

Par défaut, sources et ressources du projet sont explorables, les documents ajoutés à la mission sont lisibles, et le corpus BASIC est disponible. Les clés, ROM brutes, configuration sensible et fichiers hôte hors projet sont exclus. Les documents de contexte restent en lecture seule. Écrire un artefact dans les sorties du projet fait partie du travail ; publier, envoyer un message ou exporter vers une nouvelle destination externe reste une action distincte, à autoriser si demandée.

Le périmètre de transmission s'applique aux lectures progressives : un fichier autorisé peut fournir plusieurs extraits au fil de la mission sans revalidation manuelle à chaque tour. Le journal expose les fichiers/pages transmis. Ajouter une nouvelle source privée ou changer de fournisseur doit actualiser ce périmètre explicitement. Les références internes ne donnent jamais le droit de lire tout le poste.

## Boucle d'outils

Le modèle reçoit mission, profil, carte du projet, catalogue d'outils et repères de langage. Il choisit un ou plusieurs appels de lecture. Le runner valide les arguments, exécute les outils et transmet leurs résultats avec références et révisions. Les appels mutatifs sont sérialisés, journalisés et checkpointeront les fichiers concernés avant modification. Le modèle utilise ensuite les résultats pour poursuivre ou conclure.

Les outils couvrent fichiers, références, documents, conversion, analyse, construction et contrôle de la machine. Le [document 14](14-programmation-agentique.md) fixe leurs préconditions et conditions d'arrêt. Les contrats d'outils sont plus importants qu'un prompt demandant de « faire attention ». Aucun appel libre au shell ni pont vers des périphériques hôte arbitraires n'est requis par cette expérience.

Le streaming montre un plan court, une activité et les modifications réalisées. Les arguments d'un appel doivent être complets et valides avant exécution ; un fragment de JSON reçu ne devient pas une mutation. Une réponse fournisseur arrivée après annulation est ignorée. Le runner reste capable de suspendre l'agent même quand la machine CPC boucle.

## Usage actif du Locomotive BASIC

L'agent doit produire le dialecte de la cible, avec ses modes, flux, son, interruptions, fichiers, encodage et mémoire. Il peut rechercher une instruction et lire ses signatures, exemples, contraintes et différences de version. Le corpus initial provient des fichiers fournis et sera enrichi en fiches qualifiées au jalon J2. [Le document 15](15-corpus-locomotive-basic.md) définit couverture et provenance.

Avant d'introduire un usage de langage non déjà documenté dans la mission, l'agent doit consulter les fiches pertinentes ou une source du corpus. Répéter un accès au même fragment inchangé n'est pas nécessaire : le cache de consultation est lié au hash et au dialecte. Chaque famille employée est reliée à ses références dans le journal de validation. Une instruction absente, ambiguë ou propre à une extension reste signalée ; elle ne devient pas une commande CPC par habitude d'un autre BASIC.

Les observations des outils sont prioritaires sur les affirmations du modèle : une erreur de chargement, une ressource absente ou une instruction non qualifiée déclenche un diagnostic ou une correction. La qualité narrative ou les choix de gameplay restent dictés par la demande utilisateur, sans être remplacés par les exemples du corpus.

## Ressources multimodales

Le modèle peut lire TXT/MD, extraire des pages de PDF, examiner des images et convertir une image en écran CPC par le pipeline local. Les rôles restent explicites : inspiration, contexte et ressource embarquée. L'agent ne dépose pas le PDF original sur la disquette parce qu'il l'a lu pour comprendre une règle. Les binaires CPC sont produits par les outils qualifiés, pas inventés dans une réponse base64 opaque.

Un modèle sans vision ne reçoit pas une image en prétendant l'avoir comprise. Le mode PDF texte renvoie réellement les extraits et leurs pages ; le mode visuel rend les pages choisies. OCR automatique et fichiers actifs restent hors MVP. Le budget concerne taille décodée, pages et tokens. Le runner peut réduire des résultats longs par plages, avec indication d'éléments exclus, sans supprimer silencieusement la fin d'un listing indispensable.

## Mutations, concurrence et récupération

L'agent utilise empreinte et version obtenues lors de la lecture. Une mutation échoue si le fichier a changé ; le runner ne remplace pas la source de force. L'agent relit, compare et adapte ou signale un vrai conflit. Une création exige une destination absente ; un renommage doit aussi maintenir le manifeste et les références de fichiers connues. L'application réalise cette maintenance, pas une réécriture libre de la configuration par le modèle.

Une transaction réussie est visible immédiatement. Le checkpoint initial et les checkpoints suivants permettent diff, restauration d'une étape et restauration de la mission. Arrêter la mission conserve les étapes terminées et indique le résultat partiel ; un rollback volontaire vérifie les edits manuels ultérieurs. Le journal durable rend un appel mutatif idempotent : retrouver le même `callId` après une reconnexion ne rejoue pas son effet.

Le mode Revue conserve le [schéma de proposition](../../contracts/ai-proposal.schema.json). Il présente le diff avant application et vérifie révision/empreintes. Cette politique est optionnelle et ne limite pas le mode Agent à des suggestions inertes. Le mode Explication ne dispose pas des outils de mutation ni d'exécution modifiant la session.

## Essais et vérité du bilan

L'agent peut lancer des scénarios bornés : boot, RUN, saisie attendue, capture, observation et disque écrit. Un build réussi ne prouve pas le gameplay ; un écran affiché ne prouve pas absence de bugs. Les tests automatisables doivent avoir résultat attendu et méthode d'observation, comme fichier créé, diagnostic, texte VDU qualifié ou image de mire. Un comportement subjectif est décrit comme à valider par l'utilisateur.

La boucle de correction est normale en mode Agent, mais bornée par tours modèle, appels, cycles build/essai, temps actif et tokens. Une répétition du même diagnostic sur la même empreinte sans progression déclenche arrêt pour stagnation. Limites, absence de ROM, clé invalide ou capacité manquante donnent un bilan de blocage avec les fichiers conservés. L'agent n'annonce pas une exécution qu'il n'a pas obtenue de l'outil.

## Coût et confidentialité

Le budget affiché porte la mission complète et pas seulement son premier message. Compteurs locaux et usage fournisseur sont associés aux appels. L'estimation en euros est disponible seulement avec tarifs identifiés ; les tokens réels sont affichés quand le fournisseur les renvoie. Annuler interrompt les opérations suivantes mais ne garantit pas le remboursement d'une génération déjà traitée.

Une perte réseau ambiguë ne provoque pas une nouvelle génération facturable automatique ; la reprise se base sur l'état de requête et le journal. Les retries d'outils locaux respectent leurs clés d'idempotence. Aucun secret ou prompt privé complet dans les logs techniques. L'historique local détaillé des missions est réglable, effaçable et exclu des exports publics. Les politiques de conservation fournisseur sont indiquées par lien actuel, sans promesse que l'application ne maîtrise pas.

## Consignes de suivi

Le chat reste ouvert pendant une mission. Une consigne de suivi est ajoutée à une file ordonnée et prend effet à la prochaine frontière sûre, sans lancer un second agent écrivain. Pause ne signifie pas annulation ; Reprendre utilise les hashes courants, le contexte conservé et les budgets restants. Une instruction incompatible avec les mutations déjà réalisées produit un nouveau plan ou une restauration proposée, pas une perte silencieuse.

La fin de mission fournit objectif, changements, ressources utilisées, références de langage, tests effectués, limites, coût connu et actions suivantes utiles. L'utilisateur retrouve les sources directement dans l'éditeur et peut continuer manuellement ou par une nouvelle demande.
