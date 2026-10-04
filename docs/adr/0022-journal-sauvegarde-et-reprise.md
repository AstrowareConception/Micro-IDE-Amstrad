# ADR 0022 — Journal de sauvegarde globale et reprise explicite

Date : 2026-10-04. Statut : acceptée pour l’alpha 0.17 ; complète l’ADR 0021 sans fermer R2/J1-03.

## Décision

Avant les écritures d’un « Enregistrer tout » modifié, le main publie `.microide/save/pending.json`, contrat version 1 : UUID de transaction/projet, empreinte du manifeste exact, date, phase et toutes les sources avec identifiant/chemin déclaré, octets avant/après en base64 et SHA-256. Le journal est publié par temporaire exclusif, synchronisation du fichier, rename puis synchronisation du répertoire sous Linux. Chaque source modifiée utilise un temporaire synchronisé avant rename ; ses répertoires sont synchronisés après le lot et avant le marqueur terminal. Cette séparation conserve le contrat du port de compensation : l’écriture source ne peut pas signaler une erreur de sync de répertoire après son rename.

Les phases sont `pending`, `committed`, `rolled-back`. Le marqueur terminal suit la validation de toutes les sources, ou la compensation réussie et sa synchronisation. Une erreur de journal/synchronisation après publication bloque le store et conserve les versions de reprise. Le journal complet terminal reste présent et sera remplacé par le prochain lot modifié ; un no-op n’y écrit pas. Il ne constitue pas un historique de révisions.

`ProjectStore.open` refuse un journal pending. Le parcours desktop d’ouverture l’inspecte puis présente un dialogue natif : Annuler (défaut), Terminer la sauvegarde, Rétablir les anciennes versions. Le main recharge le journal et contrôle sa révision avant récupération. Le journal doit correspondre au projet/manifeste exact et toutes les sources doivent correspondre à leur empreinte avant ou après. Un fichier inconnu, absent, symbolique, corrompu ou modifié extérieurement interdit la reprise. Toute validation intervient avant la première écriture, puis avant chaque remplacement et à la fin. Le journal garde sa phase pending si une reprise échoue ; relancer la même opération est possible à partir d’un mélange de versions connues. La fenêtre courante n’est remplacée qu’après récupération et ouverture réussies.

## Frontières

Journal JSON strict : clés et version exactes, 1–64 sources, chemins validés sous `src/`, identités correspondant au manifeste, UTF-8 sans BOM/NUL, 1 Mio/source, 8 Mio pour chaque ensemble avant/après, fichier JSON de 24 Mio maximum. Base64 canonique et SHA-256 vérifiés ; liens/répertoires de métadonnées et hardlinks du fichier journal refusés. Un changement de contenu conservant le même UUID invalide la révision choisie. Les journaux ne peuvent pas nommer des fichiers hors des sources déclarées.

Métadonnées locales privées, répertoires créés en 0700 et fichiers en 0600 ; `.microide` est exclu par la configuration Git créée par l’IDE et par ce dépôt. Aucun secret fournisseur, document ni ROM n’est copié. Aucun nouvel outil agent ni chemin renderer libre. Les temporaires de journal interrompus sont conservés, jamais interprétés comme transactions ; plus de huit fichiers déjà présents dans le répertoire bloque une nouvelle préparation et exige examen. Les échanges de source/manifeste et l’export DSK ne changent pas de format.

## Limites

Qualification d’arrêt de processus Linux ; pas de garantie de coupure électrique, stockage réseau, Windows/macOS ou absence de course avec un autre processus entre contrôle et rename. La sync de répertoire Windows n’est pas exécutée ; cette plateforme reste à qualifier. Une récupération n’est pas une transaction atomique multifichier : son propre arrêt peut laisser un mélange connu, récupérable à la prochaine ouverture. Les sauvegardes actives seules, mutations agent/manifestes et brouillons jamais soumis à Enregistrer tout ne bénéficient pas encore de ce journal. Le journal ne protège pas un dossier supprimé ni un contenu externe inconnu.

IDE-007/008 restent P. La suite R2 étend la journalisation aux autres mutations, puis fournit historique local durable, comparaison/restauration et récupération des brouillons.

## Preuves

Huit tests journal : processus séparé tué par SIGKILL après publication, première et dernière source, deux choix de reprise pour chacun ; conflits, corruption/version future, liens, déplacement, révision, no-op et temporaires. Le banc de panne utilise les vrais primitives de journal/remplacement et l’orchestrateur Workspace avec un port de pause propre à la fixture ; aucune option de panne n’existe dans le logiciel. Recette Electron : ouverture pending, annulation préservant la session, deux choix, contrôle de conflit pendant le dialogue, manifeste intact et choix par défaut annulé. ACC-02/J1-03 restent partiels.
