# Codec CPCBasicTS intégré

Source : [benchmarko/CPCBasicTS](https://github.com/benchmarko/CPCBasicTS), commit figé `af6384d1e065fcf051b5666edce5c9ece9bd44fb`, licence MIT de Marco Vieth (texte dans LICENSE et dans `licenses/cpcbasic.txt`, inclus au packaging).

Quatre modules conservés : lexer, parser, générateur tokenisé, détokeniseur. Interfaces et Utils réduits aux éléments utilisés ; aucun émulateur, ROM, réseau, évaluation dynamique ou dépendance de l'application CPCBasicTS embarqué. Les imports deviennent relatifs `.ts`, et les imports de types explicites. Le code tiers conserve ses conventions avec `@ts-nocheck` ; la frontière publique `src/basic-codec.ts` est en TypeScript strict et valide les tailles, lignes, tokens, noms terminés, extensions et caractères avant décodage.

Deux corrections locales du détokeniseur : signe des constantes flottantes réellement négatives, et lecture littérale des données après DATA jusqu'au séparateur non cité. Les pointeurs mémoire ne sont pas décodés avec une origine supposée. Les glyphes/contrôles CPC non représentables en ASCII restent dans les originaux et provoquent un refus explicite de conversion.

Les tables XOR SAVE P sont reprises de `DiskImage.unOrProtectData` du même commit, avec remise à zéro modulo 128. Ce mécanisme est une protection historique réversible, pas une primitive de chiffrement.
