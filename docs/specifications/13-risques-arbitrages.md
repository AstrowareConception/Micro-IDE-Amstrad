# 13 — Risques, arbitrages et décisions conditionnelles

## Décisions prises pour avancer

Application desktop Electron, TypeScript, Monaco, monolithe modulaire DDD, modèle de projet en fichiers, CPC 6128 d'abord, BASIC ASCII et DSK DATA d'abord, IA agentique à outils et corpus BASIC avec mode Revue optionnel, aucun serveur du produit. Le choix du moteur `chips` est **retenu sous condition J0**. Ces décisions donnent une direction concrète sans transformer des bibliothèques disponibles en promesses de compatibilité.

## Registre des risques

| Risque | Conséquence | Réponse prévue | Déclencheur de révision |
| --- | --- | --- | --- |
| Cœur CPC insuffisant sur disque, CRTC ou timing | Exécution trompeuse ou programmes incompatibles | J0, fixtures et oracle indépendant | Échec critique reproductible non corrigeable de façon bornée |
| Sérialisation des écritures manquante upstream | Données de programme perdues à la fin d'un essai | Wrapper secteurs et export de session testé | Lecture externe impossible |
| Firmware indisponible pour essais | Boot non prouvé | Import utilisateur et environnement de test autorisé | ROM nécessaire absente ou non identifiable |
| Redistribution firmware mal documentée | Packaging impossible ou conditions non respectées | Exclusion par défaut, sources primaires et revue avant inclusion | Demande de firmware embarqué |
| Parser trop ambitieux ou incorrect | Faux diagnostics, renumérotation destructrice | Sous-ensemble qualifié, zones opaques et corpus ROM | Refactoring ne peut pas préserver le listing |
| Confusion ASCII/tokenisé/binaire | BAS illisible et DSK incorrect | Types explicites et conventions de header distinctes | Essai indépendant divergent |
| Encodage moderne non compatible | Chaînes altérées ou contrôle inattendu | Aperçu, choix et erreurs sans translittération cachée | Besoin d'alphabet non pris en charge |
| API IA changeante | Réponses invalides ou modes indisponibles | Adaptateur et capacités versionnés, faux fournisseur | Changement incompatible confirmé |
| Instruction malveillante dans un document | Tentative de lecture ou mutation non autorisée | Ports étroits et liste de chemins ; pas d'outil shell | Opération hors contexte proposée |
| Coût ou transmission involontaire | Perte de confiance | Contexte choisi, budget et pas de retry facturable caché | Ambiguïté fournisseur ou dépassement local |
| Electron trop coûteux | Mauvaise expérience sur petit hôte | Worker, mesures et optimisation ciblée | Objectifs dépassés après profiling |
| PDF ou image décompressée trop grande | Gel ou épuisement mémoire | Limites décodées, workers, annulation et timeout | Charge mal maîtrisée |
| Modifications simultanées de fichiers | Écrasement de travail | Empreintes, watcher, verrou et transaction journalisée | Conflit avant sauvegarde/application |
| Multi-plateforme prématuré | Retard du parcours principal | Windows qualifié puis autres plateformes | Demande prioritaire explicite |
| Développement de toutes les extensions | Produit trop vaste pour une première version | Jalons fermés et scope Suite | Nouvelle fonctionnalité incompatible avec l'incrément |
| Agent réessaie sans progresser | Dépenses et changements inutiles | Budgets de mission et détection de stagnation | Même état/diagnostic sans changement pertinent |
| Mutation rejouée après reconnect | Effets dupliqués ou source écrasée | callId, journal durable et rapprochement transactionnel | Résultat fournisseur/réseau ambigu |
| Corpus synthétique ou contradictoire | Code d'un autre BASIC ou mauvaises signatures | Provenance, fiches qualifiées et couverture par dialecte | Lacune ou divergence avec ROM |
| Écriture agent concurrente à une saisie | Travail manuel perdu | Hash avant mutation, relecture et rollback contrôlé | Version de document modifiée |

## Points à décider lors de preuves précises

| Point | Décision provisoire | Moment et preuve |
| --- | --- | --- |
| Commit cœur et Emscripten exacts | Commit inspecté candidat ; pin final après essai | J0, build et rapport reproductibles |
| Clavier physique et hook prompt/erreur | Wrapper à qualifier par ROM | J0/J3, tests d'entrée et ON ERROR |
| Interleave de sortie DATA | Ordre stable choisi par writer versionné | J0, CAT/RUN et lecture externe |
| Codec BASIC repris de CPCBasicTS | Référence, pas dépendance retenue | Suite, audit MIT et tests différentiels |
| Versions Electron/Node/React/Monaco | Versions maintenues compatibles | J1, lockfile, OS minimums et CI |
| Fournisseur/modèle IA | OpenAI en premier, modèle configurable | J5, capacités et coût affichables au moment du choix |
| Jeu ROM embarqué | Aucun par défaut | Seulement si droits et provenance suffisants pour diffusion |
| Certificats de signature | Dépendance externe non disponible dans la conception | J6, accès fourni par le propriétaire |
| Essai CPC réel | Cible de qualification, pas essai acquis | J6 ou campagne matérielle dédiée |

Ces points ne bloquent pas la rédaction ni la conception du reste. Ils deviennent des conditions de sortie seulement à leur jalon. Un blocage doit être signalé avec preuve, périmètre et travail indépendant réalisé ; aucune attente n'est assimilée à un accord ou un test réussi.

## Sécurité utile au produit

Le BASIC s'exécute dans une machine invitée : son accès disque concerne son image DSK, jamais les documents hôte. Le danger principal pour les données de l'utilisateur vient des parsers, des chemins, des transactions et des transferts IA. Les mesures prévues répondent à ces opérations concrètes. Le produit ne rajoute pas une checklist alarmiste à chaque action ordinaire.

Sur les secrets, Electron `safeStorage` dépend du système et peut utiliser un backend insuffisant sur Linux. La clé de session est le fallback explicite ; aucune clé en clair n'est persistée pour « faire fonctionner quand même ». La signature et la revue des dépendances sont des activités de diffusion, distinctes des permissions de l'application sur un projet.

## Gestion des évolutions

Une idée nouvelle est qualifiée comme amélioration du jalon courant, extension compatible ou changement d'architecture. Le responsable produit tranche la priorité au fil de ses consignes. Les ADR gardent les décisions remplacées et leurs motifs. Les risques clôturés reçoivent un lien vers la preuve ; ceux simplement « prévus dans les specs » restent ouverts.

Le projet doit rester agréable à reprendre : README honnête, instructions exécutables, formats documentés, exemples petits et absence de dépendances cachées. Les prochains travaux peuvent commencer à partir de ces documents sans refaire toute la conception, tout en vérifiant les références susceptibles d'avoir évolué.
