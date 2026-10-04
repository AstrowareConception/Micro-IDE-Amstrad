# Images du projet et contexte visuel — alpha 0.10

Date : 2026-10-04. [ADR 0014](../adr/0014-images-natives-et-contexte-visuel.md). Suite des [documents texte 0.9](documents-alpha.md), contribution partielle à J4-01/J5. Les essais OpenAI réels et firmware restent reportés à la demande produit.

## Utilisation

Ouvrir un projet desktop. Dans **Documents du projet**, choisir **Importer image PNG / JPEG**, puis un fichier local. Les copies restent dans `documents/`, avec nom original, type, rôle et SHA-256 dans le manifeste v1. L'original extérieur et les brouillons BASIC sont préservés. Les pièces jointes restent exclues du DSK ; importer une image ne produit pas un écran CPC.

Cliquer le nom importé pour afficher taille et aperçu. Les limites de cette alpha sont 1 Mio par fichier, 4 Mio et 10 documents par projet, toutes catégories confondues ; 4 000 000 pixels et 4096 pixels par côté pour les images. PNG 8 bits standard non animé, JPEG 8 bits gris/RGB baseline ou progressif. PNG 16 bits/animé, JPEG CMYK, WebP, SVG et PDF sont refusés sans publication de copie invalide. Les images de formats acceptés mais non décodables sont également refusées.

L'aperçu est un PNG régénéré depuis les pixels, sans métadonnées originales. Maximum 512 pixels par côté et 128 Kio, avec réduction supplémentaire si nécessaire ; ratio et transparence conservés. Il sert à concevoir, pas à certifier les pixels d'une ressource CPC. L'orientation EXIF n'est pas appliquée et la légende l'annonce ; une photographie peut donc être tournée par rapport à son affichage dans une galerie. L'original copié reste inchangé. Aucun fichier hôte, lien distant ou image active n'est chargé dans le renderer ; celui-ci reçoit uniquement un data URL du PNG dérivé sous sa CSP existante.

## Agent

Cocher **Autoriser les documents du projet pour cette mission**, puis demander par exemple : « Consulte l'image de titre et propose un écran BASIC en MODE 1 inspiré de sa composition. Analyse puis construis le DSK. » La transmission concerne les aperçus demandés par l'agent, avec noms/empreintes et provenance. La liste initiale ne contient ni original ni pixels ; `documents_list` contient seulement métadonnées et dimensions. L'accès documentaire reste désactivé par défaut et revient à zéro à l'ouverture d'un projet.

`documents_inspect_image` prend un ID autorisé ; sa sortie porte dimensions originales/aperçu, nom, hash original, extraction `native-pixels-png-v1`, orientation ignorée et statut `untrusted-document-data`. Le runner renvoie un contenu image réel (`input_image`, détail `low`) avec son texte de provenance, et non une chaîne JSON qui prétendrait donner accès à l'image. Le replay du même `callId` conserve ce résultat sans nouvelle exécution. La recherche texte ignore les images ; lire une image comme texte est refusé avec indication de l'outil adapté.

Un modèle Responses compatible vision est nécessaire. Configuration/erreurs/budgets restent ceux de l'[agent](agent-alpha.md) : contexte maximal de 512 K caractères, pas de retry facturable automatique. Plusieurs images et extraits peuvent atteindre ce budget ; le runner s'arrête alors avant une nouvelle requête. Une vue réduite ne garantit pas la lecture de petits textes ni une interprétation exacte ; aucun OCR qualifié n'est revendiqué. L'agent ne peut convertir automatiquement l'original en SCR, inspecter ses métadonnées, ouvrir une URL ni élargir ses droits depuis un texte visible dans l'image. L'original et l'aperçu ne sont pas copiés dans les checkpoints de sources ; un bilan peut toutefois citer ce qu'il a observé dans le journal privé.

## Vérification et limites

**66 tests** couvrent la chaîne existante et quatre scénarios d'images : structure/CRC/animation/dimensions, JPEG borné, contrat et portabilité/exclusion DSK/conflits, scope et résultats multimodaux avec replay. Les tests Node utilisent un port image contrôlé pour le stockage, pas un faux décodeur présenté comme qualification réelle. PNG de test original généré par code ; aucune image tierce ou personnelle commise.

Typecheck, build desktop, documentation/schémas et parcours Chromium exécutés localement. Le parcours Electron en CI non root, sandbox activée, utilise le vrai décodeur sur PNG et JPEG, contrôle dimensions, nettoyage des métadonnées, refus de pixels compressés corrompus, préservation du manifeste, puis exécute la mission à transport Responses contrôlé et vérifie la présence effective de `input_image` avec provenance. Sa réussite effective figure dans la PR et les workflows ; `out/images-alpha.png` est ajouté aux captures temporaires. Cette simulation ne contacte pas OpenAI et ne prouve pas une analyse visuelle distante réelle.

Le codec natif est borné par la taille/structure/dimensions avant appel, mais reste dans le main, sans worker isolé ni timeout interrompant le décodage. Le succès Linux ne qualifie pas Windows/macOS. Original absent/altéré, symlink ou extension incohérente bloquent ouverture/lecture/mutation selon les gardes 0.9. Pas de crash recovery qualifié ni conversion CPC ajoutés.

Prochaines tranches : PDF avec extraction bornée et isolation, puis conversion écran CPC déterministe. WebP et orientation EXIF demandent un adaptateur explicitement éprouvé. L'émulation intégrée reste soumise à la qualification J0.
