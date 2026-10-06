# ADR 0042 — Inspection CPC en pause et qualification du hook

Statut : acceptée pour l’alpha 0.35. Date : 6 octobre 2026. Complète [ADR 0041](0041-analyse-basic-worker-monitoring.md).

## Contexte

La demande de débogage BASIC exige une preuve de frontière d’exécution firmware et de correspondance avec le programme réellement chargé. L’état du CPU seul ne fournit pas cette preuve. Le pont possédait une lecture de RAM physique de base réservée au harness, sans inspection stable dans l’IDE.

## Décision

- Exposer une lecture des registres et de la RAM logique derrière les ROM, uniquement en pause et avec bornes strictes. Worker/UI demandent jusqu’à 64 octets ; pont C limité à 256. Les huit mappages RAM 6128 sont utilisés ; les ports de lecture ne mutent pas la machine.
- Proposer l’inspection à la demande sous l’écran CPC. Aucune activation automatique du hook, lecture périodique, conservation durable ou transmission IA. Révision de demande et identifiant de session rejettent les lectures anciennes ; reprise/relancement retire l’état affiché.
- Ajouter un hook C de qualification ponctuel : opcode-fetch ciblé, filtre ROM, plafond de ticks et raison d’arrêt. Décompte réel des ticks et horloge clavier après arrêt anticipé ; callback retiré à reprise/annulation/reset/destruction. Les headers tiers restent inchangés.
- Qualifier `DE60`/`AE1D` exclusivement sur les hashes anglais identifiés, en RAM configuration zéro, avec validation des enregistrements tokenisés et marqueurs de mémoire. Natif et WASM doivent produire la même trace. L’IDE n’affiche pas ces observations comme ligne BASIC courante et n’expose pas encore le hook aux utilisateurs ou à l’agent.

## Conséquences

IDE-055 devient partiel : mémoire/registres/banques disponibles, désassemblage et snapshots/restauration ouverts. IDE-054 reste bloqué pour son interface publique ; D1 partiellement prouvé, événements et mapping source toujours à qualifier. Les recettes réelles et les limites sont décrites dans le [guide 0.35](../implementation/cpc-inspection-alpha.md). Le hook coûte un callback C par tick lorsqu’il est armé ; l’exécution normale garde sa voie sans callback. Ce travail ne ferme aucun jalon global de compatibilité.
