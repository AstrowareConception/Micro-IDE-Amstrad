# Références écran inspectables — 0.41.32

Le panneau **Tests projet** peut maintenant capturer le résultat d’un programme pour préparer une attente écran. Une capture est un aperçu temporaire : elle ne produit ni verdict de réussite ni rapport historique, et ne modifie aucun fichier du projet.

## Préparer une première référence

1. Ouvrir un projet BASIC et **Tests projet**. Créer ou sélectionner un scénario, puis renseigner son nom, ses saisies et son budget. Les attentes peuvent encore être incomplètes ou absentes.
2. Choisir **Capturer un écran de référence**. Le DSK contient les sources ouvertes, y compris leurs modifications non enregistrées, et les ressources déclarées. Le CPC utilise les saisies et le budget du brouillon ; les ROM locales 6128 anglaises identifiées restent nécessaires.
3. Examiner l’image complète, puis tracer une zone à la souris ou remplir X, Y, Largeur et Hauteur. Le détail agrandi permet de vérifier les pixels sélectionnés. Une zone doit rester dans le cadre 768 × 272 et ne pas dépasser 16 384 pixels.
4. Choisir une nouvelle attente ou une attente écran à remplacer, puis cliquer **Adopter cette zone comme référence**. Seules ses coordonnées, son nom et l’empreinte SHA-256 des pixels RGBA rejoignent le brouillon. L’image complète n’est pas enregistrée.
5. **Enregistrer les scénarios**, puis **Exécuter le scénario**. Ce nouvel essai produit le premier verdict sur la référence adoptée. Une capture dont le résultat est incorrect ne doit pas servir de référence.

Éviter les curseurs clignotants, animations et autres zones instables. Le budget observe un instant déterminé après RUN ; il ne détecte pas la fin du programme. Les coordonnées désignent les pixels du framebuffer de test, pas les coordonnées graphiques BASIC. L’image conserve sa taille logique dans un affichage responsive.

## Révisions et responsabilités

La capture partage le démarrage, l’injection clavier, le DSK et le budget des essais existants. Le worker renvoie le cadre RGBA opaque avec l’identité du DSK et des ROM. Le processus principal vérifie ces données et conserve une seule capture active. Les pixels sont copiés vers l’aperçu ; l’adoption reçoit seulement un identifiant, une zone et le plan de scénario. Le processus principal calcule l’empreinte depuis sa propre copie.

Le contrôleur refuse l’adoption pour une autre session, après un nouvel essai, ou si les sources/ressources, le manifeste d’exécution, les saisies, le budget, le nom du scénario ou la révision de sa bibliothèque diffèrent. Les attentes sur disque sont relues lors de la capture et de l’adoption. Les brouillons restent protégés et intacts après capture. **Écarter la capture**, l’annulation ou la fermeture ne sauvegardent aucune attente. Après redémarrage, les attentes enregistrées subsistent ; l’aperçu temporaire disparaît.

Les canaux humains `project-tests:capture/adopt` complètent le port existant. Aucun outil de capture/adoption n’est exposé à l’agent. Les contrats de bibliothèque et de rapports JSON restent en version 1 ; un ancien rapport n’est jamais transformé en succès par adoption.

## Vérifications

- Tests unitaires : préparation sans attente, clavier exact, limites de rectangle, extraction des lignes RGBA, provenance, altérations, révisions concurrentes, session, annulation, absence de sauvegarde et de rapport implicites.
- `scripts/qualify-project-screen-reference.mjs` : vrai worker CPC, capture puis adoption, comparaison avec une observation indépendante du même moteur, succès/échec du buffer altéré/retour au succès, réouverture et sources intactes. Preuve : `out/project-screen-reference-qualification.json`.
- `tests/project-screen-reference-desktop.mjs`, intégré à la recette Electron des scénarios : aperçu, sélection souris et coordonnées, budget périmé, limite de surface, adoption, sauvegarde, vrai essai, abandon, arrêt et référence retrouvée après réouverture. Capture : `out/project-screen-reference-desktop.png`.

La qualification demeure limitée au moteur intégré et aux ROM identifiées. Elle ne prouve ni terminaison, ni couverture exhaustive, ni équivalence universelle, ni fonctionnement sur matériel physique. Les pixels ne sont pas archivés ; cette version n’ajoute ni comparaison visuelle avant/après ni masques multiples.

[ADR 0082](../adr/0082-reference-ecran-humaine.md) · [Parcours des scénarios](project-scenarios-ui-alpha.md).
