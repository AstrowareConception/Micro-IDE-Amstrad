# ADR 0016 — PDF texte borné et extraction dans un thread dédié

Date : 2026-10-04. Statut : acceptée pour l'alpha 0.11. Complète les ADR 0013/0014 sans migration du manifeste v1, qui décrit déjà les PDF dans son JSON Schema.

## Décision

Utiliser `pdfjs-dist` **6.4.299**, Apache-2.0, version exacte et intégrités npm verrouillées. Le build legacy fonctionne dans un thread Node `worker_threads`, créé pour une extraction puis terminé. PDF.js n'est importé ni par le main ni par le renderer. Le port `PdfExtractor` reçoit des octets vérifiés ; le domaine valide les pages et leurs budgets, sans dépendance technique.

La tranche alpha prend le texte uniquement : 1 Mio/original, 20 pages, 64 Kio de texte UTF-8/page et 256 Kio/document, 15 s/extraction. Les quotas communs restent 4 Mio/10 documents. Le thread dispose de limites V8 (128 Mio old generation, 16 Mio young, pile 4 Mio), d'un AbortSignal et d'un timeout ; il est terminé sur succès ou échec. Ces limites ne sont pas un plafond de RSS, de buffers externes ou d'allocations natives.

PDF.js reçoit uniquement `data`, jamais URL, chemin, mot de passe ou secret. Le worker n'hérite ni des variables d'environnement ni des arguments Node du main. Extraction streamée par page, rendu/font-face/fonts système/WASM désactivés, fetch externe rejeté et `BinaryDataFactory` locale de refus. Aucun appel aux scripts, annotations, formulaires, liens ou pièces incorporées. Les diagnostics du thread sont drainés sans entrer dans les logs applicatifs. Un PDF chiffré est refusé ; une page sans texte est annoncée comme non inspectée visuellement, pas comme vide ou comprise.

Le cache d'extraction est local à la session, indexé par SHA-256, plafonné à dix entrées. Chaque lecture relit et vérifie les octets avant de réutiliser le cache ; vues clonées pour ne pas altérer la provenance. Aucun texte dérivé persisté dans le manifeste, aucune pièce jointe dans le DSK. L'agent autorisé peut lire une page/plage via `documents_read_pdf_page` ; le contexte initial et la liste restent des métadonnées. Recherche PDF porte page et ligne.

## Écart de conception et limites

Le document 04 envisageait un Web Worker sans Node pour tous les traitements PDF. Cette tranche accepte un thread Node côté hôte pour valider l'original avant publication de sa copie et réutiliser exactement le même adaptateur dans Node/Electron. **Ce thread n'est pas un sandbox ni une isolation de crash de processus.** Une vulnérabilité du parser ou d'une dépendance reste un risque ; processus utilitaire avec confinement qualifié et renderer worker pour le rendu sont à étudier avant élargissement des budgets. Le main garde ses droits, mais le code de parsing n'y est pas exécuté directement.

L'API d'extraction est annulable et testée ; l'UI possède le timeout mais pas encore de bouton d'annulation d'extraction. Un projet de plusieurs PDF peut demander plusieurs extractions successives à sa réouverture. Ni la récupération après crash ni ACC-24 ne sont qualifiées par ces limites. Colonnes/tableaux peuvent être désordonnés, polices/CMaps externes non fournis refusés ou extraction partielle selon PDF.js, texte hors page susceptible d'être omis. Ne pas confondre texte extrait et transcription exhaustive.

Pas de rendu de page, OCR, mot de passe ponctuel ou qualification Windows/macOS. J4-02 reste partiel. La dépendance optionnelle canvas du build Node est dans le lock et son inventaire ; elle n'est pas utilisée pour rendre les documents. L'application garde la clé OpenAI en mémoire main et le scope documentaire désactivé par défaut.

## Références

[API PDF.js](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), source et licence du paquet verrouillé ; [Node worker_threads](https://nodejs.org/api/worker_threads.html). Les limites et choix d'isolation ci-dessus sont des décisions de cette alpha, pas une garantie de sécurité absolue des bibliothèques.
