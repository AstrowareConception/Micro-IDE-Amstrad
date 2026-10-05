# ADR 0027 — Commit Git de l’index examiné

- Statut : accepté
- Date : 2026-10-05
- Périmètre : alpha 0.22, R3/JG-A partiels

## Décision

Ajouter `prepareCommit` et `commit` au port VersionControl, sans shell ni accès Git de l’agent. Le renderer fournit identité/message strictement validés et reçoit un plan opaque comprenant arbre, parent, branche, fichiers et diff. Main lie le plan à la session/projet, interdit les buffers dirty et confirme nativement avec annulation par défaut.

L’identité explicite auteur/committer est injectée seulement dans l’environnement des commandes ; la configuration reste intacte. Git 2.48+ requis pour cette mutation. Copier l’index pour `write-tree`, créer l’objet avec `commit-tree --no-gpg-sign`, puis publier HEAD par transaction interactive `update-ref` avec comparaison de l’ancien OID. Après prepare, revérifier branche symbolique et préconditions pendant les verrous Git, avant commit. Un verrou exclusif de l’index protège sa sélection ; seuls les verrous détenus par l’IDE sont retirés. Hooks désactivés, aucune signature ni publication réseau implicite.

## Conséquences

Le commit correspond aux octets indexés examinés, même si le disque diffère. Les changements indexés hors sources/manifeste/exclusions sont refusés ; les entrées suivies inchangées restent dans l’arbre. Premier commit et parent existant sont distincts. Une annulation ne touche pas HEAD/index ; un conflit invalide l’aperçu. Objets non référencés et temporaires possibles après interruption ; pas de retry automatique ni de garantie de verrouillage du disque/panne électrique.

Identité persistante, plateformes hors Linux, branches/restauration et réseau restent ouverts ; IDE-033 reste partiel. Bornes et preuves : [guide](../implementation/git-commit-alpha.md). Références primaires : [commit-tree](https://git-scm.com/docs/git-commit-tree), [update-ref](https://git-scm.com/docs/git-update-ref).
