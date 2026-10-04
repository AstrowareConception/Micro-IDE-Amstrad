# 11 — Qualité, recette et preuves

## Statut initial

Ce document est un **plan de validation**. À la création du dépôt, les seuls contrôles exécutables concernent cohérence documentaire, JSON Schema et exemples. Aucun boot, taux d'images, lecture matérielle, coût IA ou packaging n'est considéré testé. Chaque jalon produit ensuite un rapport daté avec machine hôte, outils, ROM par empreinte, fixtures, résultat et écarts.

La validation distingue cinq niveaux : contrat de données, règles métier, intégration d'un adaptateur, parcours utilisateur et compatibilité extérieure. Un writer testé avec son propre reader peut partager la même erreur ; une partie des fixtures vient d'une construction indépendante ou d'un essai ROM. Les corpus de référence protégés ne sont pas copiés sans autorisation dans Git.

## Scénarios d'acceptation

| Scénario | Procédure et résultat attendu | Jalon |
| --- | --- | --- |
| ACC-01 | Créer hello, enregistrer, fermer, déplacer le dossier, rouvrir : profil, source et entrée identiques. | J1 |
| ACC-02 | Modifier depuis l'éditeur et un outil externe ; simuler échec d'écriture et version future : conflit visible, aucune perte silencieuse. | J1, complété J6 |
| ACC-03 | Import LF/CRLF et caractères UTF-8 ; vérifier aperçu, annulation, choix d'encodage et listing final sans remplacement caché. | J2 |
| ACC-04 | Corpus de syntaxe valide/invalide et zones opaques : diagnostics localisés, gravité correcte, aide cohérente avec le dialecte. | J2 |
| ACC-05 | Renumérotation avec GOTO, ON, timers, chaînes, REM, DATA, cas GOTO 0 et références externes : seules les références prévues changent. | J2 |
| ACC-06 | Deux builds identiques donnent même DSK ; sources ou recette modifiées changent la clé ; catalogue et rapport concordent. | J3 |
| ACC-07 | Noms longs, collision de casse, manque de blocs ou d'entrées, fichiers absents, export verrouillé : erreur précise et précédent export intact. | J3 |
| ACC-08 | Boot, CAT, RUN, INPUT, boucle et END ; pause, ESC, reset et nouveau lancement : état et révision affichés fidèlement. | J0, intégré J3 |
| ACC-09 | AZERTY, guillemets, chiffres, curseurs, shift/ctrl, INKEY, JOY, SOUND et perte de focus : mapping et libération prouvés. | J0, intégré J3 |
| ACC-10 | Erreur simple, ON ERROR, effacement d'écran et caractères redéfinis : les observations ne prétendent pas plus que leur méthode détecte. | J3 |
| ACC-11 | Export DATA : CAT, RUN, LOAD écran et texte sauvegardé dans un autre émulateur ; essai matériel enregistré si disponible. | J0, J3, J6 |
| ACC-12 | DSK standard, Extended DATA, image tronquée, secteurs atypiques et fichier ambigu : lecture bornée et original intact. | J3 |
| ACC-13 | TXT/MD, image alpha, PDF texte/colonnes/scanné/chiffré : sélection exacte ; écran modes 0/1/2 avec mires qualifiées. | J4 |
| ACC-14 | Tuer worker, fermer brutalement pendant saisie, transaction et export ; reprendre sans corruption et expliquer récupération. | J6 |
| ACC-15 | Fournisseur simulé puis réel choisi : création, explication, correction, multimodal, limite de contexte, annulation, quota et offline. | J5 |
| ACC-16 | Tokeniser/détokeniser puis LOAD/LIST/SAVE/RUN sur ROM : comportement et normalisation connus. | Suite |
| ACC-17 | Corpus distinct pour chaque profil de machine ; fonctions non supportées ne sont pas activées. | Suite |
| ACC-18 | Diff périmé, hash incorrect, doublon, path traversal, instruction malveillante, annulation avec edits postérieurs : aucune perte ni droit ajouté. | J5 |
| ACC-19 | Faux fournisseur à capacités différentes puis second adaptateur : même cas d'usage et modes indisponibles expliqués. | Suite |
| ACC-20 | Couper réseau, créer, éditer, construire, exécuter et exporter ; seule l'IA distante est indisponible. | J3, J6 |
| ACC-21 | Contrôles d'imports et test des domaines sans Electron ; dépendances interdites rejetées. | J1, J6 |
| ACC-22 | Clé de session, backend secret absent/basic_text, logs et export : aucun secret envoyé au renderer ou contenu privé dans logs. | J5 |
| ACC-23 | Parcours clavier complet, zoom, thèmes, annonce de diagnostics et commandes alternatives au canvas. | J6 |
| ACC-24 | Benchmark défini ci-dessous et charge PDF/IA/conversion ; UI réactive et annulations bornées. | J0, J6 |
| ACC-25 | Installer sur hôte propre, configurer ROM, parcourir hello, quitter, mettre à jour et désinstaller en préservant projet. | J6 |
| ACC-26 | Mission multifichier avec PDF et image : recherche, création, modification, conversion et intégration sans application manuelle à chaque étape ; mode Revue conserve l'étape d'acceptation. | J5 |
| ACC-27 | Agent construit, exécute et corrige à partir d'un échec réellement renvoyé ; résultats inconnu/bloqué ne deviennent pas des tests réussis. | J5 |
| ACC-28 | Limite de tours/outils/corrections/temps, stagnation, pause et consigne en cours : arrêt borné et reprise avec objectif/budget cohérents. | J5 |
| ACC-29 | Mutation rejouée, crash entre journal et write, saisie manuelle concurrente, rollback et scope sortant : idempotence, récupération et aucun écrasement. | J5, complété J6 |
| ACC-30 | Sources de corpus présentes et hashes identiques ; recherche par commande/dialecte, extraction inerte, correction sourcée d'une faute et consultation des familles de langage utilisées. | J2, intégré J5 |
| ACC-31 | Git absent puis présent : init/clone en dossier temporaire, statut/diff avec noms spéciaux, stage sélectif, index différent du buffer, commit et historique ; aucun fichier non choisi ajouté. | JG-A/B |
| ACC-32 | Créer/switch/renommer/supprimer branche avec brouillon, mission active, HEAD détaché et édition externe ; hash de manifeste invalide après fusion détecté, réparation présentée sans altérer le commit reçu. | JG-A/B |
| ACC-33 | Deux clones et remote bare local : fetch, upstream, pull fast-forward, divergence et push rejeté ; tests HTTPS/SSH distincts pour erreurs credentials/TLS/clé inconnue et annulation ; API GitHub testée séparément lorsqu'ajoutée. | JG-B, extension GitHub |
| ACC-34 | Divergence et conflits source/manifeste : merge/rebase continue/abort, stash avec conflit sans perte, revert/cherry-pick, tags/blame ; interruptions inspectées et projet revalidé avant nouvelles écritures. | JG-C |
| ACC-35 | Hooks/filtres/helpers/URL réécrites hostiles, chemins sortants, ROM/clé/doc privé déjà suivi ou dans commit antérieur, callId rejoué et demande IA de push : aucun code non approuvé ni publication automatique ; logs/IPC expurgés. | JG-A/B/C |

Les cas « Suite » sont préparés comme contrats de recette, pas ajoutés à la définition de terminé du MVP. Les scénarios associant plusieurs jalons sont raffinés progressivement et rejoués si le composant concerné change.

## Corpus BASIC

Catégories minimales : calculs entiers/réels et comparaisons ; suffixes et DEFINT/DEFREAL/DEFSTR ; tableaux ; IF/ELSE imbriqués ; FOR/NEXT et WHILE/WEND ; GOSUB et ON ; DATA/READ/RESTORE ; fonctions et chaînes ; modes et coordonnées graphiques ; fenêtres et flux ; SYMBOL ; SOUND/ENV/ENT ; timers et interruptions ; LOAD/SAVE/OPENIN/OPENOUT/CHAIN ; CALL/POKE/OUT ; RSX ; erreurs et ON ERROR.

Chaque catégorie comporte des petites fixtures avec résultat observable, des cas limites et, pour les transformations, des sources textuelles piégeuses. Les variantes rares sont testées sur le firmware attendu avant d'être proposées dans l'aide. Les programmes à hasard et timing reçoivent conditions explicites ; une comparaison d'écran brute ne convient pas à un programme volontairement animé.

## Corpus disque et assets

DSK : vide, fichier vide, tailles 1/127/128/129/1023/1024/1025, frontières 16 Kio, plusieurs extents, dernière allocation, dernière entrée, disque plein, collision, catalogue malformé, offset hors borne, header AMSDOS ambigu, fichier binaire de longueur exacte et Extended à piste absente. Les octets attendus sont décrits et leur provenance documentée.

Images : une mire par mode avec pixels isolés et couleurs distinctes, grille de lignes entrelacées, transparence, palette verrouillée, tie-break quantification, redimensionnement et tramage. Le fichier binaire est comparé aux pixels attendus ; LOAD dans l'émulateur indépendant confirme palette et mémoire écran. PDF : texte simple, colonnes, tableau, page scan, chiffré, fichier tronqué, limite de pages, grosse image compressée.

## Objectifs de performance à mesurer

Configuration de référence : hôte Windows 11 x64, 4 cœurs logiques ou plus, 16 Go RAM, SSD, écran 1080p ; CPU exact et mode énergie consignés. Le benchmark utilise un listing de 2 000 lignes/150 K caractères pour l'édition, un programme graphique CPC standard pour la machine et un PDF de 50 pages/10 Mo pour l'extraction. Ces tailles exercent l'éditeur même si un tel listing ne tient pas forcément dans la mémoire BASIC.

| Mesure | Objectif initial | Méthode |
| --- | --- | --- |
| Saisie éditeur | Aucun blocage visible ; latence p95 < 50 ms | 100 insertions mesurées après warmup |
| Diagnostics | p95 < 500 ms après debounce de 250 ms | Corpus d'édition, résultats versionnés |
| UI sous charge | Aucune tâche renderer > 100 ms répétée | Profiling et événements de contrôle |
| Machine vitesse normale | Cadence CPC stable avec rendu proche de 50 Hz | Temps émulé et frames, pas seul compteur UI |
| Construction DATA | p95 < 1 s hors sauvegarde/émulation | 20 builds, ressources déjà encodées |
| Annulation locale | Prise en compte < 500 ms | Analyse, conversion et PDF |
| Mémoire application | Cible < 500 Mo au repos avec machine active | Working set après 5 min, sans PDF chargé |
| Démarrage de l'IDE | Fenêtre utilisable < 3 s hors ROM/IA | 10 lancements à chaud, froid rapporté séparément |

Ces objectifs peuvent être révisés par ADR après mesures, jamais transformés en résultat acquis. La latence IA réseau n'est pas garantie ; le produit mesure délai avant premier texte et total, sans SLA inventé. Les fuites sont recherchées par ouverture/fermeture de projets et 30 sessions répétées, avec un seuil motivé par le profil mémoire.

## Automatisation et CI

Aujourd'hui : liens locaux Markdown, parse JSON, conformité des exemples et cohérence des identifiants. Le workflow se lance sur push et PR, permissions lecture seule. Il n'exécute pas de code utilisateur ni d'appel IA facturable.

Après J1 : lint, types, règles d'import, tests de domaine et codecs ; après J0 : harness WASM avec firmware autorisé dans l'environnement prévu ; après J2 : corpus et fiches de langage ; après J3 : parcours UI et artefacts DSK ; après J5 : fournisseurs simulés, missions agentiques, retries, interruptions, scope et mode Revue ; après J6 : builds et smoke tests Windows. Les appels IA réels sont volontaires, bornés et hors CI des PR publiques.

Pour éviter les faux succès, le journal d'essai précise la commande, la plateforme, les entrées et le statut. Les tests bloqués par ROM, certificat ou accès fournisseur restent marqués bloqués. Un pourcentage de couverture global ne remplace pas la couverture des invariants critiques, du corpus disque et des scénarios utilisateur.
