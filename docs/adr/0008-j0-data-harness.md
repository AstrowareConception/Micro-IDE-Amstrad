# ADR 0008 — Profil DATA séquentiel et banc J0 borné

Date : 2026-10-03. Statut : **acceptée pour le prototype** ; qualification moteur toujours conditionnelle. Complète les ADR 0003 et 0004 sans les remplacer.

## Contexte

J0 doit séparer preuve de format, transport machine et comportement firmware. Le parser DSK upstream fait certaines lectures et assertions avant des contrôles suffisants pour une entrée externe. L'export disque est absent de l'API CPC et ne peut être remplacé par une reconstruction des sources.

## Décision

Le writer `data-standard-sequential-v1` choisit un ordre physique C1–C9 stable. Le reader TypeScript résout les secteurs par ID. Allocation utilisateur 0, 40 pistes, une face, neuf secteurs de 512 octets ; géométrie et catalogue atypiques sont refusés explicitement.

Le wrapper C valide signature complète, taille exacte, pistes et descripteurs avant `cpc_insert_disc`. **Extended DSK est refusé dans J0**, même si le moteur primaire en reconnaît la signature. Son import borné relève d'un incrément ultérieur. Une entrée refusée ne remplace pas la disquette déjà montée.

L'export conserve les en-têtes/topologie de la copie montée et recopie les secteurs du lecteur mutable après vérification de leurs offsets et tailles. Reset conserve le disque ; réinitialiser une autre machine relève d'une action distincte.

Le harness ne détecte pas le prompt par un délai. Il exige une observation manuelle enregistrée, utilise les touches du cœur et collecte des mesures brutes. Les ROM de CI sont originales et synthétiques, avec une boucle `JP 0`, sans firmware Amstrad. Les preuves synthétiques ne valent pas recette BASIC.

## Conséquences

Le format possède une empreinte étalon et des tests de limites indépendants du navigateur. La qualification du moteur peut encore échouer sur ROM et usages réels. Aucun lancement de J1 n'est justifié avant les essais disque, clavier, son, temps et oracle du rapport J0. Le package minimal et la page HTML de ce jalon ne remplacent pas les workspaces et l'interface Electron/React prévus.
