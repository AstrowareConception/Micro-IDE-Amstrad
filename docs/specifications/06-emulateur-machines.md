# 06 — Émulateur intégré et profils de machine

## Moteur sélectionné et état de preuve

Le candidat retenu est `floooh/chips`, compilé en WASM avec un wrapper C propre au projet. Le code primaire examiné fournit `cpc_init`, `cpc_exec`, clavier, joystick, insertion DSK, callbacks audio et snapshots internes. Le module disque accepte les signatures standard et Extended. Le modèle CPC du cœur inclut 6128, 464 et KC Compact, pas un profil 664 ou Plus prêt à l'emploi. Un commentaire TODO « DSK support » subsiste malgré les fonctions présentes : on se fonde sur le code et les essais, pas sur ce commentaire isolé.

Cette inspection établit une faisabilité candidate, **pas une qualification réussie**. Des limites de CRTC sont annoncées par le projet. L'aide lecteur impose notamment des limites de secteurs et de tailles ; un Extended DSK reconnu n'est donc pas automatiquement un disque protégé fidèlement émulé. Le lecteur A est le seul lecteur requis pour la première version. B, cassette, imprimante et extensions ROM arbitraires sont hors MVP.

Le moteur n'expose pas un export DSK complet au niveau CPC : l'adaptateur doit sérialiser les secteurs modifiés dans la géométrie DATA supportée. Les snapshots internes ne sont pas présumés portables comme SNA. Ces deux travaux font partie de J0, avant la décision finale d'intégration.

## Profil qualifié

| Champ | Valeur initiale |
| --- | --- |
| Identifiant | `cpc6128-classic-v1` |
| Machine | CPC 6128 classique, Z80, RAM physique 128 Ko |
| BASIC | ROM BASIC 1.1 fournie par l'utilisateur |
| Firmware | OS, BASIC, AMSDOS, chacun identifié par SHA-256 |
| Vidéo | Gate Array classique ; CRTC du cœur documenté et qualifié pour usages visés |
| Écran BASIC | Modes 0/1/2 standard ; pas de promesse overscan ou raster avancé |
| Lecteur | A, disquette DATA une face, 40 pistes |
| Entrées | Clavier logique CPC, joystick numérique |
| Qualification | `candidate`, puis `qualified` avec rapport et corpus |

Un profil comporte capacités déclarées : audio, disque lecture/écriture, clavier matriciel, pause, snapshot interne, capture, observation BASIC. `unsupported` diffère de `not-tested`. Une fonction non disponible est masquée ou expliquée, jamais simulée par un succès fictif.

## Firmware

L'import accepte les ROM séparées de taille attendue et un conteneur combiné dont le découpage est explicitement reconnu. Chaque composant est vérifié en taille, empreinte et type. Un fichier inconnu peut être configuré comme expérimental, avec avertissement et sans bénéficier de la qualification d'un autre jeu. Les langues et variantes de firmware restent identifiées.

Les ROM résident dans le stockage applicatif local par empreinte. Le projet ne contient qu'un profil et éventuellement l'identifiant d'un jeu attendu, jamais un chemin absolu ou les octets. Si l'environnement ne fournit pas les ROM nécessaires aux essais, J0 consigne son blocage et ne revendique aucun boot réussi. Les tests CI publics utilisent uniquement des fixtures autorisées ; les essais avec firmware personnel restent locaux ou sur un runner privé prévu pour cela.

## Port applicatif de l'émulateur

Contrat prévu : `initialize(profile, firmwareHandles)`, `boot`, `mountDisk`, `typeCommand`, `setKey`, `setJoystick`, `pause`, `resume`, `sendBreak`, `reset`, `captureFrame`, `readDiskChanges`, `dispose`. Chaque retour expose succès/erreur structurée, identifiant de session et capacités. Aucune méthode « executeBasicText » ne contourne le chemin disque officiel dans le MVP.

Le wrapper C expose allocation bornée, exécution par durée émulée, framebuffer, paquets audio et secteurs. Les pointeurs WASM ne traversent pas le port public. Les entrées binaires sont validées avant le parser C, avec limites de taille, géométrie et offsets ; un fichier mal formé ne doit pas provoquer une assertion ou une lecture hors bornes. Le wrapper rend des codes d'erreur au lieu de faire confiance aux validations minimales upstream.

## Démarrage et lancement

1. Préparer une machine propre avec firmware et profil identifiés.
2. Exécuter le boot jusqu'à un signal qualifié de disponibilité ou un timeout borné.
3. Monter une copie mutable du DSK de construction.
4. Injecter `RUN"MAIN.BAS"` par une file de touches logique, une seule commande à la fois.
5. Observer les erreurs de chargement et publier la révision réellement montée.

La disponibilité du prompt ne se résout pas par un délai magique de deux secondes. J0 compare un hook ROM identifié par empreinte, la sortie VDU et des critères observables. Un hook spécifique à une ROM est autorisé uniquement dans l'adaptateur, derrière une table qualifiée. En absence de reconnaissance fiable, un état « saisie manuelle requise » permet de continuer sans fausse preuve de lancement.

L'injection peut accélérer la machine durant le boot et le chargement si cette option est qualifiée ; l'exécution revient ensuite à la vitesse choisie. Le polling de touches du firmware est respecté. Copier un texte ne signifie pas émettre instantanément tous ses keydown/keyup sans temps émulé.

## Clavier, son, temps et focus

Deux modes sont nécessaires : saisie logique pour commandes et texte, mapping physique/matrice pour jeux utilisant INKEY ou JOY. Le wrapper qualifie touches françaises, chiffres, guillemets, ponctuation BASIC, curseurs, contrôle, shift et touches CPC. Si l'API upstream ne suffit pas pour une combinaison matricielle, une extension locale explicite est testée ; le comportement n'est pas annoncé sur la seule présence de `cpc_key_down`.

Perte de focus, pause, reset et fermeture relâchent toutes les touches. Les raccourcis éditeur ne partent pas vers le CPC quand la machine n'a pas le focus. Les changements de mapping sont des préférences locales. Le son est désactivable sans arrêter la simulation AY. Un programme qui dépend des queues SOUND reste cohérent lorsque le son hôte est muet.

L'horloge de la machine est indépendante des rafraîchissements d'interface. La vitesse normale est 100 % ; les vitesses supplémentaires sont signalées comme conditions d'essai différentes. La pause gèle le temps et vide l'audio. Après veille hôte, le moteur ne « rattrape » pas une heure de cycles. Les essais TIME, AFTER, EVERY, FRAME, son et clavier servent à qualifier cette politique.

## Observation et débogage

Au MVP : diagnostics statiques, capture écran, messages d'erreur connus quand leur interception est fiable, et trace TRON/TROFF proposée à l'utilisateur. L'observation associe type, message, éventuelle ligne BASIC, origine `rom-hook|vdu|manual`, confiance et instant. Un programme peut effacer l'écran, redéfinir les caractères, gérer ON ERROR ou continuer après une erreur ; la capture seule ne permet pas d'en conclure son état.

Les registres Z80 et mémoire brute peuvent servir au harness technique, sans devenir une promesse de debugger BASIC. Breakpoints de lignes, pas-à-pas et variables demandent des hooks compatibles avec des ROM et configurations précises. L'instrumentation qui modifie le listing produit une construction diagnostique distincte ; elle n'est pas l'export utilisateur par défaut.

## J0 : conditions d'acceptation et alternative

J0 doit prouver : boot avec ROM identifiées, CAT, RUN d'un ASCII, LOAD binaire à adresse, OPENOUT/CLOSEOUT puis relecture du disque exporté, interruption, reset, clavier de jeu, vidéo et son, boucles longues sans gel UI, mesures de temps et sérialisation du disque. L'export doit fonctionner dans un émulateur indépendant, par exemple Caprice32 installé pour l'essai.

Si un point nécessaire échoue, un écart reproductible est enregistré. Une correction ciblée du wrapper ou un patch upstream est préférée lorsque bornée. Si le cœur ne satisfait pas les critères, l'ADR moteur est remplacée après comparaison d'un autre cœur réellement intégrable. Caprice32 est un oracle et une alternative étudiable, avec conséquences GPL à examiner avant redistribution ; il n'est pas un fallback automatiquement embarqué. L'architecture ne change pas pour masquer un échec de qualification.


## Priorité Exécuter — alpha 0.24, 5 octobre 2026

À la demande utilisateur, [Exécuter/F5 dans le CPC intégré](../implementation/emulator-run-alpha.md) passe avant la suite Git. [ADR 0029](../adr/0029-executer-buffers-cpc-integre.md) : worker chips/WASM, DSK des buffers, trois ROM privées, écran/clavier/pause/arrêt/son/export session et RUN automatique pour le jeu anglais reconnu (Ready manuel sinon). Boot BASIC 1.1, RUN disque et POKE sont prouvés sur le jeu identifié ; pixels PRINT vérifiés par recette UI. 157 tests Node ; preuves Electron dans la PR. J0/J3 restent partiels, oracle indépendant/OPENOUT/audio audible/autres plateformes ouverts ; aucun CPC physique qualifié. Suite immédiate : renforcer les recettes CPC, avant branches Git et outils d’exécution IA.
