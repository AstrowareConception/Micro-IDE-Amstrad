# ADR 0005 — Assistance IA sous forme de propositions

Statut : acceptée. Date : 2026-10-03.

## Contexte

L'utilisateur veut donner des intentions, images et documents à une IA puis voir et exécuter le code. Une génération peut être incorrecte, se baser sur une source devenue ancienne ou recevoir des instructions trompeuses dans une pièce jointe. Le contrôle de l'auteur et la reprise du travail doivent rester simples.

## Décision

Un ContextBundle choisi et figé précède l'envoi. Le fournisseur rend du texte et éventuellement une proposition structurée. L'application valide, calcule le diff et applique seulement après revue et vérification de révision/empreintes. Les fichiers autorisés sont déterminés par le cas d'usage. Aucun accès shell ou fichier arbitraire n'est donné au modèle.

## Options considérées

L'écriture automatique après chaque fragment streaming donnerait une UI spectaculaire mais des états partiels dangereux. Un agent autonome générant et exécutant jusqu'à réussite augmente facturation et complexité d'arrêt. Ces modes ne sont pas nécessaires au MVP. Un assistant limité au copier/coller ne garantit pas préconditions, transactions et retour arrière.

## Conséquences

Le mode sans IA reste complet. Clé personnelle protégée, fournisseur interchangeable et capacités déclarées. Diff périmé consultable mais non appliqué automatiquement. Annulation, échec fournisseur et coût inconnu sont explicites. Les pièces choisies ne sont pas toutes automatiquement des ressources du disque.

Révision : une boucle autonome ultérieure doit avoir budget, droits, maximum d'itérations et preuve de validation indépendants ; elle ne peut hériter d'une permission trouvée dans un document.
