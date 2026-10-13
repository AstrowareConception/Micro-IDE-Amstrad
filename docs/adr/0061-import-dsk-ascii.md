# ADR 0061 — Import DSK ASCII conservateur et originaux locaux

Statut : acceptée pour l'incrément 0.41.2, 13 octobre 2026.

## Contexte

Le produit doit reprendre une ancienne disquette en projet éditable, puis évoluer vers BASIC tokenisé et rétro-ingénierie Z80. Le reader actuel ne qualifie que standard DATA, 40 pistes, une face, utilisateur 0. L'application n'intègre pas encore les ressources binaires au build.

## Décision

Livrer d'abord un parcours borné : analyse dans un thread Node jetable (32 Mio, délai cinq secondes), catalogue et aperçu, sélection des ASCII numérotés, choix de l'entrée et création d'un **nouveau sous-dossier**. Aucun fichier de destination ne provient d'un chemin interne au disque. Le main possède octets, chemin et identifiant d'aperçu ; le renderer ne peut choisir que des IDs. L'empreinte de la disquette est relue avant création.

La classification est indépendante de l'extension. Les en-têtes AMSDOS à checksum/longueur plausibles indiquent des types présumés, pas une preuve de décodabilité. Les listings ASCII exigent un EOF CTRL-Z, des caractères imprimables, une numérotation croissante et aucun contenu dissimulé après EOF hors remplissage accepté. La validation syntaxique reste celle de l'éditeur/build.

Élargir `sources[].cpcName` aux noms CPC 8.3 déjà acceptés par le codec disque et les assets du schéma. Le chemin de travail reste un `.bas` sous `src/`. Cette extension compatible en lecture pour cette version conserve les noms `.BIN` ou sans extension, sans réécrire arbitrairement `RUN`/`CHAIN`/`LOAD`. Les anciennes versions de l'IDE peuvent refuser ces nouveaux manifestes ; elles ne doivent pas les convertir silencieusement. `RUN` conserve la validation des caractères autorisés pour prévenir toute injection clavier.

Conserver le DSK et les enregistrements complets de tous les fichiers sous `.microide/imports/`, exclus de Git/build/IA par le périmètre existant. **Ces originaux ne sont pas un cache jetable** et ne suivent pas la rétention de l'historique. `import-report.json` décrit les conversions et limitations avec chemins relatifs et empreintes. Les autres fichiers ne sont pas inclus dans le build : avertissement avant validation et après ouverture.

Créer dans un dossier temporaire privé unique, écrire les fichiers avec le mécanisme fsync/remplacement existant, publier le manifeste en dernier puis renommer le dossier vers une destination UUID neuve. Un échec garde le temporaire pour examen ; aucune suppression récursive ni fusion dans un projet existant. Cette stratégie évite les mutations partielles du projet courant. Elle ne prétend pas livrer une reprise automatique d'import ni qualifier la panne électrique ou la concurrence hostile entre processus.

## Conséquences

Le parcours ASCII devient utilisable sans ROM ni clé IA. Les projets produits réutilisent sauvegarde, agent et construction existants. Ni le détokeniseur, ni les ressources exécutables, ni Extended, ni Z80 ne sont annoncés comme réalisés. Leur qualification doit suivre les documents 20/21. Le test navigateur utilise le vrai worker et le stockage avec un pont contrôlé ; l'IPC Electron possède une recette distincte, exécutée en CI.
