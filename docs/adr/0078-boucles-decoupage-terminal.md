# ADR 0078 — Boucles bornées et frontières du découpage terminal

- Statut : accepté
- Date : 2026-10-18
- Incrément : 0.41.28

## Contexte

Le profil v3 admet des conditions simples. Les boucles ajoutent des états répétés et une pile firmware : accepter une ouverture dans MAIN avec sa fermeture dans PART exigerait une qualification différente du chargement. Les erreurs peuvent également n’apparaître qu’après plusieurs tours.

## Décision

Ajouter le profil `terminal-loops-chain-merge-v4`, sans changer l’identité des profils v1/v2/v3 ni le journal d’application/restauration. Admettre FOR à compteur `%`, bornes et pas entiers littéraux, avec NEXT nommé, et WHILE comparant un compteur `%` initialisé à une borne entière littérale. Pour WHILE, imposer une mise à jour unique et inconditionnelle du compteur, en fin de corps et dirigée vers la sortie.

Exiger qu’une boucle soit entièrement avant ou après la frontière CHAIN MERGE. Refuser imbrications, IF dans les corps, sorties anticipées et modifications libres du compteur. Les conditions simples hors boucles continuent à propager les deux états conservateurs v3. Partager le contrôle fermé des expressions et instructions séquentielles.

Suivre chaque itération et le compteur de sortie, avec quatre boucles maximum, 32 tours par boucle/état et 8192 visites d’instructions cumulées, tous états confondus. Contrôler les corps sautés une fois sur une copie jetée sans adopter leurs affectations. Maintenir les quotas de source et les refus explicites ; aucun résultat hors budget ne devient une autorisation de transformation.

Compléter les fiches éditoriales WHILE/WEND depuis le corpus fourni, exiger leur consultation avant application et aligner les consignes modèle/outil/aperçu. Qualifier zéro, un et plusieurs tours dans les deux sens, les compteurs après sortie et une combinaison FOR/WHILE avec chaînes et affichage : quatorze projets, chacun original/appliqué-rouvert/restauré-rouvert, plus deux références écran littérales. Conserver toutes les recettes antérieures et ajouter le parcours Electron v4.

## Conséquences

Le profil reste volontairement fermé et peut refuser des programmes valides. Aucune pile de boucle active n’est supposée survivre au CHAIN MERGE. Les témoins ne constituent pas une preuve universelle, temporelle ou matérielle. La prochaine étape mettra à l’épreuve la mission complète de lisibilité sur des programmes représentatifs avant d’élargir les structures. Voir le [contrat et les preuves](../implementation/basic-multifile-loops-alpha.md).
