# Tests CPC liés aux sources réelles — 0.41.16

Une suite BASIC autonome peut réussir sur une **copie** d'une routine sans exécuter la source métier que l'agent a modifiée. Le contrôle de provenance 0.41.16 distingue désormais ces cas.

## Vérification

Pour chaque source BASIC modifiée ou créée pendant une mission, CPCéleste rapproche les essais du véritable **ID de fichier**, de son **chemin**, de son **SHA-256** et du **résultat CPC** du même listing. Une source est directement testée si une suite entière a réussi sur ce contenu exact de la révision courante et que sa définition n'est pas périmée.

Le panneau Agent IA énumère les fichiers modifiés, les essais finaux réussis et, si la même suite avait été jouée initialement sur le fichier d'origine, cette référence avant modification. Les essais sous un autre ID, même sur un texte identique, ne constituent aucune preuve de couverture du fichier concerné.

**Sécurité :** si l'agent a lancé une ou plusieurs suites et que certaines sources modifiées n'ont pas été exécutées directement, la validation finale est bloquée. Les modifications et checkpoints restent conservés. Sans aucune suite exécutée, le fonctionnement historique est préservé avec la mention explicite « comportement non vérifié ».

## Parcours

1. Préparer des assertions natives `REM @CPCTEST` dans le fichier réel que l'on veut contrôler.
2. Inscrire l'ID de ce fichier dans une suite du projet.
3. Lancer cette suite avant la transformation, puis à nouveau après modification.
4. Vérifier la couverture affichée, la provenance des rapports et la construction DSK de la révision finale.

## Limites

Il n'y a **aucune concaténation ni fusion automatique** de listings : les tests restent des programmes autonomes. Le code métier dépourvu d'assertions ne devient pas automatiquement testable. Un essai dans la même suite avant/après ne démontre ni équivalence globale, ni stabilité mémoire/temps, ni conservation de toutes les attentes si elles ont été changées.

Le lot suivant visera des harnais pouvant exercer la vraie source de production non instrumentée, avec contrôles de chargement et de comportement qualifiés. Aucun ROM ni secret n'est ajouté au dépôt, aucun nouvel appel IA payant n'est nécessaire à cette vérification.
