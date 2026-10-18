# ADR 0077 — Conditions simples dans le découpage terminal

- Statut : accepté
- Date : 2026-10-18
- Incrément : 0.41.27

## Contexte

Le profil v2 couvre expressions et affichage sur un chemin séquentiel. L’élargissement aux conditions doit conserver les garde-fous d’application et contrôler les deux branches, sans déduire une qualification universelle de quelques programmes témoins.

## Décision

Ajouter un profil distinct `terminal-conditions-chain-merge-v3`, sélectionné lorsqu’un IF est présent. Admettre une comparaison de deux expressions de même type, un THEN et un ELSE facultatif, avec une seule instruction v2 par branche. Refuser imbrications, sauts conditionnels, séparateurs et formes dynamiques. MEMORY reste en tête, le GOTO terminal et END restent sous contrôle structurel.

Partager le validateur fermé des expressions et des instructions primitives avec v2. Pour chaque IF, dupliquer chaque état d’entrée et contrôler les deux branches. Sans ELSE, conserver l’état inchangé comme seconde issue. Ne pas éliminer les branches constantes : les chemins conservés portent les contrôles d’initialisation, de type et de bornes jusqu’à la fin. Six IF limitent cette exploration à 64 chemins. Ce choix conservateur peut refuser des programmes sûrs en pratique ; il ne prétend pas calculer l’atteignabilité exacte.

Conserver l’aperçu immuable, le journal et la restauration durable existants. Exiger la consultation de IF avant application. Aligner l’instruction modèle, la description d’outil et le profil visible. Qualifier huit témoins sur les vrais DSK original/appliqué-rouvert/restauré-rouvert, plus deux références littérales d’affichage ; étendre le parcours Electron sans remplacer les recettes v1/v2.

## Conséquences

Les six comparateurs sont éprouvés dans les deux sens sur entiers et chaînes, de part et d’autre du chargement. Les tests négatifs couvrent les branches ignorées, les initialisations partielles, dépassements différés et limites de chemins. Aucun protocole de mutation supplémentaire ni droit hôte n’est ajouté. Boucles, IF imbriqués, fonctions et ressources restent à qualifier. Voir le [contrat et les preuves](../implementation/basic-multifile-conditions-alpha.md).
