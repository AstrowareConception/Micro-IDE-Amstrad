# ADR 0062 — Récupération BASIC, ressources et distribution protégée

- Date : 13 octobre 2026
- Statut : accepté
- Suite : [ADR 0061](0061-import-dsk-ascii.md)

## Décision

Utiliser un codec local déterministe pour importer du BASIC tokenisé/protégé et produire la représentation de SAVE P. Le sous-ensemble nécessaire de CPCBasicTS est intégré sous MIT au commit `af6384d1e065fcf051b5666edce5c9ece9bd44fb` ; provenance, adaptations et licence sont conservées. Aucun appel IA ni ROM au runtime du codec. La frontière stricte refuse les structures tronquées, tokens inconnus, pointeurs mémoire sans contexte et caractères non convertibles. Le code tiers est isolé ; ses conventions TypeScript ne sont pas imposées aux domaines propres au projet.

Le lecteur d'import accepte les conteneurs standard/Extended ordinaires en DATA/SYSTEM, 40 pistes, une face, utilisateur 0. Il refuse secteurs faibles/dupliqués/manquants, statuts d'erreur et géométries inconnues. SYSTEM réserve deux pistes avant le répertoire. Le writer reste DATA standard : reconstruire un projet n'est pas cloner les secteurs ou les protections d'une disquette.

Les fichiers non sélectionnés comme sources deviennent des ressources déclarées sous `assets/`, avec nom CPC, taille et SHA-256. Le manifeste v1 accepte désormais ce sous-ensemble brut ; les anciennes versions refusent ces projets. Les originaux restent séparés sous `.microide/imports/`. Build, F5 et build de l'agent reçoivent un snapshot des ressources ; l'adaptateur vérifie leurs empreintes. L'agent ne peut pas changer leur déclaration. Les octets CP/M sont conservés, sans couper les binaires au premier CTRL-Z. Pour les listings ASCII identifiés, CTRL-Z est l'EOF logique, y compris lorsque la fin de l'enregistrement contient des résidus de mémoire du firmware.

L'export de distribution fournit trois modes : obfuscation, protégé, combiné. Il travaille sur les buffers figés et écrit un DSK externe au projet. Le renommage utilise uniquement un index complet, conserve première lettre/suffixe et refuse les collisions ; commentaires et renumérotation sont optionnels. Accès machine/mémoire/temps, programmes externes, portées FN non qualifiées et obfuscation multifichier sont refusés. Le mode protégé seul accepte plusieurs sources. Des ressources BASIC non sélectionnées bloquent la distribution pour éviter de livrer une copie claire connue.

Un décodeur Z80 pur permet de lire des plages de 16 Kio, annoter et extraire un listing documentaire. Les préfixes non documentés/ignorés et troncatures deviennent DEFB ; chaque octet est conservé. Une lecture linéaire ne distingue pas code et données. Aucun assembleur, décompilateur BASIC universel ou relocaliseur n'est ajouté. Référence : [manuel Zilog Z80](https://www.zilog.com/docs/z80/um0080.pdf).

## Conséquences et preuve

Voir le [guide de réalisation](../implementation/recovery-protection-alpha.md). Les tests firmware utilisent uniquement les ROM locales explicites du profil CPC 6128 anglais, sans les publier. La validation native dans le moteur intégré ne remplace pas une recette sur matériel ou émulateur indépendant. Les modes de distribution réduisent la lisibilité, sans garantie de confidentialité ni équivalence universelle de timings.
