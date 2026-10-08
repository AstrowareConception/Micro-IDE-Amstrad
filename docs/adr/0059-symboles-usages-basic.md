# ADR 0059 — Index textuel des symboles et usages BASIC

- Date : 2026-10-08
- Statut : accepté pour l’alpha 0.41.0
- Périmètre : première tranche d’IDE-015 ; IDE-017 non réalisé

## Contexte

L’éditeur connaît les cibles de lignes et propose des noms en complétion, mais ne fournit pas de liste navigable des occurrences. Une recherche textuelle ne distingue pas commentaires, chaînes, DATA, tableaux et variables. Les changements de type DEFINT/DEFREAL/DEFSTR rendent prématurée une fusion générale des noms sans suffixe avec les noms explicitement typés.

## Décision

Créer un domaine TypeScript pur `symbols.ts`, un worker jetable et un panneau à la demande accessible par BASIC, palette et onglet Symboles. Chaque source reste indépendante, même lorsque deux buffers emploient le même nom. Le périmètre comprend les buffers non enregistrés et les onglets fermés dont le buffer reste chargé.

L’identité est textuelle : casse ignorée, suffixe conservé, scalaire et tableau séparés. Le type d’un nom sans suffixe demeure non résolu. Ainsi A et A! peuvent être des alias à l’exécution mais restent deux entrées. Aucun lien de définition, preuve d’initialisation, diagnostic de variable inutilisée ou renommage sémantique ne découle de cet index.

Les rôles syntaxiques sont lecture, écriture, lecture/écriture pour NEXT nommé, dimensionnement et suppression. Les indices sont lus indépendamment de l’accès au tableau. FOR fournit l’écriture initiale du compteur ; NEXT sans variable ne fabrique pas d’occurrence absente du texte. Les frontières THEN/ELSE/deux-points servent à identifier les segments, sans analyse des chemins d’exécution. Chaînes, DATA et commentaires sont protégés par le lexer existant.

Les portées FN, adresses, appels machine/RSX, MID$ en écriture, INPUT avec flux et commandes non couvertes sont omis avec raison. Les déclarations de type sont signalées et leurs plages alphabétiques ne deviennent pas des variables. Les noms de plus de 40 caractères et segments mal formés reconnus sont omis. Cet outil n’est pas un validateur syntaxique complet.

## Ressources et durabilité

Pas de calcul à la frappe, de réseau, de disque, d’IA ou de collecte des valeurs runtime. Worker arrêté après résultat, annulation, erreur, remplacement du projet ou délai de 15 secondes ; réponses tardives ignorées. Snapshot en mémoire avec comparaison des sources et noms avant navigation. Modification du texte désactive les liens ; exports obsolètes marqués. Le panneau reste monté lorsqu’il est masqué pour conserver le snapshot, sans nouveau calcul.

Bornes : 100 sources / 4 Mio de caractères au total ; 1 Mio, 10 000 lignes, 8192 caractères par ligne, 2048 tokens par ligne et 4096 symboles par source. 20 000 occurrences par source et 50 000 occurrences inspectées au total ; profondeur de parenthèses 64 ; 100 raisons affichées avec compteur du surplus. Un dépassement de symboles/occurrences retire l’index entier de la source ; les occurrences déjà inspectées restent débitées du budget global. Lignes/segments omis restent explicitement partiels. UI : 200 symboles filtrés et 200 occurrences sélectionnées maximum.

Rapport indépendant version 1 : sources, états, raisons, symboles et occurrences localisées. Exports JSON/Markdown contenant les noms de variables et de sources, sans code ni valeurs ; cette différence avec l’export Qualité est indiquée dans le panneau. Aucun changement du rapport Qualité ni de ses garanties de confidentialité.

## Validation et suite

Tests de domaine sur rôles, identités, exclusions, locations UTF-16, limites et exports. Parcours Chromium : vrai worker à la demande, filtres, sources indépendantes, onglet fermé réouvert, obsolescence, annulation/réponse tardive, panne, délai et remplacement du projet. Dix assertions firmware confirment les cas de casse, suffixes, défaut réel/entier/chaîne, tableau/scalaire, READ, noms longs, ERASE et exemple. Moteur intégré avec jeu CPC 6128 anglais identifié ; pas de qualification matérielle ou émulateur indépendant supplémentaire.

Suite : résolution des types et portées, fonctions DEF FN, accès depuis le symbole sous le curseur, puis renommage avec aperçu et gardes. Les exclusions de l’analyse de flux restent au backlog ; IDE-015 reste partiel et IDE-017 non réalisé.
