# Insertion contrôlée de commentaires Locomotive BASIC — 0.41.19

## Pourquoi une opération distincte ?

Les programmes historiques du CPC utilisent des numéros de ligne comme étiquettes de branchement et conservent fréquemment plusieurs instructions sur une même ligne. Insérer un commentaire n'est donc pas comparable à annoter un code moderne : créer une ligne, la renuméroter ou ajouter une instruction après un \`IF\` peut modifier le flux. Même une nouvelle ligne \`REM\` utilise de la mémoire du CPC et peut affecter les temps d'exécution.

CPCéleste apporte deux outils agentiques spécialisés, réutilisant le protocole de la 0.41.17 :
- \`language_comment_preview\` reçoit l'ID de source, son SHA-256, le **numéro BASIC d'une ligne déjà existante** et un texte ASCII de 3 à 96 caractères. Il construit un plan de nouvelle ligne \`REM\`, juste avant la ligne choisie, sans changer aucun octet des anciennes lignes.
- \`language_comment_apply\` refuse les aperçus absents, remplacés ou portant sur une autre révision du projet. L'application enregistre le plan exact via la mutation du projet, journalise le checkpoint et invalide toute précédente construction DSK.

Les plans sont consultables dans le panneau **Commentaires REM — avant et après** de la mission IA. Ils affichent le numéro ajouté, la ligne cible, le texte du commentaire, le statut, les avertissements et un extrait borné des deux listings. Le bouton de restauration du checkpoint initial reste applicable avec ses protections habituelles.

## Garde-fous

L'opération recherche un numéro libre entre la ligne précédente et la ligne choisie, prend le numéro immédiatement inférieur à cette dernière et **ne modifie pas les numéros existants**. Impossible d'insérer avant la toute première ligne : le point d'entrée du \`RUN\` doit rester identique. En l'absence d'espace numérique suffisant, l'opération refuse plutôt que de renuméroter.

Le plan est refusé en présence de diagnostics bloquants du listing, de fichiers CRLF dans le parcours agent (une sauvegarde normaliserait les fins de ligne), de contenu non ASCII, de branchements calculés et d'autres formes de contrôle/exécution ou d'état machine non qualifiées. Les sauts statiques ne doivent pas citer le numéro à ajouter. Les caractères susceptibles d'introduire des instructions après \`REM\` sont également refusés.

La conservation est contrôlée au niveau des **lignes sources originales**, du codec BASIC existant et de l'identité du projet. Ce n'est pas une preuve d'égalité octet à octet des programmes tokenisés, puisque la nouvelle ligne REM ajoute volontairement des octets.

## Commentaires rédigés par IA

Un commentaire est une **hypothèse documentaire** tant que sa signification n'est pas soutenue par les instructions analysées, le contexte et les références. L'agent doit lire le code, exploiter l'audit de lisibilité et éviter d'attribuer au programme une intention métier non établie. Le moteur valide la sûreté structurelle d'insertion, **pas la véracité du texte**.

La prévisualisation de chaque commentaire est visible au fil de la mission, mais ce lot n'instaure **pas encore une approbation humaine obligatoire** entre aperçu et application. La mission peut être restaurée depuis son checkpoint initial.

## Limites et suite

Les changements de mémoire et de timing empêchent toute garantie universelle d'équivalence comportementale sur CPC réel. La construction DSK doit être rejouée, ainsi que les suites de tests CPC effectivement liées aux sources modifiées, lorsqu'elles existent. En cas d'absence de numéro libre, de branchement dynamique ou de doute, l'agent doit proposer une note Markdown du projet plutôt que contourner les refus.

L'évolution suivante sera consacrée au **découpage multifichier**, nécessitant de qualifier les chargements, les références de ligne, l'ordre d'exécution, l'état partagé et les fichiers DSK. Aucun découpage automatique n'est livré par cette étape.
