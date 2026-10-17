# ADR 0076 — Élargir le découpage terminal par un profil d’expressions fermé

- Statut : accepté pour l’alpha 0.41.26.
- Date : 2026-10-17.
- Complète : [ADR 0075](0075-application-decoupage-journalise.md).

## Contexte

La transaction de découpage et sa restauration sont livrées en 0.41.25. Le profil syntaxique initial reste limité aux affectations littérales et aux POKE de témoins. Étendre seulement ses expressions régulières ou se fier à l’analyse tolérante de l’éditeur laisserait entrer des formes partiellement comprises.

## Décision

Conserver le profil v1 et ajouter `terminal-expressions-chain-merge-v2`, sélectionné lorsque le listing sort du profil initial. Une grammaire fermée consomme intégralement les expressions ; une propagation de valeurs sur le chemin séquentiel contrôle initialisation, types explicites `%`/`$`, bornes entières et longueur des chaînes. Aucun eval, accès hôte, fonction BASIC arbitraire ou branche n’est admis. Les quotas restent bornés.

Ajouter PRINT sur le flux écran par défaut avec séparateurs explicites, MODE 0..2 et CLS. Les commandes présentes restent soumises au contrôle de consultation des références de l’agent. L’application consomme toujours le candidat exact ; aucun protocole de mutation parallèle au journal existant n’est introduit.

Qualifier quatre programmes par application réelle, réouverture et restauration, soit douze DSK exécutés sur ROM. Comparer les trois témoins d’affichage à des programmes de référence littéraux distincts. Comparer les lignes vidéo imprimées hors prompt et curseur, sans demander une identité de la mémoire complète ni du timing. Conserver les empreintes et résultats sans ROM. Étendre le parcours Electron existant à un témoin v2.

## Conséquences

Les aperçus exposent un identifiant de profil précis. Les anciens programmes v1 ne changent pas de contrat ; les nouveaux programmes refusés reçoivent une raison explicite. Les conditions, boucles, fonctions, types implicites v2 et flux dynamiques nécessitent des extensions ultérieures. Les observations sur le moteur intégré ne remplacent pas une qualification matérielle ou indépendante. Voir le [guide et la matrice de témoins](../implementation/basic-multifile-expressions-alpha.md).
