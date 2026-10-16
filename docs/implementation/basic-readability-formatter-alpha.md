# Lisibilité BASIC : formatage contrôlé et revue documentaire — alpha 0.41.18

## Objectif

Dans l’agent IA, un travail de lisibilité peut désormais employer les outils à la demande \`language_readability_review\`, \`language_format_preview\` et \`language_format_apply\`. Ce premier incrément **ne remplace pas le parseur CPC par un formateur générique** et ne promet pas de rendre lisibles tous les listings anciens sans étude.

### Audit de qualité et pistes de commentaires

\`language_readability_review\` calcule les métriques et constats du moteur de qualité BASIC existant sur le vrai buffer du projet : longueurs, segments, complexité lexicale estimée, diagnostics de flux et omissions de l’analyse. Il propose des **points d’attention** pour un commentaire — contrats de sous-programmes, invariants de boucles, dépendances, effets machine et hypothèses à expliquer — à partir des constats localisés.

Ces recommandations sont des pistes de rédaction à vérifier contre le programme et les références. **Aucun commentaire n’est inséré automatiquement par le moteur de qualité** : l’IA peut les rédiger dans une note Markdown via les outils documentaires existants ou suggérer un changement soumis aux garde-fous habituels. Elle ne doit pas attribuer aux instructions une intention métier imaginaire.

### Mise en forme déterministe, conservatrice

\`language_format_preview\` construit un plan sans modifier la source et expose les lignes avant/après, les refus, les avertissements, la provenance SHA-256 et les métriques de qualité avant/après.

Le profil initial n’uniformise que les espaces horizontaux entre tokens et autour des séparateurs d’instructions, ainsi que l’espace après un numéro de ligne, **sur des lignes lexicalement simples**. Les chaînes, commentaires, DATA, formes FN et branches/structures de contrôle ou instructions à effets sensibles ne sont pas réécrites. Un contrôle des tokens préserve leur séquence et leur texte ; le listing complet avant/après est vérifié par le codec BASIC existant.

Un plan ne peut être appliqué par \`language_format_apply\` que pour le fichier et le SHA-256 initial exact, dans le même état de projet et avec le même identifiant de prévisualisation. L’application passe par les opérations mutatives habituelles de l’agent, avec consultations de références et checkpoint initial de mission. Les plans devenus périmés sont refusés. Les fichiers CRLF sont provisoirement refusés par ce parcours agent, qui normalise les fins de ligne lors des écritures.

### Bilan utilisateur

Le panneau **Lisibilité du code — aperçu et bilan** affiche les plans préparés, appliqués et périmés, leurs extraits avant/après, les lignes transformées/ignorées, la longueur maximale/moyenne des lignes et la complexité lexicale estimée. Les extraits sont limités à 4 096 caractères par version, les éditions enregistrées suivent les mêmes règles de restauration que les autres mutations d’une mission.

Un résultat de qualité plus favorable ne prouve pas que le programme a conservé son comportement. Les programmes doivent être reconstruits en DSK, puis testés sur le CPC avec les sources réellement modifiées (contrôle de provenance 0.41.16). Les différences de mémoire, de durée d’exécution et les interactions dynamiques doivent être documentées.

## Limites et suite

Le formateur n’effectue pas encore d’indentation de blocs IF/THEN/ELSE — Locomotive BASIC utilise souvent plusieurs instructions par ligne —, ni de séparation automatique de lignes, ni de refactorisation multifichier. Aucun commentaire n’est introduit sans révision de son contenu. Il n’existe pas encore de circuit d’approbation humaine spécifique à chaque transformation, ni de preuve universelle sur les ROM autres que le profil de test qualifié.

Prochains incréments : enrichir les profils lexicaux avec des témoins firmware avant/après, concevoir l’insertion de commentaires structurés avec vérification des effets et numéros de ligne, puis bâtir une stratégie de découpage compatible avec les opérations \`CHAIN\`, \`MERGE\` et le stockage DSK.
