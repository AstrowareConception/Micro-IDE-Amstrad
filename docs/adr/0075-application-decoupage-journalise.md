# ADR 0075 — Application du découpage BASIC par journal durable

- Statut : accepté
- Date : 2026-10-16
- Périmètre : alpha 0.41.25, IDE-008/017/062/064 partiels

## Décision

L’application utilise exclusivement le plan terminal immuable produit par la simulation, avec ID opaque de mission, SHA source, snapshot complet et compteur de mutations. Les arguments d’application ne contiennent aucun texte ni manifeste candidat. Une seule invocation de l’adaptateur enregistre les deux sources et le manifeste avec le journal de l’ADR 0026 ; aucun nouveau mécanisme parallèle de persistance n’est créé.

L’état attendu est fourni à `ProjectStore.applyAgentState` et contrôlé avant écriture. Le plan est consommé après toute tentative de persistance ; les erreurs avant cette étape, notamment références non consultées, ne l’appliquent pas. Un commit déjà adopté par le contrôleur reste annoncé comme appliqué même si l’écriture du journal de mission échoue ensuite. La construction finale doit être répétée après mutation.

Le journal agent existant expose son dernier état rétablissable aux projets BASIC. Le port desktop `agentMutations` offre lecture du point de retour et restauration avec révision et buffers complets. Les canaux `agent-mutations:*` restent soumis au verrou global des opérations disque et ne bénéficient pas de l’exception `agent:*` réservée au contrôleur. Dialogue humain à l’initiative de la commande ; aucune confirmation dans les outils de mission autorisés.

## Cohérence et limites

Le journal publie des fichiers individuellement puis le manifeste, avec contrôles répétés et marqueur final. La cohérence est assurée par le protocole de reprise, pas par une garantie d’atomicité physique du répertoire. Aucun rollback automatique qui écraserait un changement extérieur n’est ajouté. Les cas pending continuent de bloquer l’ouverture normale ; les choix avant/après restent ceux de la mutation initiale, même lors d’une restauration interrompue.

La restauration durable vise la dernière mutation disque et exige des buffers propres. Elle ne remplace pas le checkpoint initial de mission ni une restauration arbitraire d’historique. Les collisions de casse sont refusées dans tous les chemins du journal commun. Le périmètre syntaxique de la simulation reste inchangé.

## Validation

Tests d’intégration du vrai ProjectStore et des outils agent ; arrêts de processus aux frontières d’écriture et de retrait ; comparaison des DSK du projet réouvert/restauré sur les ROM de référence ; recette native Electron avec fournisseur contrôlé. Voir [guide et limites](../implementation/basic-multifile-apply-alpha.md). La CI native et les qualifications de plateforme ne sont pas déduites d’un succès de tests unitaires.
