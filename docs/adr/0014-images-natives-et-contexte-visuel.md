# ADR 0014 — Images natives et contexte visuel

Date : 2026-10-04. Statut : acceptée pour l'alpha 0.10. Complète l'ADR 0013 sans modifier le contrat de projet v1.

## Décision

Étendre les documents du projet aux PNG/JPEG, avec les limites de copie existantes : 1 Mio par original, 4 Mio et 10 documents par projet. Le domaine vérifie signature, dimensions et structure avant le décodage natif : PNG standard 8 bits, CRC des chunks, fin complète, animation refusée ; JPEG 8 bits gris/RGB baseline ou progressif, segments bornés, frame unique et fin complète. Maximum 4 000 000 pixels et 4096 pixels par côté. Une extension seule ne suffit pas.

Utiliser `nativeImage` d'Electron, déjà dépendance fixée de l'application : PNG/JPEG sont documentés sur toutes les plateformes. Aucune nouvelle bibliothèque ni moteur Markdown/HTML n'est ajouté. Le décodeur est injecté dans le store hôte ; les domaines et tests de stockage restent indépendants d'Electron. Les tests de ce port ne prouvent pas le décodage ; celui-ci est exercé par le parcours natif Electron.

Après décodage, recréer une image à partir des pixels, puis produire un aperçu PNG conservant le ratio et la transparence. Maximum 512 pixels par côté et 128 Kio ; une réduction supplémentaire peut être nécessaire pour tenir le budget. Original, EXIF et autres métadonnées ne sont jamais utilisés comme payload UI/IA. L'orientation EXIF est ignorée dans cette tranche, conformément aux limites natives ; la vue le signale. Le hash de provenance porte sur l'original, pas sur le PNG dérivé.

L'outil `documents_inspect_image` exige un ID autorisé au lancement et renvoie aperçu plus provenance. Le runner transforme ce résultat typé en contenu `input_text` + `input_image` de `function_call_output`, selon le contrat Responses. Ce résultat est rejouable par `callId` sans redécoder ni muter. Aucun aperçu n'est envoyé dans le contexte initial ou dans `documents_list`. Le consentement documentaire commun, désactivé par défaut et lié à la session de projet, couvre textes et images avec disclosure explicite. Le modèle doit accepter les entrées vision ; l'accès réel reste à tester volontairement.

## Limites et suite

Le décodage natif reste dans le main avec une garde préalable de taille/dimensions ; il n'est pas isolé dans un worker ni doté d'un timeout interrompant le codec natif. Ces garde-fous ne sont pas une qualification contre toute vulnérabilité du codec. Extraction lourde/PDF et budgets plus élevés exigeront isolation et annulation. Pas de traitement EXIF, WebP, PNG animé/16 bits, JPEG CMYK, OCR qualifié ou conversion écran CPC dans cette tranche. Le document 08 conserve ces objectifs MVP ; J4/J5 ne sont pas clôturés. Les essais CI Linux ne qualifient pas Windows/macOS ni la vision distante réelle.

## Références primaires

- [Electron nativeImage](https://www.electronjs.org/docs/latest/api/native-image) : formats, décodage, bitmap, resize/PNG et limite EXIF.
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) : sortie de fonction image/fichier sous forme de tableau de contenus.
