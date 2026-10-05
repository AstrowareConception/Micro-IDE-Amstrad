# Copie et récupération des brouillons — alpha 0.19

Suite R2, contribution partielle à IDE-011. [ADR 0024](../adr/0024-copie-brouillons-et-reprise-buffers.md), [roadmap](../specifications/17-roadmap-ide-complet.md).

## Utilisation

Ouvrir un projet desktop. Le panneau **Brouillons récupérables** inspecte les copies locales. Sans copie précédente, cocher **Copie automatique des brouillons**, ou modifier le code puis **Copier les brouillons maintenant**. L’option est désactivée par défaut et pour chaque nouvelle session. Deux secondes après une pause de saisie, la copie garde les buffers modifiés ; un contrôle toutes les quinze secondes couvre la saisie continue. Les sources BASIC restent intactes et les onglets restent modifiés.

Après une fermeture ou interruption, rouvrir le même dossier. La copie précédente est signalée et conservée ; la capture automatique reste désactivée pour éviter de l’écraser avec les fichiers disque. **Comparer les brouillons récupérables** ouvre un diff : buffer actuel à gauche, brouillon à droite. Choisir les sources puis **Restaurer les brouillons sélectionnés dans les buffers**. Rien n’est sauvegardé implicitement ; Ctrl Z annule par source, Ctrl Maj Z rétablit. Enregistrer actif ou Enregistrer tout reste l’étape explicite d’écriture.

Une reprise partielle laisse la copie originale intacte et protège les brouillons non sélectionnés. Réouvrir la comparaison pour reprendre le reste ; la capture ne peut redémarrer qu’après reprise complète ou effacement explicite. **Relire la copie de brouillons** suspend l’automatisme et renouvelle sa révision. La relecture ne signifie pas qu’un buffer est enregistré.

**Effacer la copie de brouillons** demande une confirmation native, annulée par défaut. L’effacement concerne uniquement la copie et désactive l’automatisme, sans toucher aux buffers ni aux sources. Désactiver la case seule conserve la copie. Un enregistrement ou une fermeture ne l’efface pas automatiquement : après enregistrement, la base de copie peut différer, et sa restauration est alors refusée. Effacer explicitement la copie devenue inutile après vérification.

## Données et conflits

Copie courante `.microide/drafts/current.json` : UUID, projet/manifeste, date, sources dirty et bases exactes avec empreintes. Une seule copie par projet, avec 1 Mio/version/source, 8 Mio par ensemble et 24 Mio JSON maximum ; fichiers nouveaux 0600 et répertoires 0700. Les originaux CRLF sont conservés dans la base, les buffers reprennent du LF. Le déplacement du dossier conserve la copie. Les versions identiques ne sont pas réécrites.

Révision du record contrôlée à chaque mutation/lecture ; manifeste exact et bases de toutes les sources dirty vérifiés avant reprise. Si la copie, le disque, le manifeste ou les buffers ont changé depuis l’aperçu, la restauration refuse et conserve les données. Fichiers corrompus/futurs, liens et chemins inconnus ne sont ni réparés ni effacés automatiquement ; examiner la copie conservée avant intervention manuelle. Les temporaires incomplets ne sont pas interprétés ; huit maximum avant nouvelle publication.

La copie reste privée, ne rejoint ni DSK ni contexte IA automatiquement. Les dépôts Git créés par l’IDE excluent `.microide` ; vérifier cette exclusion pour un dépôt externe.

## Vérification et limites

126 tests Node, dont huit nouveaux du stockage et un arrêt réel par SIGKILL après capture. Les six interruptions du journal de sauvegarde restent exécutées. Typecheck/build et contrôle documentaire ; recette navigateur et Electron selon les preuves de la PR. Le test natif vérifie copie automatique, vrai SIGKILL de l’application sandboxée/relaunch, protection d’une copie héritée, diff, conflit externe, sélection/undo/redo, annulation d’effacement et sauvegarde explicite. Capture `out/drafts-alpha.png`, artefact Desktop editor conservé sept jours.

Copie opt-in des projets uniquement, pas des listings autonomes. Fenêtre de perte avant/pour les touches suivant la dernière capture ; timers suspendus pendant missions agent, terminal, atelier occupé et aperçus. Aucune garantie panne électrique, réseau FS ou Windows/macOS ; pas de verrou interprocessus. Pas encore de watcher, merge externe, nettoyage automatique des copies après sauvegarde ou réglage persistant de l’option. R2, IDE-011 et ACC-02 restent partiels.

Prochaine tranche : IDE-012, détection et comparaison des modifications externes avec conservation des buffers dirty.
