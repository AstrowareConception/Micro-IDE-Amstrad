# ADR 0025 — Revue des modifications externes

- Statut : accepté
- Date : 2026-10-05
- Périmètre : alpha 0.20, R2 / IDE-012 partiel

## Décision

Un port `ExternalPort` expose inspection, lecture d’une version et adoption explicite de sa base disque. Le renderer ne fournit ni racine ni chemin libre ; main contrôle session, opérations concurrentes, manifeste, source déclarée et empreintes. L’inspection retourne uniquement les sources modifiées/illisibles ; l’aperçu lit le texte demandé. Les domaines restent indépendants du système de fichiers.

L’observateur initial est un contrôle par empreinte toutes les cinq secondes, au retour de focus et à la demande, pour les seuls projets ouverts visibles. Il est suspendu pendant l’occupation de l’atelier, une requête du panneau ou un aperçu. L’inspection passive ne réserve pas le verrou des opérations utilisateur : ses résultats sont indicatifs et les actions explicites recontrôlent les versions ; un poll déjà occupé ou un atelier occupé refuse la nouvelle inspection. Un panneau borné à 64 entrées remplace les notifications cumulatives. Une suppression ou un déplacement est signalé comme absence, sans suivi automatique de renommage. Un manifeste modifié impose une réouverture manuelle après conservation des buffers.

Aucun rechargement implicite. Après comparaison, charger remplace le modèle Monaco avec undo ; conserver le buffer adopte seulement la nouvelle référence disque. Cette dernière action explique qu’une prochaine sauvegarde explicite remplacera la version disque comparée. L’adoption ne crée ni sauvegarde, ni snapshot, ni nouvelle copie de brouillon. Les sources dirty restent accessibles ; si le buffer évolue pendant l’IPC d’adoption, le renderer conserve ce buffer et met à jour sa base, sans le remplacer.

## Préconditions et limites

Lecture/adoption vérifient manifeste, journal résolu, SHA-256 de version disque et base connue. Une nouvelle modification après cette vérification est détectée à la sauvegarde/inspection suivante ; pas de verrou interprocessus ni garantie contre toute course de chemins. UTF-8 sans BOM/NUL, 1 Mio/source et inspection de 8 Mio de sources maximum. Liens et chemins hors projet refusés selon l’adaptateur existant. Les erreurs restent visibles, sans réparation/effacement automatique.

La base adoptée reste en mémoire de session. Les copies de récupération existantes restent intactes ; une copie fondée sur une ancienne base peut refuser la reprise. Pas de fusion à trois voies, listings autonomes, watcher événementiel, assimilation de nouveaux fichiers/manifeste ni qualification Windows/macOS. IDE-012 et R2 restent partiels ; extension des checkpoints aux mutations agent suit avant checkout Git.
