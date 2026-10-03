# ADR 0004 — Listing ASCII et disquette AMSDOS DATA

Statut : acceptée. Date : 2026-10-03.

## Contexte

L'utilisateur demande une programmation directe en Locomotive BASIC et un export DSK. Le BASIC de la ROM interprète des programmes tokenisés, mais sait charger un listing ASCII. Construire immédiatement un compilateur Z80 n'est ni nécessaire ni équivalent au besoin.

## Décision

Conserver des sources numérotées UTF-8. Encoder un listing CPC ASCII valide et sans en-tête AMSDOS, puis l'insérer dans un DSK standard au format DATA. Utiliser `RUN"MAIN.BAS"` pour le lancement. Qualifier fin de ligne, EOF et conventions de fichiers par ROM. Ajouter tokenisation et import natif après le MVP.

## Options considérées

La tokenisation initiale réduit la taille disque et améliore l'import historique, mais implique nombres réels, variables, références et variantes ROM. Elle est différée pour concentrer J0 sur le chemin réel. Un export snapshot est pratique mais ne remplace pas un disque contenant programme et données. Un export BASIC seulement ne remplit pas le besoin DSK.

## Conséquences

Construire des codecs CP/M/AMSDOS et DSK correctement, y compris allocations et extents. La capacité disque est distincte de la taille du fichier conteneur. L'IDE explique les limites mémoire, noms 8.3 et encodage. Aucun autostart universel ou boot CP/M promis sur un disque DATA. La disquette est reproductible à outils et entrées identiques.

Révision : le futur codec tokenisé doit conserver la source lisible et se qualifier contre la ROM ; il ne remplace pas rétroactivement le format des projets existants.
