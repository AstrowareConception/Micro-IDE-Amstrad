# Découpage BASIC enregistré et restauration — alpha 0.41.25

**Évolution 0.41.26 :** un [profil distinct pour expressions, chaînes et affichage](basic-multifile-expressions-alpha.md) complète le profil initial décrit dans ce rapport historique. Le protocole de journal et de restauration est conservé.

La simulation 0.41.24 peut désormais être appliquée par l’agent. Les deux sources et le manifeste forment une seule mutation journalisée. Le profil BASIC accepté reste exactement celui de la [simulation terminale](basic-multifile-dry-run-alpha.md) : un GOTO littéral final, des affectations entières simples, des POKE de test et END. Ce lot qualifie la persistance ; il ne constitue pas un découpage général de jeux.

## Utilisation

Dans une mission autorisée, demander à l’agent de prévisualiser l’extraction du bloc terminal vers PART, de l’appliquer si elle est acceptée, puis de reconstruire le DSK. L’agent appelle `language_extraction_simulate`, consulte les références nécessaires, puis `language_extraction_apply` avec le `previewId`, l’ID source et son SHA-256. Le panneau IA montre l’avant/après, le fichier créé et l’état prêt, appliqué, périmé ou interrompu. Aucune confirmation individuelle supplémentaire n’est imposée à une mission déjà autorisée.

Exemple témoin accepté :

```basic
10 MEMORY &7FFF
20 score%=42
30 POKE &8000,11
40 GOTO 100
100 POKE &8001,score%
110 POKE &8002,24
120 END
```

Le principal se termine ensuite par `40 CHAIN MERGE "PART.BAS",100`. Les lignes 100 à 120 deviennent `src/part.bas`, déclaré dans le manifeste ; MAIN reste l’entrée. Le projet réouvert peut construire son DSK à partir des fichiers enregistrés.

Après fermeture et réouverture, choisir **Projet → Rétablir la dernière modification IA…**. Le dialogue liste les fichiers touchés et laisse Annuler par défaut. La restauration rétablit le manifeste et les octets disque antérieurs, y compris CRLF, et retire la source créée. Elle ne nécessite ni clé API ni ancienne conversation. Les brouillons doivent d’abord être enregistrés ou conservés ailleurs ; une modification externe refuse la restauration.

Cette commande revient sur la **dernière mutation disque IA**, pas sur toute une mission. Une mutation ultérieure remplace ce point de retour. Le bouton **Restaurer le checkpoint initial** de la mission courante reste distinct et peut restituer ses brouillons initiaux ; le retour durable ne restitue que les versions disque journalisées. Les snapshots d’historique conservent les sources selon la rétention existante.

## Transaction et interruptions

Le plan est conservé dans la mission, lié au snapshot complet et à un compteur de mutations. Un autre aperçu remplace le précédent ; modifier puis remettre le texte initial ne réactive pas un ancien plan. Aucun contenu arbitraire n’est accepté par l’outil d’application. Le DSK candidat est reconstruit et son empreinte comparée avant persistance. L’adaptateur contrôle encore la session, le manifeste et toutes les versions disque.

`ProjectStore.applyAgentState` réutilise le journal durable existant : validation des destinations, journal avant écriture, fichiers temporaires synchronisés, publication des sources puis du manifeste et vérification finale. Les collisions de casse sont également refusées. La mutation n’est adoptée en mémoire qu’après commit disque ; une erreur du journal de conversation survenant après ce commit n’est pas présentée comme un rollback réussi.

Il ne s’agit pas d’une écriture indivisible de tout le dossier. Une interruption peut laisser des versions mixtes, mais le journal pending interdit l’ouverture normale et les mutations. À la réouverture, **Terminer la mutation agent** choisit l’état découpé ; **Rétablir les versions avant mutation** choisit l’état antérieur. Ces deux choix se rapportent à la transaction initiale, même après une interruption de sa restauration. Toute version externe inconnue est conservée et bloque la reprise.

## Preuves et limites

- Tests de domaine/adaptateur : aperçu sans écriture, application exacte, reconstruction du DSK après réouverture, restauration des octets/manifeste, suppression du fichier créé, garde des brouillons, collisions, révisions et ancien aperçu après retour au même texte.
- Dix interruptions réelles de processus : journal préparé, principal publié, fichier créé, manifeste publié et restauration interrompue après retrait ; reprise dans les deux directions.
- `scripts/qualify-basic-multifile-apply.mjs` exécute trois disquettes construites depuis le projet réel : avant, appliqué/réouvert, restauré/réouvert. Résultat observé localement : **[11,42,24] dans les trois cas** sur les ROM CPC 6128 identifiées. Rapport JSON avec empreintes, sans ROM.
- `tests/multifile-desktop-smoke.mjs` couvre l’agent contrôlé sans facturation, l’écriture réelle via Electron, le redémarrage complet, le menu, l’annulation et les brouillons. Recette bloquante en CI Linux ; vérifier son résultat sur le SHA de la PR.

Aucune qualification de panne électrique, système de fichiers réseau, verrou interprocessus, CPC physique ou nouvel émulateur indépendant. Les essais du témoin ne prouvent ni équivalence universelle, ni timings identiques. Conditions, boucles, GOSUB/RETURN, DATA, ressources et programmes déjà multifichiers restent refusés par le profil. Prochain lot : élargir les transformations par classes de programmes et témoins firmware discriminants.
