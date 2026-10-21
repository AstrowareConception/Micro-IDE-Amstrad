# Conversation agent et pièces jointes — alpha 0.41.33

Le panneau ouvert à droite privilégie l’échange : historique au-dessus, **Message à l’agent** en bas. L’en-tête propose nouvelle conversation, historique et réglages. Les fonctionnalités existantes restent accessibles à la demande. Décision : [ADR 0084](../adr/0084-conversation-agent-progressive.md).

## Parcours principal

1. Ouvrir le projet, puis configurer la clé et le modèle dans **Réglages IA** si nécessaire.
2. Écrire la demande ; **Joindre des fichiers** permet de sélectionner le contexte ou **Importer un fichier…**.
3. Cliquer **Envoyer**, ou Ctrl+Entrée / Cmd+Entrée. Entrée seule ajoute une ligne.
4. Pendant le travail, le même champ permet **Envoyer la précision** ; le bouton d’arrêt reste disponible.
5. Après le résultat, écrire une retouche : les échanges précédents, les outils et le checkpoint initial sont conservés. Une pause de budget propose une reprise, avec ou sans nouvelle consigne.
6. Ouvrir **Changements** pour les comparaisons, **Détails de la mission** pour les rapports et le journal, ou restaurer le checkpoint initial.

Les réponses utilisent le lecteur Markdown existant, sans exécuter de HTML ni charger de ressources distantes. Les erreurs d’envoi conservent le brouillon. Une précision reçue pendant la dernière réponse provoque un nouveau tour, ou reste dans le contexte si le budget impose une pause.

## Pièces jointes et permissions

Texte, Markdown, PNG, JPEG et PDF sont importés par le dialogue natif. Annuler ne modifie ni projet ni message. Un import réussi sélectionne le document ; aucune requête IA n’est déclenchée. Les limites existantes restent applicables : dix documents, 1 Mio par fichier, 4 Mio au total et vingt pages PDF.

Les documents Consultables/Essentiels apparaissent dans le contexte automatique ; un document Exclu ne peut pas être forcé par sélection. Les documents historiques peuvent être sélectionnés individuellement ; l’autorisation globale antérieure reste dans les options avancées. Les métadonnées autorisées sont transmises, puis les outils lisent les contenus selon la politique existante. Les extraits essentiels suivent leur règle antérieure.

Le contexte documentaire est fixé au premier envoi. Une nouvelle conversation permet de changer les pièces jointes. Le bouton de lecture donne accès à **Connaissances** pour inspecter et classer les fichiers.

## Fonctionnalités conservées

**Outils et modèles de mission** contient bibliothèque de missions, retour au texte précédent et amélioration de lisibilité. Les rapports de renommage, formatage, commentaires, découpage, chargement, extraction et tests CPC restent dans **Détails de la mission**, ainsi que les limites, tokens, coût estimé et journal. Les comparaisons de sources et documents restent accessibles dans **Changements**. Les paramètres de connexion, catalogue, modèle, prix et budget restent dans **Réglages IA**.

## Continuité et limites

Une retouche reprend la même tâche et les messages fournisseur, sans élargissement de droits. La révision du manifeste, les buffers et le projet doivent correspondre au dernier état connu. Une modification externe, une restauration, un arrêt définitif ou un changement de clé peut imposer une nouvelle conversation. Chaque continuation réaccorde le budget affiché ; les consommations restent cumulées. Dix reprises/retouches maximum, contexte borné à 512 Kio.

L’historique conserve huit conversations en lecture seule pendant la session et pour le projet courant. Il n’est pas une sauvegarde durable ni un mécanisme de reprise après fermeture. Le checkpoint restauré est celui du début de la conversation et couvre ses retouches.

## Vérification

Les tests de contrôleur et de boucle couvrent sélection des documents, conservation du contexte, révisions divergentes, reprise avec consigne, précision tardive et invalidation après restauration. La recette `tests/agent-conversation-desktop.mjs` vérifie l’import, l’envoi, une précision, une retouche créant une vraie source, sa restauration et le compositeur en fenêtre étroite. Elle produit les captures `out/agent-conversation-desktop.png`, `out/agent-context-desktop.png` et `out/agent-conversation-narrow.png` dans les artefacts CI. Le fournisseur est simulé ; les opérations sur le projet sont réelles.
