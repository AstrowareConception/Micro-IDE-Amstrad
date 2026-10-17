# Simulation de transaction de découpage BASIC — alpha 0.41.24

**Évolution 0.41.26 :** un [profil distinct pour expressions, chaînes et affichage](basic-multifile-expressions-alpha.md) complète le profil initial décrit dans ce rapport historique. Le protocole de journal et de restauration est conservé.

**Évolution 0.41.25 :** la simulation pure reste sans écriture. L’agent dispose désormais d’une [application séparée, journalisée et réversible](basic-multifile-apply-alpha.md). Les absences d’application mentionnées ci-dessous décrivent la livraison historique 0.41.24.


## Profil livré : extraction terminale contrôlée

Le moteur pur `previewTerminalExtraction` simule la séparation d'un listing Locomotive BASIC autonome en deux fichiers. Il accepte **uniquement** un GOTO littéral unique, situé juste avant une région finale contiguë qui se termine par un END. La région ne peut contenir que des affectations entières simples et des POKE vers les adresses de test `&8000` à `&8003`. Les instructions du programme principal sont limitées à MEMORY &7FFF, aux affectations simples et aux mêmes POKE. Ce profil très étroit sert d'étape de preuve et n'est pas une opération de refactorisation générale.

La simulation remplace le GOTO par `CHAIN MERGE "PART.BAS",100`, retire le suffixe correspondant du listing principal et le présente comme contenu d'un nouveau fichier source déclaré par un **manifeste candidat non persisté**. Un nom CPC 8.3 valide est requis ; collision, GOSUB, RETURN, IF, DATA, ON, variables calculées, ressources, multiples fichiers et autres formes de flux sont refusés.

## Règles de transaction

L'outil agent `language_extraction_simulate` nécessite l'identifiant et le SHA-256 exacts de la source courante, le numéro de ligne d'entrée et le nom du nouveau fichier. Il travaille sur une copie du manifeste et des buffers ; il n'appelle aucune méthode d'écriture. Le service construit puis relit deux disquettes standard AMSDOS : **l'originale et la candidate**. Les empreintes SHA-256 des sources et des DSK figurent dans le rapport.

Le panneau Agent IA montre l'ancien listing, le principal envisagé et le fichier supplémentaire, avec les tests structurels et les avertissements. Dès que le projet change, l'aperçu devient périmé. Les états `applicationEnabled=false`, `persistentWrites=0` et `rollback=no-write-required` décrivent le contrat : **il n'existe volontairement aucun outil d'application de cette simulation**. L'étape suivante devra développer une persistance transactionnelle globale avec contrôle de révision, rollback et essais avant/après sur les vrais fichiers.

## Qualification ROM de référence

Le script `scripts/qualify-basic-multifile-dry-run.mjs` exécute exactement les deux DSK calculés par le simulateur dans le moteur CPC WASM équipé des ROM OS/BASIC 1.1/AMSDOS externes et validées par SHA-256. Les résultats sont les trois marqueurs mémoire `&8000`, `&8001`, `&8002`. Pour le profil témoin, les deux versions doivent produire **[11,42,24]**. Les disques, les listings et le moteur sont identifiés par leurs empreintes ; aucune ROM n'est publiée.

La recette est bloquante dans GitHub Actions Linux. Une réussite établit uniquement le comportement de **ce témoin** avec **cette ROM**, et n'autorise pas à déplacer une routine quelconque d'un jeu. La conservation de l'état des autres branches, tableaux, DATA, graphismes, piles GOSUB, interruptions, timing ou séquences multi-écrans reste hors profil.

## Après 0.41.24

La prochaine livraison devra spécifier le protocole de commit atomique : vérification du SHA-256 de chaque source et du manifeste, écritures par fichiers temporaires, restauration à la moindre erreur, bascule du manifeste seulement après la réussite de tous les fichiers et vérification post-écriture. Ce dispositif restera fermé aux codes non qualifiés et nécessitera de nouveaux essais réels sur CPC pour chaque classe de transformation.
