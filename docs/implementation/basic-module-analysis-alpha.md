# Analyse préalable au découpage BASIC multifichier — alpha 0.41.20

## Objectif

Les renommages, la mise en forme et l'insertion REM disposent de moteurs contrôlés. En revanche, déplacer un sous-programme dans un second fichier CPC peut modifier les références GOSUB/GOTO, le comportement de DATA/RESTORE, l'état partagé, les chargements disque, la pile et le point d'entrée. CHAIN, MERGE, RUN et LOAD ne sont pas interchangeables. Cette tranche apporte donc une **étude en lecture seule** : aucun code BASIC ni manifeste n'est modifié.

## Outil et interface

L'outil agent **language_module_review** reçoit l'ID d'une source et son SHA-256 courant. Il combine le graphe de flux existant avec une inspection lexicale bornée.

Le panneau **Découpage en modules — étude uniquement** décrit :
- Les régions proposées : numéro d'entrée GOSUB, RETURN autonome éventuel, lignes physiques, extrait (1 200 caractères maximum)
- Les lignes appelantes, les noms observés dans et hors du segment et les frontières de flux
- Les blocages : absence de barrière avant le segment, saut non GOSUB vers la région, saut externe depuis la routine, graphe incomplet, absence de RETURN, entrée imbriquée ou instructions à effets opaques
- Les utilisations de CHAIN, MERGE, LOAD et RUN, avec cible littérale éventuellement reconnue dans les noms CPC des fichiers du projet
- Les omissions et limites : 65 535 caractères, 2 000 lignes physiques, 16 régions, 24 chargements

Le statut **review** signifie « à examiner », jamais « extraction sûre ». Le statut **blocked** correspond à une ou plusieurs conditions incompatibles avec un déplacement naïf. Une modification du projet après analyse marque le rapport comme périmé.

## Contraintes

Les variables communes détectées sont seulement des identifiants textuels ; ce ne sont pas des paramètres ou dépendances sémantiques prouvées. Les directives dynamiques, la mémoire, les événements, DATA/READ/RESTORE et les chargements externes demandent un protocole CPC spécifique. Les noms présents dans des chaînes ne sont pas traités comme des chargements exécutés. Aucun nouveau .BAS ni DSK n'est généré, aucune construction CPC ni IA payante n'est déclenchée par cette analyse.

Le résultat ne démontre ni l'équivalence comportementale, ni le timing, ni la conservation de mémoire ou de pile. Une extraction future devra vérifier le chargement sur firmware CPC réel, les liens interprogrammes, les variables persistantes, le budget mémoire et une restauration atomique en cas d'échec.

## Tests et reprise

Les tests automatisés couvrent régions GOSUB/RETURN, appels, état observé comme partagé, chargements nommés, entrée non qualifiée, sauts hors région, quotas, autorisation ID/hash et invalidation des rapports périmés. Vérifier la CI Specifications/J0/Desktop Windows et Linux sur le SHA final avant fusion.

Prochaine tranche : **contrat de chargement CPC et projet multifichier**, puis comparaison avant/après sur des témoins firmware et stratégie de création/restauration atomique. Aucun découpage automatique n'est livré ici.
