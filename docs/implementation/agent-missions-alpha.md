# Agent et spécifications IDE — alpha 0.29

## Utilisation

Ouvrir un projet puis **Réglages IA** : clé, catalogue officiel et modèle. La clé disparaît du champ et reste en mémoire côté main. Le tarif est lu dans la fiche officielle publique, sans clé ; actualisation distincte. Régler les budgets, fermer le dialogue et saisir la mission. La consigne de suivi est facultative.

La mission affiche messages publics, compteurs, tokens, fichiers réellement modifiés, construction et estimation API en USD quand les données sont complètes. **Journal technique** donne résultats et erreurs des outils. En pause tours/outils/tokens, **Reprendre la mission** conserve contexte et checkpoint initial ; budget supplémentaire et facturation possible sont indiqués. Une édition humaine/disque bloque la reprise. **Changements** compare avant/après ; **Restaurer le checkpoint initial** est disponible pour des fichiers changés, avec préconditions existantes.

## Correction

Les fiches complètes de `reference_search` comptent comme consultées ; `reference_read_many` groupe jusqu’à 32 commandes. La garde d’écriture reste active. L’ancien journal masquait les erreurs, donc une tentative de remplacement pouvait laisser zéro changement sans expliquer le refus.

Défaut : 20 tours / 60 outils / 60 000 tokens, 15 minutes par lancement/reprise, compteurs cumulés. Appels en attente et callIds conservés sans rejeu des outils traités. Pas de retry API automatique. Sortie fournisseur : 8 192 tokens ; réponse incomplète sans mutation mais usage connu compté.

Tarif lu à la sélection, actualisable et relu avant lancement après une heure. Parsing limité aux fiches textuelles et règles standard reconnues. Pas de table figée inventée. Usage incomplet, tarif périmé/inaccessible, alias effectif différent ou tier inconnu : coût indisponible. Un total agrégé ancien ne reconstruit pas une facture.

## Spécifications et preuves

- [18 — Huit lots de production](../specifications/18-increments-ide-production.md) : explorateur, BASIC, Git, terminal/tâches, CPC, agent observant son résultat, personnalisation, distribution ; parcours/dépendances/recettes.
- [19 — Expérience et consommation agent](../specifications/19-agent-experience-consommation.md) : incident observé/hypothèse, configuration, états, outils, budgets/reprise, tokens/tarifs et acceptation.
- [ADR 0036](../adr/0036-agent-reprise-resultats-et-consommation.md).

`agent-missions.test.ts` couvre pause à douze tours, conservation du contexte, écriture MODE 1 et construction structurelle réelle, batch, erreurs, file d’outils/rejeu/collision, comptage/cache/contexte long, tarif public borné, réponses incomplètes/tardives et préconditions du contrôleur.

`agent-workbench-smoke.mjs` vérifie dialogue/focus/Escape, clé effacée, tarif, pause/erreur, compteurs/coût, reprise, diff et restauration. `agent-desktop-smoke.mjs` ajoute vrai IPC/contrôleur/mutations/construction/checkpoint sur projet disque ; preuve native consignée par la CI. Providers contrôlés, aucun appel API payant.

## Limites

Reprise dans la même session, dix continuations maximum. Conversation non persistée au relancement ; les journaux disque assurent leur propre récupération. Saturation de contexte/stagnation demande une mission ciblée. HTTP/délai sans usage reçu : facture potentielle inconnue. Le compteur raisonnement n’expose jamais le raisonnement interne.

Aucun RUN/capture CPC offert à l’agent : DSK construit/relu structurellement. La beauté/densité d’un titre et la compatibilité ROM ne sont pas garanties par une boucle testée. Recette avec modèle réel choisi et vérification visuelle encore nécessaire, puis outils machine du lot 6. IDE-062/063/064/065 restent partiels ; R7/J5/J6 ouverts.
