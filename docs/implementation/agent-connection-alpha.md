# Connexion IA réessayable et ouverture au démarrage — 0.41.32

Le panneau **Agent IA** est ouvert et ancré à droite à chaque démarrage, même s’il était masqué ou détaché lors de la fermeture précédente. Il reste possible de le fermer, de le détacher ou d’utiliser le mode Concentration pendant la session. Les dispositions des autres panneaux sont conservées.

Dans **Réglages IA**, coller la clé et choisir **Configurer la clé**. Les espaces extérieurs sont retirés. La clé est mémorisée uniquement dans le processus principal pour la session ; le champ est effacé après cette prise en compte. Le chargement des modèles est une opération distincte : un échec réseau ne fait plus perdre la clé.

- **Clé mémorisée · connexion à vérifier** : la clé a été conservée mais l’accès au catalogue n’a pas encore réussi. **Actualiser les modèles** permet de réessayer sans recoller la clé ; **Oublier la clé** reste disponible.
- **Connexion vérifiée** : le catalogue a été obtenu. Choisir explicitement un modèle avant de lancer une mission. Mémoriser la clé ne valide ni les droits sur un modèle ni la disponibilité du service Responses.
- Une clé refusée (401), des permissions insuffisantes pour la liste (403), un quota, un problème de DNS, de proxy, de certificat ou de délai produisent un diagnostic sans reprendre le contenu de la réponse fournisseur ni un secret.

Les requêtes de l’agent utilisent maintenant le transport natif Chromium d’Electron, avec sa prise en charge du proxy système. Les contrôles TLS restent actifs ; aucun contournement des certificats ou des erreurs d’authentification n’est ajouté. Référence technique : [API net d’Electron](https://www.electronjs.org/docs/latest/api/net/).

La clé n’est jamais enregistrée dans les préférences ou le projet. Elle est oubliée à la fermeture de l’application. La connexion n’est pas relancée automatiquement après un premier échec ; le bouton explicite permet de choisir quand réessayer. Les essais vérifient ce parcours avec des réponses contrôlées, sans clé réelle ni appel facturable. Une connexion réussie sur le poste utilisateur reste à constater sur son réseau.

[ADR 0083](../adr/0083-connexion-agent-reessayable.md).
