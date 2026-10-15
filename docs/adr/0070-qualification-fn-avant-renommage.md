# ADR 0070 — Qualifier DEF FN avant de résoudre ses noms

- Date : 2026-10-15
- Statut : accepté pour la tranche de qualification après 0.41.11
- Périmètre : IDE-015 partiel ; IDE-017 non réalisé

## Problème

Le corpus fourni décrit la syntaxe de DEF FN, sans préciser suffisamment les interactions des paramètres, variables libres, suffixes et changements de type. Une portée déduite uniquement de l'emplacement du texte pourrait introduire un renommage incorrect. L'index actuel omet donc définitions et appels FN.

## Décision

Conserver une matrice de petits listings originaux et indépendants, exécutés par la ROM CPC 6128 anglaise identifiée dans le moteur WASM intégré. Réutiliser le protocole de tests existant : machine vierge par cas, empreintes ROM/source/DSK, prompt Ready reconnu, budget de trois secondes émulées après RUN, assertion et signature de fin. Les cas négatifs contrôlent ERR et ERL ; un délai ou un arrêt seul ne constitue jamais une preuve d'erreur attendue.

La recette dédiée reste bloquante dans la CI Desktop Linux, aux côtés des autres qualifications firmware. Son rapport conserve aussi l'empreinte du WASM, le verrou du moteur et l'empreinte des fixtures, sans octets de ROM. Les résultats et contre-exemples sont détaillés dans le [rapport de qualification](../implementation/basic-fn-qualification.md).

Cette tranche ne change ni le contrat d'export Symboles version 2, ni les permissions de l'agent, ni le comportement de l'éditeur. Le code applicatif reste en 0.41.11 ; aucun packaging supplémentaire n'est requis pour un lot de recettes et de documentation.

## Conséquences

Le futur index devra distinguer les occurrences textuelles de leurs identités possibles à l'exécution. Un paramètre, une variable libre et une globale homonymes ne pourront pas être fusionnés sans preuve. Définitions conditionnelles, redéfinitions, alias de type et appels imbriqués resteront explicitement ambigus lorsque le modèle ne les résout pas.

Les exemples bornés ne qualifient ni l'ensemble de DEF FN, ni un autre firmware, ni un CPC physique ou un émulateur indépendant. Les formes non éprouvées restent inconnues. Le renommage FN demeure indisponible jusqu'à la tranche d'index et de transformations avec aperçu, révisions et annulation.
