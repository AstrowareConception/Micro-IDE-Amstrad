# CPCéleste — Centre de notifications alpha 0.33

Date : 6 octobre 2026. Réalisation partielle d’IDE-029 et du lot 7 ; [ADR 0040](../adr/0040-centre-notifications-session.md).

## Utilisation

La cloche indique les messages non lus. Affichage → Centre de notifications, palette et `Ctrl/Cmd Alt N` ouvrent la même vue ; la combinaison est modifiable dans Paramètres → Raccourcis. Si un ancien raccourci utilise déjà cette combinaison, la migration préserve ce choix et laisse le centre sans raccourci. Le centre conserve les 100 messages les plus récents de la session, avec heure, origine, niveau et compteur de répétitions consécutives rapprochées.

Rechercher filtre les messages et leurs libellés. Niveau, origine et « Non lues seulement » se combinent. Marquer comme lu, tout marquer, retirer un message et effacer l’historique ne touchent ni fichiers ni opérations. Ouvrir le centre ne marque pas automatiquement ses messages lus. Une répétition récente remet un message lu dans les non lus.

Voir les détails rejoint le panneau correspondant : projet, Git, terminal, agent ou CPC, ou les paramètres. Une session projet différente désactive l’accès et explique pourquoi. Le message reste lisible. Les actions de relance, reprise, arrêt et restauration appartiennent aux panneaux et conservent leurs garde-fous. Rejoindre un panneau masqué par Concentration restitue la disposition précédant ce mode.

Paramètres → Notifications propose Tous les messages, Erreurs seulement ou Aucun aperçu. Ces réglages agissent sur l’aperçu dans une bande dédiée au bas de l’atelier ; l’historique et le compteur restent disponibles. Masquer l’aperçu conserve le message non lu. Les paramètres s’appliquent seulement après Appliquer ; Annuler conserve le réglage courant. Le choix persiste et voyage avec les profils portables. Les profils 0.32 sans ce champ utilisent le défaut ; une ancienne application peut refuser un profil enrichi par une version ultérieure.

## Couverture et confidentialité

Le registre reçoit les retours de l’atelier sur les sources, les opérations du panneau Git et de synchronisation, le démarrage/résultat/arrêt du terminal, les transitions de mission IA, des erreurs IA et la préparation/exécution CPC. Il n’est pas une copie de tous les dialogues et journaux techniques.

Le terminal publie uniquement son état et code de sortie. Les missions publient leur état, nombre de fichiers modifiés et tokens, sans objectif, réponse ni événements d’outils. Git/IA/CPC utilisent un résumé générique pour les erreurs ; le détail reste dans sa vue. Les chaînes de l’atelier sont limitées à 1 200 caractères, rendues en texte et filtrées pour les URL et formats de credentials reconnaissables. Aucun export, envoi réseau, stockage localStorage ou écriture disque du registre. Un filtre lexical ne reconnaît pas tout secret arbitraire.

Le redémarrage et une nouvelle fenêtre commencent sans historique de notifications. Les versions de sources, checkpoints, journaux disque et missions conservent leurs règles propres. L’aperçu ne force pas le focus et ne se ferme pas automatiquement pendant la lecture ; le dialogue se manipule au clavier et rend le focus à l’éditeur. Les modèles Monaco et l’undo ne sont pas recréés.

## Vérification et suite

234 tests Node passent localement, dont sept tests du registre : répétition et lecture immuable, rétention et séparation des contextes, masquage/bornes, filtres combinés, cible d’une autre session, profils portables et migration de keymap conflictuelle. Typage strict et builds renderer/main exécutés. La recette navigateur complète passe localement sans erreur, y compris fenêtres 729 × 720 et 420 × 650, sessions Git périmées et résumés de mission sans contenu privé. La recette navigateur et la recette Electron de personnalisation/redémarrage incluent cloche/menu/keymap, filtres/lecture/effacement, aperçus, navigation CPC/paramètres et préservation de l’éditeur/undo. Les résultats effectivement exécutés sont consignés dans la PR.

Un journal de tâches durable et unifié, toutes les erreurs de dialogues, annulation depuis le centre, progression détaillée, notifications système, lecteur d’écran et qualification macOS restent ouverts. Les arrêts Git, terminal et agent existants restent disponibles dans leurs panneaux. Les réglages par projet et fenêtres système indépendantes suivent dans le lot 7.
