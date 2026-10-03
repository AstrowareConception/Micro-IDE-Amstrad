# ADR 0007 — Une machine qualifiée d'abord

Statut : acceptée. Date : 2026-10-03.

## Contexte

« Amstrad » couvre plusieurs architectures et dialectes. BASIC 1.0 et 1.1 diffèrent ; disque absent sur 464 d'origine ; Plus requiert des fonctions ASIC. Le nom commercial d'une machine ne prouve ni la fidélité d'un moteur ni la compatibilité d'un programme.

## Décision

Référence initiale CPC 6128 classique, BASIC 1.1, AMSDOS, lecteur A et modes écran standard. Profils versionnés avec firmware par empreinte et capacités explicites. Les ROM sont importées séparément. Les autres machines restent candidates jusqu'à une campagne d'essai propre.

## Options considérées

Afficher immédiatement tous les modèles par un sélecteur serait simple mais trompeur. Un profil générique « CPC compatible » masquerait mémoire, BASIC et disque. Recréer un interpréteur libre éviterait certaines dépendances firmware mais ne fournirait pas automatiquement le comportement de la ROM ni du matériel.

## Conséquences

Un moteur pouvant initialiser 464 ne suffit pas à offrir 464+DDI-1. Le 664 n'est pas considéré identique au 6128 ; un profil devra choisir RAM, ROM et périphériques effectivement implémentés. Plus, PCW et PC-1512 sont hors MVP. Les essais matériels sont distingués des essais émulateur. Les conditions de distribution du firmware sont vérifiées indépendamment de celles du code de l'IDE.

Révision : une priorité utilisateur peut avancer un autre modèle, mais exige les mêmes profils, preuves et limites, et ne change pas discrètement l'autorité d'exécution.
