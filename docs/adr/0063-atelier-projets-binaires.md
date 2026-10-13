# ADR 0063 — Projets binaires et copies assembleur persistantes

- Date : 13 octobre 2026
- Statut : accepté
- Suite : [ADR 0062](0062-recuperation-distribution-basic.md)

## Décision

Étendre le projet existant avec `kind: binary`, aucune source BASIC et une entrée parmi les ressources immuables. Ne pas créer de faux chargeur BASIC ni un second système de projets. Les projets BASIC sans discriminant restent compatibles. Le lancement automatique exige un en-tête AMSDOS binaire valide et une entrée dans sa charge utile ; une entrée non qualifiée reste analysable mais non exécutable automatiquement.

Conserver les régions et listings dans `binary-z80.json`, avec empreinte du fichier original, offset, origine, type code/données et notes utilisateur. Les fichiers du projet restent les références immuables. La sauvegarde atomique utilise une révision optimiste et refuse les fichiers spéciaux/symlinks, les empreintes périmées, les chevauchements et les dépassements. Les brouillons peuvent être sauvegardés même si l'assembleur les refuse.

Utiliser un assembleur local borné sans dépendance ni shell : dialecte explicite, ORG unique, labels, DEFB et instructions qualifiées par aller-retour. Les formes fixes proviennent du décodeur ; les immédiats/indexations/branches sont encodés localement. Les encodages dont l'identité ne peut être conservée en instruction restent des octets DEFB. Cette dépendance interdit de présenter le round-trip comme une validation indépendante du sens des opcodes.

Appliquer les éditions uniquement à des copies, avec origine et taille inchangées. Les plages non classées, headers, paddings et autres ressources restent identiques. Le bouton Tester utilise une révision enregistrée contrôlée et une session CPC neuve ; F5 continue à utiliser les ressources originales. La modification permanente des ressources, la relocalisation automatique et les suggestions IA ne font pas partie de cette tranche.

## Qualification et suite

[Guide et preuves](../implementation/binary-workbench-alpha.md) : encodages connus, parcours de stockage/UI, exécution native d'une modification observable 77 → 78 et chargeur réel réassemblé à l'identique. Les parties complètes, autre émulateur, assembleur indépendant exhaustif et sources mixtes restent ouverts. Les lots Z80-B/D restent partiels ; aucune récupération universelle du source historique ni reconstruction BASIC depuis un binaire n'est promise.
