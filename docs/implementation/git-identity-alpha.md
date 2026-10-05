# Identité Git mémorisée — alpha 0.23

## Utilisation

Ouvrir un projet puis **Actualiser Git**. Si un profil d’identité a été mémorisé, le panneau préremplit nom et email. Sans profil, saisir ces valeurs pour le commit courant suffit : aucun enregistrement implicite.

- **Mémoriser cette identité** conserve seulement nom/email pour les projets et redémarrages suivants de CPCéleste.
- **Charger l’identité mémorisée** remplace les champs nom/email par le profil lu. Le message de commit reste intact ; l’aperçu de commit est invalidé si l’identité est chargée.
- **Oublier l’identité mémorisée** retire les valeurs du profil. Les champs du commit courant restent inchangés ; un nouveau panneau démarre sans identité mémorisée.

Le nom/email finalement utilisés restent affichés dans l’aperçu et la confirmation native du commit. Modifier la saisie ne modifie pas le profil sans action Mémoriser. Aucune importation de configuration Git système/globale, aucune modification de `.git/config`, aucun message de commit mémorisé.

## Conflits et données invalides

Le profil possède une révision opaque. Si ses octets changent depuis leur lecture, Mémoriser/Oublier sont refusés et les données externes restent intactes ; utiliser Charger avant une nouvelle décision. Un profil inconnu, corrompu, trop volumineux ou lié est conservé et bloque uniquement sa mémorisation/son oubli, pas la saisie d’identité et les commits courants. Les erreurs n’affichent pas de chemin hôte ni de données de profil.

L’écriture est indépendante des buffers BASIC dirty et ne les sauvegarde pas. Session périmée, mission/terminal actif ou autre opération disque bloquent les routes. Les boutons sont désactivés pendant la requête ; le panneau est propre à la session projet.

## Stockage et limites

Profil privé d’application `userData/git-profile/identity.json`, record v1 exact `{version:1,id:UUID,identity:null|{name,email}}`. Nom non vide de 100 caractères maximum, email 254, contrôles et propriétés inconnues refusés ; nom normalisé sans espaces périphériques. UTF-8 sans BOM, 4 Kio maximum, fichier ordinaire sans liens/hardlinks. Révision SHA-256 ; chaque publication a un UUID neuf. L’oubli publie une identité null, sans supprimer le record de révision. Droits Linux dossier 0700/fichier 0600 et remplacement synchronisé.

Nom et email sont en clair dans le profil privé ; Oublier n’est pas un effacement physique et ne modifie pas l’historique Git. Pas de profil distinct par dépôt, synchronisation des préférences ou chiffrement. Le contrôle de révision ne constitue pas un verrou entre processus : une écriture externe après le dernier contrôle reste possible. Une publication non confirmée impose de recharger avant répétition. Temporaire possible après interruption ; pas de nettoyage automatique d’un contenu inconnu. Panne électrique, Windows/macOS et FS réseau restent non qualifiés.

## Vérification

152 tests Node réussis, dont six nouveaux tests du profil : opt-in/relecture après nouvelle instance, permissions/contenu borné, mises à jour et oubli protégés par révision, validation stricte, profils corrompus/futurs, liens/hardlinks et erreurs sans chemin hôte. Les tests Git de 0.22 restent exécutés avec la validation commune.

La recette Electron ajoute profil opt-in avec buffers dirty, rechargement sans modifier le message, conflit externe, arrêt SIGKILL puis redémarrage et chargement, oubli/réouverture et refus de session périmée. Les octets du dépôt et le nombre de commits restent inchangés. Son exécution et la capture `git-identity-alpha.png` sont attestées dans la PR de l’incrément ; aucun firmware réel n’est qualifié par ces essais.

[ADR 0028](../adr/0028-profil-prive-identite-git.md). IDE-033/R3/JG-A/ACC-31 restent partiels. Prochain lot : liste et création de branches locales, avant bascule/rechargement et synchronisation réseau.
