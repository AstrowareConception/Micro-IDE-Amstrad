# ADR 0037 — Explorateur réel du projet et lectures seules

Date : 6 octobre 2026. Statut : accepté pour l’alpha 0.30.

## Décision

Commencer le lot 1 par une navigation humaine dans les fichiers réels. Le port `ExplorerPort` expose liste et aperçu ; ses DTO sont indépendants d’Electron dans `packages/workspace/src/explorer.ts`. `ProjectExplorer` réalise les accès disque. Le preload ne reçoit jamais de racine arbitraire : session active, chemin relatif validé, contrôle du manifeste et absence de liens/jonctions sur le trajet. La liste est consultative et ne réserve pas le verrou de mutation ; les lectures d’aperçu sont explicites et revérifiées.

Charger un dossier à la fois avec `opendir` : 500 entrées retournées ou 2 000 examinées, puis signal de liste partielle. Masquer par défaut noms commençant par un point et dossiers générés usuels ; option humaine locale pour les voir. Identifier les liens sans lire leur cible. Trier dossiers puis noms. L’interface borne sa navigation à 32 dossiers chargés et 16 niveaux ; Actualiser libère cette vue. Le filtre est local aux dossiers chargés, sans recherche récursive cachée.

Cliquer une source rejoint son buffer Monaco, y compris une vue fermée et un brouillon. Un document déclaré utilise son lecteur existant, avec contrôle d’empreinte. Un autre fichier n’est jamais déclaré ni exporté implicitement. Aperçu UTF-8 inerte de 64 Kio maximum ; binaire, encodage inconnu ou fichier volumineux : métadonnées seulement. HTML dans une textarea, sans rendu. Révision issue des attributs disque ; handle borné, contrôle avant/après et refus des remplacements courants. Aucun outil nouveau ni accès au texte ordinaire accordé à l’agent.

## Conséquences

Les mutations humaines de fichiers attendent leur propre journal durable. L’alpha ne propose ni éditeur de texte ordinaire, ouverture externe, watcher supplémentaire, badges Git, configuration d’exclusions, ni restauration de l’arbre. Elle ne prétend pas éliminer toute course contre un processus hostile modifiant simultanément l’arborescence ; les contrôles restent ceux d’un atelier local. Lot 1 et IDE-002 restent partiels.

## Vérification

Tests disque : portée source/document, manifeste conservé, liens et chemins invalides, fichiers modifiés/remplacés, encodage/binaire/grandes tailles, limites d’énumération. Recette navigateur : navigation, brouillon/undo, aperçu/Escape/focus, filtre, visibilité, document et erreurs. Recette Electron : vrai IPC/disque, aperçu inerte, taille, visibilité et session périmée ; la CI distingue les résultats attestés des scénarios seulement préparés.
