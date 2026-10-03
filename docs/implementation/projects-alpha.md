# Alpha projets BASIC 0.5

Date : 2026-10-03. Extension de l'[édition 0.4](editor-alpha.md), selon l'[ADR 0010](../adr/0010-projets-basic-incrementaux.md). Ce document décrit l'implémentation, pas la clôture de J1/J2.

## Parcours utilisateur

Installer et lancer depuis les sources avec les commandes du guide 0.4. Dans l'application desktop : saisir le nom du projet, cliquer **Créer projet dans un dossier vide** et choisir un dossier. L'application crée `microide.project.json` et `src/main.bas`. **Ouvrir projet** sélectionne un dossier contenant ce manifeste, notamment `examples/hello-cpc`.

L'explorateur et les onglets affichent les sources déclarées. Chaque onglet conserve texte, annuler/rétablir et curseur pendant les changements. Une pastille indique chaque buffer modifié. **Enregistrer / Ctrl S** sauvegarde seulement la source active. **Enregistrer sous** est désactivé dans un projet pour ne pas déplacer implicitement une source hors manifeste.

**Ajouter source** reçoit un nom ASCII de 1 à 8 lettres, chiffres ou underscores, sans extension. `UTIL` devient `src/util.bas`, identifiant `util`, nom CPC `UTIL.BAS`. Les fichiers existants et les collisions sont refusés. Les dossiers imbriqués peuvent être ouverts via un manifeste valide ; leur création depuis l'UI n'est pas encore disponible.

**Définir comme entrée** modifie le manifeste, sans sauvegarder les autres buffers. **Exporter DSK** construit les buffers courants de toutes les sources, y compris modifiés, avec les noms CPC déclarés. Les listings sont indépendants, non concaténés. L'entrée nomme le programme à lancer ultérieurement (par exemple `RUN"UTIL.BAS"`) ; cet incrément ne le lance pas. L'export ne marque aucun buffer enregistré et doit être placé hors du dossier projet. La validation de structure n'est pas une qualification d'exécution.

Remplacer le document/projet ou fermer une fenêtre modifiée requiert confirmation. Un échec ou une annulation d'ouverture ne remplace pas les buffers. Le dossier peut être déplacé puis rouvert : identités et chemins restent relatifs. Les anciennes sessions IPC ne peuvent plus écrire après une nouvelle ouverture.

## Frontières et capacités

| Frontière | Comportement livré |
| --- | --- |
| Manifeste | Contrat v1 existant, propriétés exactes, profil 6128/BASIC 1.1, entrée existante, 1–64 sources |
| Sources | UTF-8 strict sans BOM/NUL, LF en mémoire, 1 Mio par fichier ; budget total 8 Mio à l'ouverture et à l'export |
| Chemins | Relatifs sous `src/`, extension BASIC, pas de traversal ou noms réservés Windows ; collisions insensibles à la casse |
| Liens | Sources et répertoires intermédiaires symboliques/jonctions refusés ; résolution réelle sous la racine |
| Sauvegarde | Hash original source et manifeste contrôlé ; temporaire créé exclusivement puis renommé |
| IPC | Session opaque, identifiant déclaré, payload borné, émetteur/frame validé, opérations disque sérialisées |
| Aperçu navigateur | Édition monofichier/téléchargement maintenus ; boutons de projets persistants désactivés explicitement |

Les assets/documents non vides, profils non pris en charge, encodage `cpc-qualified` et versions futures sont refusés sans conversion silencieuse. Le schéma produit reste plus large que cette alpha ; sa version n'est pas changée pour supprimer les capacités futures.

## Preuves reproductibles

`npm run typecheck`, `npm test` (**36 tests**), `npm run build:desktop` et `npm run test:editor` ont réussi localement. Les sept nouveaux tests couvrent le contrat, collisions, encodage multifichier déterministe, sauvegarde/réouverture après déplacement, conflits, fichiers existants, destinations d'export, liens, UTF-8 et limites. Le contrôle agent-browser n'a pas démarré son daemon ; le parcours Playwright et sa capture constituent la preuve navigateur effectivement exécutée.

`tests/desktop-smoke.mjs` vérifie dans la vraie application : création/ouverture, ajout sans perte du brouillon principal, annuler/rétablir après changement d'onglet, curseur indépendant, sauvegarde active seule, entrée persistée, export du brouillon d'une autre source, sessions périmées, conflits et déplacement. Le workflow `Desktop editor` exécute ce parcours sous Xvfb avec utilisateur non privilégié et sandbox activé ; son résultat effectif doit être consulté dans la PR. Les captures `project-alpha.png` et les captures d'échec sont conservées sept jours par le workflow. Pas de résultat Electron local revendiqué dans l'environnement root sans affichage.

Contributions partielles à REQ-PRJ-001/002, REQ-EDT-001 et ACC-01/02/03/06. Ni ACC-02 complète ni durabilité multifichier qualifiée : reprise, transactions et surveillance sont encore nécessaires.

## Limites et suite

Aucune nouvelle dépendance. Pas d'autosave, journal, recovery après crash, fsync garantissant la panne électrique, watcher, verrou interprocessus, migration, sauvegarde globale, import/suppression/renommage de source. Les contrôles de hash ne ferment pas une course avec un autre processus entre vérification et renommage. La création/ajout peut laisser des fichiers conservés lorsqu'une étape suivante échoue ; l'erreur l'annonce et demande réouverture. Les buffers non sauvegardés sont perdus en cas de crash.

Prochaine tranche : sauvegarde coordonnée avec journal/checkpoints et reprise, puis enrichissement du langage. Les transactions seront aussi nécessaires aux mutations réversibles de l'agent. L'émulateur attend toujours la recette avec ROM autorisées et oracle externe ; l'IA agentique et les ressources restent à implémenter, pas remplacées par ces onglets.
