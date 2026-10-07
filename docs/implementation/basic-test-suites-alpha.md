# Suites de tests BASIC — alpha 0.39, premier lot

Date : 7 octobre 2026. REQ-EMU-010 / ACC-37, IDE-077 partiel. [ADR 0047](../adr/0047-suites-basic-et-historique.md).

## Utilisation

1. Ouvrir un projet desktop, puis **BASIC → Tests BASIC à la demande…**.
2. Dans **Suites du projet**, saisir un nom, choisir les listings déclarés, régler le budget puis **Enregistrer la suite**. La suite se retrouve après réouverture ; les buffers ne sont pas sauvegardés par cette action.
3. Choisir la suite, puis **Tous les listings de la suite** ou un listing particulier, et **Exécuter les tests BASIC**. Le budget affiché peut être ajusté pour ce lancement ; enregistrer à nouveau pour le mémoriser dans la suite.
4. Consulter les assertions et **Voir ligne…** pour rejoindre leur déclaration. Annuler arrête le worker et conserve les résultats déjà obtenus ; les autres listings sont marqués annulés.
5. Charger un rapport dans **Historique des tests**. Les dix derniers rapports finaux sont conservés, même bloqués ou annulés. Charger ne relance rien. Sources modifiées, renommées ou absentes : rapport obsolète et navigation désactivée.

L’exemple [Tests des règles du jeu](../../examples/basic-test-suite/README.md) contient une suite avec score et collision. Les conditions du [banc BASIC](basic-tests-alpha.md) restent nécessaires : ROM CPC 6128 anglaises identifiées, assertions natives et programmes autonomes.

## Persistance et conflits

- `microide.tests.json` : suites portables, versionnables depuis l’atelier Git. 16 suites de 1 à 8 listings, 32 Kio au total.
- `.microide/test-reports/history.json` : historique local lié à l’identité du projet, exclu du périmètre Git de l’atelier. Dix rapports, 2 Mio maximum. Les noms et messages font partie du rapport, le texte BASIC et les ROM n’y sont pas copiés.
- Une modification externe des suites impose **Actualiser les suites et l’historique** avant réenregistrement. Un format inconnu ou invalide reste intact.
- Supprimer une suite conserve les sources et les rapports. Supprimer une source ne répare pas silencieusement la suite : elle signale l’absence et permet de retirer la référence.
- Un échec de conservation est affiché ; les exports Markdown/JSON restent disponibles. Fermer/changer de projet interrompt l’exécution en cours et invalide les réponses tardives ; un rapport partiel peut être exporté avant cette fermeture.

## Vérification

Les tests Node couvrent quotas, formats, cohérence des verdicts et empreintes, réouverture, révisions externes, références absentes, rétention, idempotence, corruption et liens. La recette navigateur à transport contrôlé vérifie création, lancement individuel/global, réouverture, historique sans exécution, obsolescence, navigation, conflit et suppression. La recette Electron utilise le vrai bridge IPC et vérifie les fichiers puis leur relecture après réouverture du projet. Les recettes firmware du banc restent distinctes : le transport contrôlé ne prouve pas l’exécution CPC.

## Suite prévue

Le [deuxième lot 0.39.1](basic-scenarios-alpha.md) réalise maintenant les scénarios avec fichiers ASCII initiaux, clavier programmé et observations exactes écran/fichier. La couverture et l’aide IA viendront après ces contrats ; elles ne sont pas livrées ici. Aucun jalon global n’est clos par ce premier lot.
