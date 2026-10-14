# ADR 0065 — Extraire les fichiers des variantes DSK historiques qualifiées

- Statut : acceptée pour le correctif 0.41.7.
- Complète [0062](0062-recuperation-distribution-basic.md).

## Contexte

L’image Fer & Flamme fournie possède un système DATA lisible mais des descripteurs ST1=&80, huit secteurs CA de 256 octets hors allocation et des noms avec `&`. Le lecteur 0.41.6 refusait successivement ces trois formes. La conversion de tous les BASIC en ASCII excède par ailleurs la capacité DATA.

## Décision

Tolérer uniquement ST1=0 ou &80 avec ST2=0. Pour Extended, autoriser neuf secteurs DATA/SYSTEM uniques de 512 octets, éventuellement un dixième CA/4A de 256 octets. Valider tous les descripteurs, y compris le secteur supplémentaire ; aucune sélection arbitraire entre doublons, aucune réparation CRC ou de secteur faible. Retrouver les secteurs logiques par ID indépendamment de l’interleave.

Conserver le DSK entier intact, extraire les fichiers ordinaires et avertir que les secteurs supplémentaires ne figurent pas dans la reconstruction. Propager les avertissements du domaine vers l’aperçu et le rapport persistant. Accepter `&` dans les noms CPC à toutes les frontières sans l’utiliser pour former un chemin hôte ou une commande shell.

Calculer la capacité du futur build ASCII selon la sélection, sans interdire la récupération de sources lorsque l’export est trop grand. Le writer DATA, son allocation, ses refus de capacité et le moteur d’émulation restent inchangés hormis l’alphabet de noms admis.

## Limites et preuves

Voir la [recette et la matrice synthétique](../implementation/recovery-protection-alpha.md#import-historique-et-diagnostic--0417). Importer un fichier ne qualifie ni l’exécution d’un jeu protégé ni la fidélité physique du disque. Pas de copie de contenu commercial dans les fixtures, pas de support universel des disquettes protégées ni des autres tailles/secteurs/utilisateurs.
