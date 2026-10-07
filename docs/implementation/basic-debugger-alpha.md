# Alpha 0.38 — Debugger BASIC réel

## Portée

CPCéleste exploite le hook d’exécution CPC qualifié en alpha 0.35 pour proposer un premier debugger Locomotive BASIC réellement relié au firmware :

- points d’arrêt par numéro de ligne ;
- pas vers le prochain statement BASIC ;
- continuer jusqu’au prochain point d’arrêt ;
- affichage de la ligne réellement exécutée ;
- pointeurs de ligne et de statement ;
- ticks émulés au moment exact de l’arrêt ;
- inspection Z80 et RAM disponible pendant l’arrêt.

Le debugger n’est activé que pour le profil CPC 6128 / BASIC 1.1 dont les trois ROM ont déjà été qualifiées par hash.

## Sécurité et fidélité

Le renderer ne calcule jamais lui-même la ligne supposée. Le worker arme le hook machine `&DE60`, puis lit le pointeur de ligne depuis `&AE1D` et le pointeur de statement depuis HL lorsque le firmware atteint réellement cette frontière.

Les points d’arrêt sont limités à 64 lignes entre 1 et 65535. Un budget de ticks borne chaque recherche afin qu’une hypothèse de firmware ou un programme atypique ne monopolise pas le worker.

Un firmware inconnu reçoit une capacité debugger désactivée ; aucune compatibilité n’est extrapolée.

## Ce qui reste ouvert

- décodage des variables scalaires BASIC ;
- chaînes et tableaux ;
- pile GOSUB/RETURN ;
- Step Over / Step Out ;
- breakpoints conditionnels et watchpoints ;
- gutter de breakpoints dans Monaco ;
- association fiable du numéro de ligne au fichier après CHAIN/MERGE ;
- qualification d’autres ROM et modèles CPC.

Ces éléments restent rattachés à IDE-054 et ne seront déclarés livrés qu’après preuve sur machine instrumentée.
