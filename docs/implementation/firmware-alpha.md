# Configuration ROM locale — alpha 0.7

Date : 2026-10-04. [ADR 0012](../adr/0012-configuration-rom-locale.md). Contribution partielle à J1-04, sans clôture J0/J3.

## Utilisation

Dans l'application Electron, panneau **ROM du CPC 6128**, choisir séparément **Importer OS CPC**, **Importer BASIC 1.1** et **Importer AMSDOS**. Chaque fichier doit avoir exactement 16 384 octets. Le sélecteur est natif et les fichiers sont lus uniquement dans le main. Aucune ROM n'est téléchargée ni envoyée à OpenAI.

Le panneau affiche l'empreinte de chaque sélection et son état : non configurée, disponible, absente/corrompue. **Vérifier les ROM** relit le cache et vérifie les hashes. Une sélection valide est retrouvée au prochain démarrage. **Retirer la sélection ROM** enlève seulement les associations, pas les fichiers du cache. Annuler le dialogue ou sélectionner une taille incorrecte conserve la configuration précédente.

Tous les jeux restent **expérimentaux**, y compris complets. Le rôle est indiqué par l'utilisateur : aucun contrôle du contenu ne prouve encore qu'il s'agit d'un OS 6128, de BASIC 1.1 ou d'AMSDOS. Cette tranche ne démarre pas la machine. Le moteur reste chips/C/WASM ; [plan d'intégration](emulator-integration.md).

## Stockage et frontières

`<userData>/firmware/configuration.json` contient une version 1, le profil `cpc6128-classic-v1` et les rôles os/basic/amsdos optionnels associés à des SHA-256 hexadécimaux minuscules. Aucune propriété inconnue, version future ou chemin n'est accepté. Les objets sont sous `roms/<hash>.rom`. Aucun nom original ni chemin sélectionné n'est persisté. Le projet, le checkpoint agent et le DSK restent distincts.

Le main valide le rôle avant le dialogue, refuse fichiers/répertoires de cache symboliques, lit un descripteur borné et vérifie identité/taille. Les créations d'objets sont exclusives ; un objet déjà présent est relu et vérifié sans être remplacé. La configuration est écrite via temporaire exclusif et rename. Permissions POSIX demandées 0700/0600 ; ACL Windows héritées du profil. Ni chiffrement, ni fsync, ni garantie contre un processus hostile ayant déjà accès au profil utilisateur.

Le port renderer renvoie seulement les métadonnées. `FirmwareStore.load()` prépare des copies des octets pour le futur adaptateur, après vérification de tous les rôles ; cette méthode n'est pas exposée à l'agent ou au preload. Le navigateur d'aperçu affiche le panneau avec actions désactivées. Les opérations firmware partagent la sérialisation IPC existante et sont refusées pendant une mission agent.

## Vérifications et limites

Quatre tests dédiés couvrent contrat strict, réouverture, copies indépendantes, retrait sans suppression du cache, tailles invalides, hash corrompu/manquant, objets occupés, liens et configuration malformée conservée. Suite totale : **47 tests**. Le parcours Electron ajoute imports synthétiques, métadonnées seules, rôle illégal, rechargement UI, corruption, mauvaise taille, annulation et retrait. Le workflow `Desktop editor` produit `firmware-alpha.png` ; consulter sa réussite effective dans la PR. Les fixtures sont des suites d'octets originales, pas des ROM Amstrad redistribuées.

Les trois sources fournies de nouveau le 4 octobre ont les mêmes SHA-256 que le catalogue `initial-import-1` ; aucun nouvel import ni modification des originaux. Aucun véritable appel OpenAI, boot BASIC, OPENOUT firmware ou oracle externe n'est revendiqué. Ces recettes restent bloquées faute de clé et de jeu firmware locaux disponibles dans cet environnement.

Une interruption après création d'objet mais avant écriture de configuration peut laisser un objet non sélectionné ; l'import suivant le réutilise après contrôle. Pas de garbage collection ni effacement cache UI. En cas d'objet corrompu, sauvegarder d'abord le stockage local, puis retirer manuellement l'objet altéré avant réimport. Une configuration malformée nécessite examen manuel, elle n'est pas écrasée. Les courses avec un autre processus, les migrations et le conteneur combiné restent ouverts.
