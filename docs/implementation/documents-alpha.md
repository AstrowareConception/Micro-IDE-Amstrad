# Documents texte et contexte agent — alpha 0.9

Date : 2026-10-04. [ADR 0013](../adr/0013-documents-texte-incrementaux.md). Première contribution à J4-01 et aux outils documentaires J5 ; aucun jalon global clôturé. Les essais ROM et OpenAI réels restent différés à la demande produit.

## Utilisation

Ouvrir/créer un projet desktop puis **Importer TXT / Markdown** dans **Documents du projet**. Choisir un fichier UTF-8 de 1 Mio maximum. Jusqu'à 10 documents et 4 Mio par projet. L'import ajoute une copie et ses métadonnées au manifeste sans enregistrer les brouillons BASIC. L'original extérieur n'est jamais modifié ; changer ce fichier après import ne change pas la copie.

Cliquer un nom pour consulter le texte en lecture seule, avec type, taille effective, rôle et SHA-256 de l'original. L'aperçu montre 200 lignes à la fois avec navigation. Markdown, HTML éventuel et liens sont montrés comme texte, sans parser actif, script, navigation ou requête distante. BOM et CRLF sont conservés dans les octets originaux ; leur normalisation concerne uniquement la vue extraite. UTF-8 invalide, contrôles binaires/NUL, autre extension, liens symboliques ou dépassements de quotas sont refusés sans publication d'un document invalide.

Pour utiliser les documents dans une mission, cocher **Autoriser les documents du projet pour cette mission** avant **Lancer l'agent**. Cette option est désactivée par défaut et réinitialisée à l'ouverture d'un projet. Le scope couvre toutes les pièces jointes déclarées au lancement, pas les fichiers arbitraires présents dans le dossier. Les noms/empreintes sont transmis dans le contexte initial ; les textes arrivent uniquement en résultats d'outils. Le budget d'historique de l'agent peut arrêter une mission avant la lecture exhaustive d'un document volumineux. Sans cette autorisation, la liste documentaire modèle est vide et les lectures refusées, même si l'ID est deviné.

## Outils et provenance

| Outil | Résultat |
| --- | --- |
| `documents_list` | Métadonnées, taille en octets, nombre de lignes ; aucun texte complet |
| `documents_read_text` | ID autorisé, intervalle 1–200 lignes, maximum 16 384 caractères, lignes totales et troncature annoncée |
| `documents_search` | Recherche littérale insensible à la casse ; maximum 30 extraits de 500 caractères, total et troncature annoncée |

Les résultats citent ID, nom original, SHA-256 des octets originaux et ligne. La lecture identifie la vue `utf8-lf-v1`. Les textes sont étiquetés `untrusted-document-data` : une instruction contenue dans un document ne peut pas ajouter un outil, ouvrir un lien, lire un secret ni autoriser le shell. La consultation d'un document utilisateur ne remplace pas les fiches de référence Locomotive BASIC.

L'agent ne peut modifier les documents. Son checkpoint local contient les métadonnées du manifeste et IDs autorisés, sans recopier les textes documentaires dans les snapshots de fichiers ; un bilan public de l'agent peut néanmoins citer un extrait et entrer dans le journal privé. Les résultats d'outils restent dans l'historique en mémoire. Clé et ROM restent hors scope. Les documents sont exclus du DSK, lequel continue de contenir uniquement les listings BASIC indépendants.

## Intégrité et durabilité

À l'ouverture du projet, à la lecture et avant une mutation agent, la copie est contrôlée contre le hash déclaré. Une corruption ou absence refuse l'opération avec indication de conflit ; ne pas éditer manuellement le manifeste pour contourner cette protection. L'import est un ajout ; remplacement/suppression UI restent à réaliser. Copier/déplacer le dossier complet conserve les documents et leur identité.

Une restauration après ajout d'un document au projet est refusée avant écriture afin de conserver la nouvelle pièce jointe. Les sources et brouillons suivent les gardes de l'[agent 0.6](agent-alpha.md). Les originaux ne sont pas inclus dans un export DSK ni ajoutés automatiquement à Git. Partager le dossier projet partage ses copies documentaires : choisir explicitement ce qui est diffusé. La publication atomique du manifeste ne constitue pas une transaction durable après panne électrique ; un crash peut laisser une copie non déclarée à examiner. Pas de recovery automatique, chiffrement ou export de projet partagé qualifié dans cette tranche.

## Vérification

Typecheck, construction desktop, contrôle documentation/schémas, parcours d'édition Chromium et **62 tests** passent localement. Huit tests documentaires couvrent contrat, octets BOM/CRLF, portabilité, exclusion DSK, formats/encodages/liens/quotas, altération, conflit de restauration, lectures bornées, scope et transmission progressive contrôlée. Le transport de test ne contacte pas OpenAI et n'utilise aucune clé réelle.

Le parcours `npm run test:desktop` couvre le vrai main/preload/UI : import natif, brouillon conservé, texte Markdown inerte, original extérieur modifié, scope explicite, outils documentaires par transport Responses contrôlé, construction sans pièces jointes, checkpoint et réouverture. Il est exécuté sur le runner CI non root avec sandbox Electron activée ; la PR et les workflows donnent le statut effectif. `out/documents-alpha.png` complète les captures temporaires de CI. L'environnement local root sans Xvfb ne qualifie pas ce parcours natif.

Suite : aperçu/import d'images et extraction PDF bornée, puis conversion écran CPC ; sélection documentaire fine et reprise durable des missions. L'exécution CPC attend toujours le go firmware J0. Aucune vision, extraction PDF, compatibilité d'une autre machine ou génération OpenAI réelle n'est revendiquée ici.
