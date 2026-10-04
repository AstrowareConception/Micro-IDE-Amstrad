# 08 — Ressources, images et documents

L'[alpha 0.9](../implementation/documents-alpha.md) réalise le sous-ensemble TXT/MD UTF-8 : copies immuables vérifiées, aperçu source texte et accès progressif de l'agent explicitement autorisé. Les limites alpha sont 1 Mio par fichier, 4 Mio et 10 documents par projet, selon l'[ADR 0013](../adr/0013-documents-texte-incrementaux.md). Les limites et formats MVP ci-dessous restent des objectifs ; images, PDF et conversion ne sont pas encore réalisés.

## Trois rôles explicites

Une pièce jointe de contexte aide à concevoir : cahier des charges, extrait de manuel, image d'inspiration. Une source est éditable et participe à un programme. Une ressource CPC est un fichier encodé et inclus au plan disque. Le même original peut alimenter le contexte et une recette de conversion, sans que ces usages se confondent.

L'import copie le fichier dans le projet par défaut, calcule son empreinte et conserve nom d'origine, type détecté, taille et rôle. Les liens externes sont une extension : le MVP favorise un dossier déplaçable. Les octets originaux sont immuables ; changer une recette crée un nouveau résultat. La simple extension ne décide pas du parser utilisé.

## Matrice d'import MVP

| Format | Aperçu local | Utilisation IA | Inclusion CPC |
| --- | --- | --- | --- |
| TXT | Texte, encodage à confirmer | Extraits choisis | Seulement après conversion explicite en données CPC |
| MD | Markdown sûr et source | Texte ou sections choisies | Pas de rendu web sur CPC ; texte converti si souhaité |
| PNG/JPEG/WebP | Image décodée et dimensions | Vision si modèle compatible | Conversion en écran CPC ou ressource ultérieure |
| PDF | Pages rendues, texte et sélection | Texte extrait ou images de pages | Jamais le PDF original au MVP |
| BIN/SCR | Métadonnées et aperçu selon recette | Description ou capture choisie | Adresse et en-tête contrôlés |
| BAS | Listing et diagnostics | Source choisie | ASCII ; tokenisé dans la suite |

GIF animé, SVG actif, archives récursives, DOCX, OCR automatique et médias audio/vidéo sont hors MVP. Les fichiers non pris en charge peuvent rester dans le dossier de l'utilisateur, sans être ouverts par un parser privilégié.

## Limites et traitement

Valeurs initiales de garde, à mesurer à J4 : 20 Mo par pièce jointe, 100 Mo d'originaux copiés par lot, 20 mégapixels par image, 200 pages par PDF. L'analyse d'une demande IA utilise au plus 10 pièces, 20 pages choisies et un budget de contexte propre au modèle. Les limites fournisseur plus faibles priment. L'application donne un message et une sélection possible ; elle ne coupe pas des octets en produisant un fichier invalide.

La taille décodée est contrôlée en plus de la taille compressée. Les PDF chiffrés demandent un mot de passe local ponctuel ou sont refusés ; le mot de passe n'est ni stocké ni transmis à l'IA. Liens, scripts, formulaires et pièces incorporées au PDF ne sont pas exécutés. Extraction et rendu sont annulables avec timeout et quotas mémoire ; les erreurs sont isolées du projet.

L'extraction textuelle peut être mal ordonnée pour colonnes et tableaux. L'aperçu montre le texte effectivement transmis, son numéro de page et sa source. Un PDF sans texte extractible propose un mode visuel explicite ; aucune « compréhension » n'est revendiquée si ni texte ni page n'ont été transmis. Les citations locales restent des repères document/page/extrait, pas des garanties de vérité.

## Écrans CPC

| Mode | Pixels visibles standard | Encres simultanées | Colonnes texte usuelles |
| --- | --- | --- | --- |
| 0 | 160 × 200 | 16 | 20 |
| 1 | 320 × 200 | 4 | 40 |
| 2 | 640 × 200 | 2 | 80 |

Le système de coordonnées graphiques BASIC est distinct des pixels physiques. La conversion cible un écran standard, sans overscan ni changement de palette par ligne. Le CPC classique dispose d'une palette matérielle fixe de 27 couleurs ; la recette utilise leurs indices BASIC qualifiés et une représentation RGB versionnée pour l'aperçu, sans promettre que chaque moniteur physique aura le même rendu.

Pipeline : appliquer orientation, convertir alpha sur un fond choisi, cadrer ou adapter sans déformation par défaut, redimensionner, quantifier sur la palette CPC, tramer éventuellement, indexer les encres, empaqueter les pixels, disposer les octets en mémoire écran puis produire l'en-tête binaire. Chaque étape porte paramètres et version. Les métadonnées EXIF ne sont pas envoyées avec l'image de contexte nettoyée par défaut.

Le MVP choisit un algorithme de palette déterministe, avec tie-break fixe et palette verrouillable. Tramage proposé : aucun ou Floyd–Steinberg avec parcours fixé ; tout futur algorithme change l'identifiant de recette. Le résultat stocke la palette réelle utilisée. Une nouvelle quantification ne remplace pas silencieusement les INK déjà insérés dans un listing : une proposition de mise à jour est présentée.

Le fichier écran standard occupe 16 384 octets. Les octets visibles sont disposés selon les lignes entrelacées, pas comme un bitmap linéaire 160×200 ; les zones non utilisées sont remplies de façon déterministe. Les mappings de bits des modes et offsets sont qualifiés avec mires unitaires et captures externes. L'adresse par défaut est `&C000`, avec `MODE`, `INK` et `LOAD"IMAGE.SCR",&C000` proposés. La mémoire et l'écran peuvent être reconfigurés par un programme avancé : la recette standard n'en déduit pas sa compatibilité automatiquement.

## Encodage des textes

Le source reste UTF-8. Les sorties CPC doivent distinguer ASCII commun, caractères CPC et chaînes de contrôle. Un « é » Unicode n'est pas copié comme ses deux octets UTF-8 dans un listing. Pour une sortie non représentable, l'utilisateur choisit un remplacement explicite, un `CHR$` qualifié ou un jeu SYMBOL avec son coût mémoire. Les données et messages ne sont pas traduits implicitement.

Une conversion de texte de contexte en données CPC conserve un rapport des caractères remplacés, délimiteurs, longueurs de chaînes et encodage. Les fichiers texte OPENIN ont leur convention de ligne et fin de fichier. Les chaînes imprimant des contrôles VDU peuvent avoir des effets visibles ; l'éditeur les montre sans les exécuter dans l'UI.

## Gestion des recettes et mémoire

Une recette associe `sourcePath`, `sourceHash`, `converterVersion`, mode, palette, crop, dimensions et destination. Le build vérifie que la ressource générée correspond encore à la recette et à l'original. Une sortie périmée est reconstruite ou signale sa cause ; elle n'est pas incluse parce que son nom ressemble au fichier attendu.

Une région binaire est décrite par adresse et longueur. La somme doit rester dans la plage 16 bits ; chevauchements entre ressources sont signalés. L'outil n'ajoute pas une réservation MEMORY sans connaître l'usage du programme. Les écrans à `&C000`, les caractères SYMBOL et les banques supplémentaires demandent des politiques différentes. Les sprites, tilemaps, polices spécialisées, compression et musique tracker restent des extensions à concevoir après l'écran standard.

## Provenance et export

Les originaux et le contenu textuel d'un PDF ne sont pas contenus dans le DSK. Le projet partagé peut inclure les originaux choisis, mais son export montre ce qu'il contient ; un paquet public n'intègre pas implicitement documents personnels ou conversations. La provenance de conversion est conservée avec la ressource. Les droits sur une image ou un document importé ne sont pas remplacés par la licence de l'IDE.
