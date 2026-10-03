# Programme de recette J0

`npm run build:probe` génère `out/probe.dsk`, avec `PROBE.BAS` en ASCII et `CHECK.BIN` en binaire AMSDOS chargé à `&9000`. Le listing [probe.bas](src/probe.bas) teste chargement, fichier texte, graphique, son et entrée clavier. Il est distinct du projet hello et ne possède pas encore de manifeste applicatif.

Consulter le [banc technique](../../tools/j0-harness/README.md) pour l'essai et la relecture de l'export de session. La présence du fichier dans le dépôt n'est pas une preuve de son exécution sur CPC.
