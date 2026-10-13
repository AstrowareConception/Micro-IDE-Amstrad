# 22 — Export BASIC obfusqué : piste produit

Demande confirmée du 13 octobre 2026 : combiner une obfuscation maison avec la sauvegarde BASIC protégée. Statut : **fonctionnalité retenue au backlog, non implémentée**, priorité P2. L'objectif est de rendre un programme distribué plus difficile à lire tout en conservant dans le projet sa source claire. Ce chantier ne remplace pas la récupération de sources demandée en priorité.

## Existant sur CPC

`SAVE "JEU",P` est la sauvegarde BASIC protégée historique. Le manuel Amstrad documente cette option ; les techniques de retrait de cette protection sont également connues. Elle freine la consultation ordinaire sans assurer la confidentialité du programme. Tokeniser le BASIC ne suffit pas non plus à l'obfusquer : un détokeniseur peut en restituer le listing.

Références : [manuel CPC664 Amstrad, commande SAVE](https://www.cpcmania.com/Docs/Manuals/CPC664%20User%20Instructions.pdf), [article de NoRecess sur les protections BASIC](https://www.norecess464.com/productions/ghouls-fanz/index.html). Le comportement et le format précis doivent être qualifiés sur les firmwares visés avant d'ajouter l'export protégé à l'IDE.

## Proposition pour CPCéleste

Créer une commande **Exporter une version obfusquée…**, distincte des sauvegardes et des sources du projet. Le résultat doit être reproductible avec graine/options enregistrées, rapport des transformations et possibilité de désactiver chaque transformation. La table de correspondance noms/lignes reste locale et n'est pas embarquée dans la disquette distribuée.

### Trois modes d'export

| Mode | Traitement de la copie de distribution | Finalité |
| --- | --- | --- |
| Obfuscation seule | Transformer le listing avec les règles qualifiées | Réduire la lisibilité du code récupéré |
| BASIC protégé seul | Produire une sauvegarde compatible `SAVE ...,P` | Limiter la consultation ordinaire depuis le BASIC CPC |
| Obfuscation + BASIC protégé | Transformer la copie, la valider puis produire sa représentation protégée | Cumuler les obstacles : retirer la protection historique ne restitue que le listing déjà obfusqué |

Le troisième mode correspond à la demande utilisateur. Afficher les transformations, le profil CPC ciblé, les fichiers concernés et les limites avant export. Aucun de ces modes ne remplace la source claire ou ses historiques. Fournir une nouvelle disquette et un rapport local ; ne pas embarquer le listing clair, la graine privée éventuelle ni la table de correspondance dans l'artefact distribué.

L'ordre est **source claire → copie obfusquée → validations → représentation BASIC protégée → nouveau DSK**. Le format protégé exige un codec de tokenisation/protection qualifié, ou une sauvegarde effectuée par un firmware qualifié sur un CPC isolé ; choisir la méthode par ADR. Modifier seulement le nom du fichier ou annoncer `SAVE ,P` dans un rapport ne constitue pas un export protégé. Ne pas modifier le disque d'une session utilisateur en cours.

La protection combinée augmente les obstacles à la lecture, sans garantie chiffrée de résistance ni secret absolu. Une récupération en mémoire ou une déprotection peut toujours révéler la copie obfusquée. L'interface doit parler de « lisibilité réduite » et de « protection BASIC historique », sans promettre une protection inviolable.

| Transformation envisageable | Prérequis et risque |
| --- | --- |
| Retrait du texte des commentaires | Préserver les lignes ciblées, séparateurs, effets sur `ELSE` et positions mémoire observées |
| Noms de variables moins explicites | Identités, collisions, tableaux, FN et types implicites qualifiés ; `DEFINT`/`DEFSTR`/`DEFREAL` dépendent des lettres initiales |
| Renumérotation compacte | Réécriture des références et des points d'entrée ; `ERL`, `RESUME`, `RESTORE`, `RUN` et chargements intersources à considérer |
| Compression prudente des espaces | Seulement dans les contextes prouvés sûrs ; chaînes, DATA et commentaires préservés |
| Chaînes reconstruites à l'exécution | Option avancée, coûts mémoire/temps et comportement à mesurer ; aucune garantie de secret |

Ne pas confondre obfuscation et optimisation : une transformation peut augmenter taille, temps et mémoire. Les effets sur `PEEK`/`POKE`, `CALL`, `VARPTR`, adresses de variables, disposition du programme, débogage et chronométrage peuvent invalider une équivalence naïve. Refuser les cas non qualifiés au lieu de promettre un comportement conservé sur tout programme.

## Recette et dépendances

Prérequis : renumérotation conservatrice existante, puis identité des symboles et renommage sémantique avec portées (IDE-015/017). Aucun renommage par simple remplacement textuel. Le fichier obfusqué doit repasser diagnostics, construction et scénarios CPC comparatifs disponibles. Publier les exclusions et le résultat des tests, sans les présenter comme une preuve universelle.

Une démonstration simple peut d'abord traiter un programme autonome sans accès mémoire ni dépendances, en préservant exactement ses sorties. La sortie protégée `SAVE ,P` constitue un lot séparé du transformateur de source. Une protection inviolable n'est pas promise : la machine doit pouvoir interpréter le programme, et un émulateur peut en observer l'état.

Recette du mode combiné : exécuter les scénarios sur le source clair, sur la copie obfusquée puis sur le fichier protégé rechargé depuis le DSK produit ; comparer les observations et mesurer les coûts. Vérifier la conservation du projet clair et l'absence de sources claires/tables de correspondance sur le disque exporté. Déprotéger une fixture originale de test doit retrouver la version obfusquée, sans prétendre restaurer les noms et commentaires supprimés. Bloquer l'export si une transformation, le format protégé ou une dépendance du programme n'est pas pris en charge.
