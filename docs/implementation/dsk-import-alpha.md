# Import de disquette — première tranche 0.41.2

## Parcours

Dans l'application desktop, **Fichier → Importer une disquette DSK…** ouvre une image standard DATA de 40 pistes, une face, utilisateur 0. L'IDE présente le catalogue, les tailles en enregistrements, le type présumé et un aperçu des listings ASCII. La palette propose la même commande.

Sélectionnez les programmes à reprendre, choisissez l'entrée et le nom du projet, puis son **dossier parent**. CPCéleste crée un nouveau sous-dossier `CPC-import-<identifiant>` et ouvre les sources sélectionnées. Un listing ASCII nommé `.BIN` reste un programme BASIC et conserve ce nom sur la disquette reconstruite ; ses fichiers de travail sont des `.bas` numérotés sous `src/`. Aucun renommage implicite des appels internes.

Vous pouvez ensuite éditer, enregistrer, utiliser l'agent dans son périmètre habituel et exporter un nouveau DSK contenant les sources sélectionnées. La syntaxe BASIC est contrôlée par les diagnostics et le build existants ; reconnaître un listing à l'import ne signifie pas qu'il s'exécute correctement.

## Originaux et limites

- Le DSK complet est copié dans `.microide/imports/original.dsk` ; tous les fichiers sont conservés sous forme d'enregistrements dans `.microide/imports/records/`.
- `import-report.json`, à la racine du projet et consultable depuis l'explorateur, associe noms CPC, empreintes, chemins, classifications et sources créées. Les tailles brutes comprennent le remplissage CP/M ; aucune longueur binaire inconnue n'est inventée.
- Les originaux ne sont pas envoyés à l'IA, ajoutés à Git ou inclus dans le DSK de build. Sauvegarder le **dossier complet**, y compris `.microide/imports`, pour conserver ce patrimoine ; ce répertoire n'est pas un cache à nettoyer.
- Seuls les BASIC ASCII sélectionnés sont reconstruits. Les écrans, données et routines binaires sont préservés mais **ne sont pas encore réintégrés à l'exécution**. Un programme qui en dépend peut échouer ; l'assistant l'annonce.
- BASIC tokenisé/protégé : classification présumée par l'en-tête AMSDOS, conversion non disponible. Caractères CPC non ASCII, Extended/SYSTEM, autres géométries/utilisateurs et certains noms historiques restent refusés.
- Aucun projet vide n'est créé lorsqu'il n'existe pas de listing convertible. L'analyse ne lance aucun programme et n'utilise ni ROM ni réseau. Traitement en worker, limité à cinq secondes ; l'analyse n'a pas encore de bouton d'annulation dédié.

L'empreinte du DSK est vérifiée avant création. Une annulation du dossier conserve le projet courant. Les brouillons doivent être arbitrés avant ouverture du projet importé. En cas d'échec pendant les écritures, le dossier préparatoire `.microide-import-<identifiant>` reste conservé dans le parent choisi ; l'erreur donne son emplacement. Ne pas effacer ce dossier sans examen. S'il contient un manifeste complet, il peut être ouvert pour vérification ; sinon recommencer l'import depuis le DSK intact dans un nouveau dossier. Pas de reprise automatique ni garantie de panne électrique dans cette tranche.

## Validation

Six nouveaux tests de domaine/adaptateur couvrent détection par contenu, préservation des octets, formats refusés, fichiers ambigus, sélection invalide, worker réel, modifications depuis l'aperçu, projets préexistants, réouverture après déplacement, sauvegarde, accès agent et reconstruction. La suite complète compte **400 tests réussis** localement. TypeScript, build renderer et build main réussis. Le parcours Chromium avec le vrai worker et le vrai stockage a réussi : sélection, aperçu, annulation protégeant le brouillon puis ouverture du projet. Capture inspectée. La recette navigateur et l'IPC natif sont dans `tests/disk-import-smoke.mjs`, raccordés aux suites existantes ; la partie IPC/Electron reste à vérifier en CI.

Pas de nouvelle qualification firmware, matériel ou émulateur indépendant. Le build desktop complet embarquant le WASM et les essais Electron/Windows sont laissés aux contrôles CI ; aucun nouvel installateur annoncé. Voir l'[ADR 0061](../adr/0061-import-dsk-ascii.md) et les [lots suivants](../specifications/20-import-dsk-projet.md).
