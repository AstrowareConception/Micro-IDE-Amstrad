# ADR 0019 — Commandes d’atelier, historique Git et terminal humain

Date : 2026-10-04. Statut : acceptée pour l’alpha 0.14.

## Besoin

CPCéleste doit retrouver les gestes utiles d’un IDE mature sans importer des fonctions sans rapport avec le BASIC : découvrir une commande, rejoindre une source, chercher/remplacer, choisir une entrée et consulter les versions. Un utilisateur peut aussi vouloir lancer ses outils système dans le projet.

## Décision

Une liste de commandes d’interface alimente menus et palette ; Monaco conserve recherche, remplacement, annulation et actions contextuelles. Les actions sur une source utilisent son identité, indépendamment de l’onglet actif. Palette et menus contextuels de sources utilisent un dialogue natif HTML accessible au clavier. Aucune bibliothèque de widgets supplémentaire.

L’historique Git est lu par le même adaptateur conservateur que statut/index. Pagination de 20 commits, bornée à 2 000 ; curseur opaque unique et HEAD figé pour éviter doublons/pertes en cas de commit externe. Seuls OID, date et sujet sont transmis ; pas d’email, diff historique, notes, signatures exécutées ou chemins privés. Actualiser l’historique ouvre un nouvel instantané.

Le terminal humain est un port distinct du versionnement et des capacités agent. Le main exécute une commande système explicitement saisie et confirmée, avec cwd du projet. `/bin/sh -c` sans shell interactif sur Unix ; `cmd.exe /d /s /c` système sur Windows, à qualifier. Entrée sur une ligne ≤ 4 Kio, stdin fermé, sortie commune ≤ 64 Kio, durée ≤ 30 s, arrêt explicite. Les processus Unix restent dans un groupe dédié ; Windows utilise taskkill pour l’arbre. Cette gestion vise les outils ordinaires, pas le confinement d’un processus hostile qui change de groupe ou démonise.

Une commande active bloque opérations disque, démarrage IA et fermeture ; les brouillons empêchent son démarrage. La confirmation montre commande exacte et racine, et explique la capacité de modification hors projet. Sortie affichée comme texte, en mémoire seulement, non transmise à l’IA. Un sous-ensemble d’environnement suffit aux outils usuels ; pas d’héritage global des secrets/tokens ni de variable Git de l’IDE. La commande peut toutefois consulter les fichiers/configurations du compte hôte : ce n’est pas un sandbox.

## Conséquences

Pas de prétention à un terminal PTY : pas de REPL, SSH interactif, sudo ou programme demandant stdin. Pas de session shell persistante : `cd` n’affecte que sa commande. Le terminal permet à l’utilisateur d’exécuter lui-même Git, y compris des fonctions non exposées par les boutons ; il ne les qualifie pas comme fonctionnalités intégrées. Les restrictions Git de l’adaptateur ne s’appliquent pas aux commandes hôte volontairement exécutées.

Après modification externe, le projet doit être rouvert et les conflits arbitrés ; les buffers ne sont pas rechargés/écrasés silencieusement. Les contrôles Workspace restent actifs. L’historique local durable des sauvegardes, les commits depuis l’IDE, les remotes et le terminal PTY restent des incréments distincts. Qualification effective Linux en CI ; Windows/macOS restent à tester avant annonce de support du terminal.

Références : [Monaco IActionDescriptor](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor_editor_api.editor.IActionDescriptor.html), [git-log](https://git-scm.com/docs/git-log), [Node child_process](https://nodejs.org/api/child_process.html).
