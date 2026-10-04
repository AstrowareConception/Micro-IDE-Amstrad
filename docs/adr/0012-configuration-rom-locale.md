# ADR 0012 — Configuration ROM locale avant qualification moteur

Date : 2026-10-04. Statut : acceptée pour l'alpha 0.7. Complète les ADR 0007/0009 ; ne remplace pas le go/no-go de l'ADR 0003.

Réaliser l'import et la persistance locale des trois ROM séparées OS/BASIC/AMSDOS avant le worker desktop. Cette préparation appartient à J1-04 et peut être testée avec des fixtures synthétiques originales sans lancer de firmware CPC. La taille exacte de 16 384 octets et une empreinte correcte ne qualifient ni le rôle déclaré ni le dialecte.

Le main possède un `FirmwareStore` sous le profil utilisateur. Le renderer ne dispose que de status/importRom(role)/clear, sans chemins ni octets. La sélection passe par le dialogue natif. Les objets sont immuables, nommés par SHA-256 ; la configuration versionnée ne contient que profil et rôles/empreintes. Les ROM restent hors projet, checkpoint IA et export DSK. Le futur adaptateur charge des copies revalidées depuis le main.

Chaque jeu est expérimental, même complet. Aucun bouton RUN ni outil agent d'exécution n'est introduit. L'import combiné, reconnaissance des types/langues, liste de ROM qualifiées, migration, suppression du cache, reprise après panne électrique et verrou interprocessus restent à construire. Retirer la sélection conserve les objets locaux. Une configuration invalide n'est pas réinitialisée silencieusement ; une ROM corrompue n'est pas écrasée sous son hash.

La recette firmware et la relecture dans Caprice32 restent nécessaires avant intégration de l'exécution. La demande produit autorise cette préparation indépendante ; elle ne transforme pas un essai synthétique en preuve de boot BASIC.
