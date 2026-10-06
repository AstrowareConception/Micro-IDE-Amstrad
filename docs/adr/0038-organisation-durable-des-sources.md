# ADR 0038 — Organisation durable des sources humaines

- Statut : accepté
- Date : 2026-10-06
- Périmètre : alpha 0.31, lot 1 et IDE-003/008/009 partiels

## Décision

Réutiliser le mécanisme de mutation des sources/manifeste de l’ADR 0026 par extraction dans `WorkspaceJournal`. Conserver le chemin, le format v1 strict et la politique agent existants. Ajouter une politique humaine distincte dans `.microide/source-journal/current.json` : renommer/déplacer une source en gardant son ID, ou supprimer une source en gardant une entrée valide et au moins une source. Aucune source disque ne change de contenu par l’organisation ; documents, assets, cible et recette restent identiques.

Le domaine pur prépare le manifeste. Main possède un seul plan opaque, les octets avant/après et les préconditions ; le renderer reçoit un aperçu. Appliquer exige une confirmation native et revalide tout le snapshot. Renommage/déplacement ne sauvegardent pas les buffers. Suppression sale impose annuler, conserver le brouillon ou enregistrer puis supprimer. Le brouillon conservé figure dans le journal et un snapshot `source-draft`. L’enregistrement explicite utilise la sauvegarde durable existante avant une nouvelle préparation de suppression : ce choix n’est pas une transaction atomique commune.

Le journal précède l’historique et les écritures, le manifeste est publié après les sources, le marqueur final après contrôle. Une panne conserve pending et bloque les opérations du projet. Main propose terminer/rétablir à la réouverture avant les reprises agent/sauvegarde. Aucune IA n’est relancée. Seules les versions avant/après sont reconnues ; toute modification externe inconnue ou révision périmée bloque la reprise. Les données corrompues/inconnues restent conservées.

L’opération committed la plus récente est rétablissable tant que le manifeste et toutes les sources correspondent à son état après. La restauration publie à nouveau pending avant son premier effet, et se termine en restored. Le brouillon supprimé revient au buffer sans changer son état sauvegardé. La copie du record courant est aussi consultable comme texte inerte, même si une sauvegarde ultérieure empêche le rétablissement. Les IDs Monaco conservés maintiennent undo/redo et curseur des sources renommées/déplacées. Historique 20 snapshots/64 Mio, nouveaux motifs avant/après organisation et brouillon ; restauration d’un ancien projet complet non livrée.

## Bornes et limites

Humain : 1 Mio/source, 8 Mio/ensemble, 1 Mio/manifeste/version, 28 Mio/record, 128 entrées dans l’union et un brouillon supprimé optionnel. Agent : limites/droits inchangés. Chemins existants sous src ; destination sans collision, contrôle insensible à la casse, pas de liens/hardlinks. Dossiers de plus de 4 096 noms refusés pour cette vérification. Pas de création de dossier ni de déplacement de fichier ordinaire.

Réutiliser le code ne constitue pas une qualification supplémentaire des plateformes ou de l’émulation. Tests d’arrêt de processus et de reprise à deux choix ; pas de verrou interprocessus, pas de garantie de panne électrique ou de volume réseau, sync de dossier Windows non qualifié. Références littérales BASIC et renommages Git non réécrits/pris en charge par cet ajout. Ajout humain et changement indépendant d’entrée restent hors ce journal ; les jalons globaux restent ouverts.
