# ADR 0053 — Cartographie des erreurs et événements BASIC

- Statut : accepté
- Date : 2026-10-08
- Portée : alpha 0.40.4, REQ-EDT-008 / ACC-36, IDE-076 partiel

## Contexte

Les déclarations ON ERROR/BREAK/SQ et AFTER/EVERY étaient opaques dans le graphe. Les assimiler à un GOSUB immédiat introduirait de faux appels, retours et cycles ; les ignorer empêcherait de retrouver les routines événementielles.

## Décision

Reconnaître les déclarations à cible décimale littérale, les changements de mode ON ERROR GOTO 0 et ON BREAK CONT/STOP. Conserver un registre ordonné du source, sans inférer l’état actif, les annulations, le délai, les priorités ou le déclenchement. Les expressions ordinaires sont inspectées mais leurs valeurs et arguments ne sont pas exportés.

Ajouter une liaison handler non exécutable entre déclaration et cible existante, rendue en pointillés. L’exclure des parcours, des décisions, des composantes cycliques et des appels GOSUB. Ajouter les cibles comme entrées explorables, tout en maintenant globalement retours indéterminés, complexité indisponible et inaccessibilité non conclue.

ERROR ne poursuit pas directement vers l’instruction suivante. RESUME et RESUME NEXT conservent une reprise à cible contextuelle inconnue ; RESUME suivi d’une ligne positive montre cette destination potentielle. Une reprise ne démontre pas un état d’erreur valide. RESUME 0 reste opaque.

Le sous-format flow passe en version 3 (handlers, entrée handler, liaisons handler/recovery). Rapport englobant et fichiers projet inchangés. Le registre est borné par les nœuds ; seules les 100 premières déclarations sont affichées dans la liste, avec omission annoncée et export complet du graphe conservé.

## Preuves et limites

Dix assertions positives et deux observations négatives bornées sur firmware CPC 6128 anglais, tests du domaine et vrai worker dans Chromium : [qualification détaillée](../implementation/basic-control-flow-alpha.md#qualification-0404). RESUME NEXT rejoint bien l’instruction suivante sur la même ligne dans la recette ; les touches Escape et priorités d’interruption restent non qualifiées.

La cartographie apporte une navigation utile sans prétendre résoudre l’analyse interprocédurale asynchrone. La prochaine tranche devra propager un état de gestionnaire borné et modéliser les reprises contextuelles avant de lever les gardes globales. IDE-076/J2 restent partiels.
