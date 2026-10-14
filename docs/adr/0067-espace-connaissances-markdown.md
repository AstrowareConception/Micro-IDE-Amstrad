# ADR 0067 — Espace Connaissances et lecture Markdown

Date : 14 octobre 2026. Statut : accepté pour 0.41.9.

## Décision

Faire évoluer Documents du projet vers Connaissances : quatre catégories, recherche par titre, notes Markdown créées depuis des modèles et lecteur au centre de l’atelier. Les références importées conservent leurs octets ; une copie Markdown explicite devient modifiable. Lecture, source et vue partagée utilisent le même brouillon. Le code BASIC reste monté et ses buffers sont conservés.

Le rendu repose sur react-markdown 10.1.0 et remark-gfm 4.0.1, MIT, versions figées. React rend les nœuds : aucun HTML brut exécuté, aucun chargement automatique d’image externe, aucune navigation privilégiée depuis le Markdown. Liens locaux limités aux documents déclarés ; les destinations externes sont affichées pour copie. Titres, emphases, listes imbriquées/tâches, citations, tables et code clôturé sont pris en charge. Mermaid/LaTeX/HTML enrichi et coloration des blocs ne sont pas interprétés.

Les notes éditables sont limitées à 64 Kio. Une sauvegarde crée une nouvelle version `.md` ordinaire sous documents/, puis publie le manifeste ; les fichiers antérieurs ne sont pas écrasés. Dix versions précédentes sont référencées pour restauration ; les versions plus anciennes et une éventuelle version non publiée après arrêt restent sur disque, sans collecte automatique. Ce choix privilégie la conservation, sans prétendre à une transaction multi-fenêtres ou à une durabilité universelle après panne matérielle. Les chemins et empreintes sont contrôlés ; une révision périmée refuse l’écriture et conserve le brouillon.

Le manifeste v1 reçoit une extension optionnelle `knowledge` par document : catégorie, caractère modifiable, accès IA et versions précédentes. Les anciens projets gardent leur comportement d’autorisation par mission. Les nouvelles notes sont consultables à chaque mission ; les imports restent soumis à l’ancien consentement tant que leur réglage n’est pas enregistré. Exclu l’emporte toujours sur ce consentement. Essentiel est réservé au texte : 4 000 caractères par document et 12 000 au total dans le contexte initial, avec troncature déclarée et outils de lecture de la suite.

L’agent BASIC et l’agent Z80 consultent les documents autorisés. Aucun texte documentaire ne peut élargir ses outils. L’écriture documentaire automatique de l’agent reste un lot ultérieur : elle exige son propre checkpoint et une restauration cohérente du code et des documents. Les outils de cette tranche lisent seulement la documentation ; les éditions humaines passent par le port dédié, bloqué pendant une mission active.

## Vérification et suite

Tests du store réel (versions, quotas, conflits, intégrité, déplacement, exclusion DSK), contexte réel du contrôleur avec fournisseur simulé, parcours navigateur et régression native des imports. Captures de démonstration sans contenu utilisateur. Étendre ensuite génération/révision documentaire par l’agent, recherche plein texte humaine, onglets multiples et maintenance des versions archivées.
