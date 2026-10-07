# ADR 0045 — Debugger BASIC ancré sur un firmware qualifié

## Statut

Accepté pour l’alpha 0.38.

## Contexte

L’inspection CPC 0.35 a qualifié sur un jeu précis de ROM CPC 6128 / Locomotive BASIC 1.1 un point de passage réel de l’interpréteur à l’adresse `&DE60`. À cet instant, `&AE1D` permet de retrouver le pointeur de ligne BASIC et le registre HL le pointeur du statement en cours. La recette native et WASM démontre que les deux moteurs observent les mêmes lignes et pointeurs.

Un debugger de façade qui déduirait l’exécution à partir du texte source serait trompeur : les branchements, GOSUB, interruptions et commandes directes sont exécutés par le firmware réel.

## Décision

L’alpha 0.38 arme le hook machine existant sur `&DE60`, uniquement lorsque les hashes des trois ROM correspondent exactement au profil déjà qualifié. Le worker peut alors :

- s’arrêter sur le prochain statement BASIC ;
- continuer en instrumentant les passages suivants ;
- comparer le numéro de ligne réellement observé à une liste bornée de points d’arrêt ;
- exposer le numéro de ligne, le pointeur de ligne, le pointeur de statement et les ticks réels ;
- conserver l’inspection Z80/RAM existante pendant l’arrêt.

Pour tout autre firmware, le debugger est explicitement indisponible. L’émulation elle-même reste utilisable.

## Limites assumées

Cette étape ne décode pas encore les variables BASIC, les tableaux, chaînes, temporisateurs ni la pile logique GOSUB/RETURN. Elle ne prétend pas non plus identifier le fichier source lorsqu’un programme charge ou chaîne plusieurs listings partageant des numéros de ligne.

Un point d’arrêt est donc un numéro de ligne BASIC exécuté, pas encore une position sémantique multifichier.

## Conséquences

Le debugger devient une capacité instrumentée du CPC réel et non une simulation de l’IDE. L’extension aux variables et à la pile exigera une qualification mémoire dédiée et des recettes firmware supplémentaires. Les autres versions de BASIC ne seront activées qu’après preuve équivalente.
