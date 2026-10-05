# Modifications externes — alpha 0.20

Contribution partielle à IDE-012 / R2. [ADR 0025](../adr/0025-revue-des-modifications-externes.md), [roadmap](../specifications/17-roadmap-ide-complet.md).

## Parcours

Ouvrir un projet desktop. **Modifications externes** vérifie les sources toutes les cinq secondes lorsque la fenêtre est visible, au retour de focus et via **Vérifier les fichiers disque**. Le contrôle est suspendu pendant un aperçu ou une opération occupante. Les onglets et brouillons restent intacts. Sources déplacées/supprimées, illisibles et changement de manifeste sont annoncés dans le panneau.

**Comparer src/…** affiche le buffer à gauche et la version disque à droite. Fermer conserve tout. **Charger la version disque dans le buffer** charge explicitement le texte et adopte sa base enregistrée ; Ctrl Z revient au buffer précédent qui redevient modifié, Ctrl Maj Z rétablit. Aucune écriture disque et aucune suppression d’historique.

**Conserver mon buffer après comparaison** conserve le texte et adopte la base disque examinée. Le buffer reste modifié s’il diffère de cette base ; Enregistrer/Enregistrer tout devient ensuite l’action explicite qui remplace le disque. Un changement de disque après l’aperçu refuse l’adoption. Une saisie survenue pendant l’IPC est conservée, même si un chargement avait été demandé. Les autres sources ne sont pas adoptées implicitement.

## Vérification et limites

132 tests Node, dont six sur comparaison/adoption, révisions périmées, sauvegarde ultérieure, suppression/déplacement/recréation, UTF-8/BOM/NUL/tailles, liens, manifeste, journal interrompu, copie de brouillons conservée et budget global. Typecheck/build, contrôle documentaire et smoke navigateur. La recette Electron vérifie détection automatique, buffers propres/dirty conservés, diff, refus d’une version périmée, chargement/undo/redo, conservation puis sauvegarde explicite, alertes absence/manifeste et session IPC expirée. Les preuves natives sont celles du workflow Desktop editor de la PR ; capture `out/external-alpha.png` conservée sept jours.

Première observation par polling SHA-256, 1 Mio/source, 8 Mio/projet et 64 sources ; pas de watcher événementiel ou mesure de latence/performance sur tous les systèmes. Linux/CI qualifié selon les résultats de PR ; Windows/macOS restent à tester. Pas de fusion automatique/à trois voies, suivi du renommage ni ajout de fichier/manifeste à chaud. Réouverture manuelle nécessaire pour un manifeste changé ; copier/conserver ses brouillons avant de l’abandonner. Les copies de récupération antérieures restent conservées, mais leur restauration peut refuser si la base disque diffère. Aucune garantie de verrou interprocessus ou panne électrique. Les mises à jour Git externes sont visibles comme changements de fichiers ; checkout/pull intégrés restent à réaliser.

Suite : checkpoints/historique durable des mutations agent, puis identité/commit Git avant synchronisation et changements de branche.
