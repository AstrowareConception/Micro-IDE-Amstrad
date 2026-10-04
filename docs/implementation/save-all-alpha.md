# Enregistrer tout — alpha 0.16

Première tranche du lot R2, contribution à IDE-007 de la [roadmap](../specifications/17-roadmap-ide-complet.md). [ADR 0021](../adr/0021-enregistrer-tout-compensation.md). Ni durabilité J1-03 ni R2 ne sont clos.

## Parcours

Dans un projet desktop, cliquer **Enregistrer tout**, ou choisir **Fichier → Enregistrer tout le projet** / la même commande dans la palette. Tous les buffers déclarés sont contrôlés ensemble. L’onglet actif ne change pas. Les sources déjà identiques à leur version disque sont vérifiées et conservées sans réécriture ; les autres deviennent LF UTF-8 selon le contrat source existant. Le statut donne le nombre de sources écrites ; toutes les pastilles dirty correspondantes disparaissent sur succès. Les piles d’annulation restent utilisables : annuler une édition après sauvegarde rend le buffer modifié sans changer le disque.

Un conflit de manifeste ou de source détecté avant le lot ne sauvegarde aucun fichier. Les brouillons restent présents ; comparer/conserver les versions avant de rouvrir. Si une erreur survient après des écritures, l’application tente de remettre leurs octets originaux. Un fichier modifié extérieurement n’est jamais effacé par cette compensation. Si elle est incomplète, le message annonce l’enregistrement partiel et la session est bloquée jusqu’à examen/réouverture. Aucun buffer n’est marqué enregistré sur erreur.

**Enregistrer / Ctrl S** garde son comportement actif seul. Le bouton global est désactivé sans projet desktop, en aperçu navigateur et pendant les opérations disque/terminal/agent. Aucun autosave ni nouvel outil IA n’est ajouté.

## Contrat et limites

IPC `project:save-all` : session opaque et 1–64 sources `{id,source}` correspondant exactement au manifeste. UTF-8 sans BOM/NUL, 1 Mio/source et 8 Mio au total. Origines, chemins et empreintes déterminés par le main. Le manifeste, documents et métadonnées Git ne sont pas écrits. Les hashes internes ne sont avancés qu’après succès complet.

La compensation n’est disponible que tant que le processus reste vivant. Les remplacements sont atomiques par fichier selon l’adaptateur existant, jamais atomiques pour tout le projet. Pas de journal, reprise de crash, verrou contre un éditeur externe, fsync de panne électrique ni historique local. La course entre contrôle et rename demeure. La prochaine tranche est IDE-008 : journal/reprise, puis IDE-009/010 : historique local et restauration.

## Preuves

`npm test` : 103 tests, dont six scénarios d’orchestration et trois du vrai ProjectStore. `npm run typecheck`, `npm run build:desktop`, `npm run test:editor` et `python scripts/check_specs.py --schemas`. La recette `tests/desktop-smoke.mjs` exécutée par Desktop editor en CI vérifie deux brouillons, conflit sur le second fichier sans écriture du premier, reprise après rétablissement de la fixture, sauvegarde des deux, manifeste intact, dirty/undo/redo, no-op et IPC bloqué pendant terminal. Capture `out/save-all-alpha.png` dans les artefacts conservés sept jours. Les résultats effectifs des runs sont référencés dans la PR de livraison.

Electron local root sans affichage n’est pas utilisé comme preuve ; CI Linux sandboxée. Windows/macOS, reprise après crash, ROM et API OpenAI réelles restent non qualifiés par cette tranche.
