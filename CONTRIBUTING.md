# Contribuer

Le projet commence par sa conception. Le [dossier](docs/README.md) décrit le produit attendu, les contrats et les incréments. Une modification doit expliquer le comportement modifié, le jalon concerné et la validation effectuée.

Créer une branche `docs/...`, `spike/...`, `feat/...` ou `fix/...`, puis une PR vers `main`. Garder les changements réversibles et ciblés. Ne pas forcer les références Git. Les décisions qui changent une frontière de domaine, un format de projet, un moteur ou la politique de transmission IA nécessitent une ADR.

Pour la documentation : Python 3.12+, `python -m pip install -r scripts/requirements-docs.txt`, puis `python scripts/check_specs.py --schemas`. Les dépendances de l'application seront ajoutées au jalon J1 ; aucune commande de lancement de l'IDE n'existe à ce stade.

Inclure dans chaque PR : problème concret, comportement final, exigences concernées, vérifications et limites constatées. Une capture de l'émulateur seule ne suffit pas à prouver la validité du DSK. Ne jamais joindre une clé API ou un firmware tiers aux exemples.
