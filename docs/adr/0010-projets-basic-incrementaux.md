# ADR 0010 — Projets BASIC multifichiers incrémentaux

Statut : acceptée pour l'alpha 0.5. Date : 2026-10-03.

## Contexte et décision

L'alpha 0.4 édite un listing. Pour préparer les mutations agentiques sans introduire un chat dépourvu d'outils, la tranche suivante introduit les vrais dossiers de projet et plusieurs buffers indépendants. Elle utilise le contrat v1 existant, pas un format concurrent.

Le domaine Workspace valide le manifeste, les identités, chemins portables et collisions et construit le DSK depuis un snapshot complet. L'adaptateur Electron possède le dossier sélectionné nativement et expose des opérations spécifiques associées à une session opaque. Le renderer ne reçoit pas de capacité d'accès arbitraire au système de fichiers. Les opérations disque sont sérialisées dans le main.

Cette tranche prend en charge seulement les sources BASIC ASCII, sans assets/documents. Un manifeste non pris en charge est refusé explicitement sans être réécrit. Chaque source produit son propre fichier CPC ; le point d'entrée est une référence persistée, pas une fusion de listings ni un mécanisme d'autoboot.

Chaque document conserve son modèle Monaco, ses changements, son historique et sa position pendant les changements d'onglet. L'ajout renvoie seulement la nouvelle source pour ne pas remplacer les buffers modifiés par leur version disque. Enregistrer sauvegarde l'onglet actif ; construire utilise tous les buffers, sans les marquer enregistrés.

## Conséquences et limite de livraison

Un hash refuse les conflits déjà présents dans le manifeste ou la source sauvegardée. Une écriture individuelle utilise temporaire et renommage. Cela ne livre **pas** le journal transactionnel multifichier, la récupération après crash ou le verrou interprocessus définis au document 10. La course entre contrôle et renommage reste connue. J1-03 et ACC-02 ne sont pas clôturés.

La création requiert un dossier vide et publie le manifeste en dernier. Un échec peut laisser des fichiers créés par l'opération. L'ajout utilise une création exclusive ; si la publication du manifeste échoue, la source non déclarée reste conservée et l'erreur demande une réouverture. Pas de suppression de fichier existant pour masquer un échec.

L'export DSK doit rester hors du dossier projet, y compris lorsqu'un alias de répertoire est utilisé. Cette restriction protège manifeste, sources et futurs documents. Import, renommage, suppression de source, sauvegarde globale et migrations restent des incréments ultérieurs. Aucun changement au HOLD firmware J0 ni à l'architecture agentique prévue.
