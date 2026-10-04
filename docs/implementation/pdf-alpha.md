# Documents PDF texte — alpha 0.11

Date : 2026-10-04. [ADR 0016](../adr/0016-pdf-texte-borne.md). Tranche indépendante J4-01/02/J5, après TXT/MD et PNG/JPEG. OpenAI réel et firmware restent reportés à la demande produit.

## Utilisation

Dans un projet desktop, **Importer PDF** sélectionne un original local. Signature et décodage sont vérifiés avant publication de sa copie dans `documents/` et ajout du manifeste. Nom original, type `application/pdf`, rôle et SHA-256 sont conservés. Original externe et brouillons BASIC restent inchangés. La simple extension `.pdf` ne suffit pas. L'ouverture d'un projet contenant un PDF exige un adaptateur d'extraction ; ce format ne retombe pas silencieusement sur un décodage UTF-8.

Cliquer son nom affiche le texte extrait de la première page, en lecture seule ; **Page suivante/précédente** et navigation par 200 lignes parcourent le contenu. Texte inerte dans une textarea, aucun viewer PDF actif. Une page sans texte affiche « Aucun texte extractible sur cette page ; contenu visuel non inspecté ». Cela couvre notamment les PDF image sans OCR, mais ne classe pas automatiquement chaque page blanche comme scan.

Limites de cette alpha : 1 Mio/original, 4 Mio et dix documents/projet toutes catégories, 20 pages/PDF, 64 Kio de texte UTF-8/page et 256 Kio/PDF. Dépassement : refus, sans copie invalide publiée ni réduction silencieuse des pages. PDF chiffré refusé, aucun mot de passe demandé/stocké/transmis. PDF.js peut réparer certaines structures ; ce n'est pas un validateur exhaustif de la norme PDF.

L'extraction reproduit l'ordre textuel PDF.js, ajoute une fin de ligne aux items `hasEOL`, sépare les autres par espace et normalise les contrôles. Provenance `pdfjs-text-v1` liée à la version 6.4.299 verrouillée ; cet identifiant changera si l'algorithme change. Colonnes/tableaux, encodages rares et textes hors page peuvent être incomplets ou désordonnés. Les ressources externes sont désactivées. L'aperçu montre ce que l'agent peut lire, pas une transcription certifiée du PDF.

## Agent et confidentialité

Le même consentement documentaire, désactivé par défaut et réinitialisé avec la session, autorise la lecture PDF. Au lancement, seuls ID/nom/type/hash/taille sont fournis. `documents_list` ajoute nombre de pages et présence de texte par page, sans le texte. `documents_read_pdf_page` prend `{id, page, startLine, endLine}` : page 1-based, 1–200 lignes et 16 384 caractères maximum, provenance et troncature annoncées. Page/ID absent, non-PDF ou hors scope : refus. Une ligne trop longue exige une plage plus courte ; cette alpha ne dispose pas de pagination par caractères.

`documents_search` étend la recherche littérale aux pages PDF, avec page/ligne et les bornes communes de 30 extraits de 500 caractères. Toute recherche autorisée peut transmettre les extraits trouvés sur plusieurs pages ; une lecture ciblée ne transmet pas les autres pages implicitement. Les données documentaires ne donnent aucun droit de shell, Git, ROM ou publication et ne remplacent pas le corpus BASIC. Le PDF original ne quitte pas le projet via ces outils et n'est jamais placé sur le DSK. Le journal privé peut contenir les extraits réellement lus, pas une inclusion automatique de toutes les pages.

## Isolation et vérification

PDF.js legacy s'exécute dans un thread dédié, pas dans le main ou le renderer. Le traitement est interrompu après 15 s ; l'adaptateur accepte aussi AbortSignal. Limites V8, sorties de diagnostics non propagées et lectures externes refusées. Le thread n'est **pas** un sandbox OS, et 128 Mio de heap ne sont pas une borne totale de mémoire ; voir ADR 0016. Pas de bouton d'annulation PDF dans l'UI à cette étape. Le cache par hash évite les extractions répétées pendant la mission, mais les octets sont revérifiés à chaque lecture. Il est détruit avec la session et plafonné à dix résultats.

**71 tests Node** incluent cinq scénarios PDF : vrai parseur sur pages/textes/blanc/actions inertes, garde de chiffrement synthétique/corruption/quotas, timeout/annulation/validation des résultats, import/cache/portabilité/empreintes/exclusion DSK, outils bornés/scope/recherche et transmission progressive via transport OpenAI contrôlé. La fixture chiffrée teste la barrière `PasswordException`, pas le déchiffrement d'un fichier utilisateur. Fixtures originales générées en TypeScript avec objets et offsets exacts, sans PDF tiers ni personnel commis. Le PDF de recette simple a été rendu avec Poppler et inspecté visuellement en complément du texte extrait ; cette vérification ne qualifie pas un viewer de l'IDE.

Typecheck, tests, build desktop, contrôle documentaire/schémas et parcours Chromium exécutés localement. Le parcours Electron en CI garde le sandbox renderer, importe via dialogue natif, utilise le worker compilé réel, navigue les pages, refuse un PDF corrompu sans modifier le manifeste, puis demande seulement une ligne de page 1 dans une mission à fournisseur contrôlé, vérifie l'absence de page privée non lue et la réouverture du projet. Capture `out/pdf-alpha.png` dans les artefacts CI ; réussite effective consignée dans la PR, pas déduite de la présence du test.

Pas de rendu visuel PDF, OCR, mot de passe, conversion CPC ou nouvelle qualification ROM/vision distante. Windows/macOS, PDF complexes/colonnes/fonts et récupération restent à éprouver ; J4/J5/MVP ne sont pas clôturés. Prochaine tranche planifiée : **JG-A, Git local** (découverte, confiance, statut/diff/index/commits), conformément au document 16 ; rendu PDF et conversion CPC restent au backlog.
