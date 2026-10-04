# Renumérotation BASIC — alpha 0.8

Date : 2026-10-04. Contribution partielle à J2-04 et ACC-05, indépendante des essais ROM/OpenAI que le responsable produit reporte. Les spécifications 05/14 restent la cible ; cette tranche est un refactoring textuel conservateur, pas un parser BASIC complet.

## Utilisation

Cliquer **Renuméroter** dans la barre d'outils. Définir premier nouveau numéro, pas et plage de numéros BASIC anciens, puis **Prévisualiser la renumérotation**. La plage est inclusive ; les lignes physiques vides restent en place. Le tableau montre les 100 premières substitutions et leur total, l'aperçu texte contient le résultat complet. Les références hors plage vers une ligne sélectionnée sont également mises à jour.

**Appliquer la renumérotation** agit seulement sur le buffer actif, sans sauvegarde disque. L'identité du document, le texte original et la version Monaco sont contrôlés. Une frappe, une action annuler/rétablir ou un autre onglet depuis l'aperçu impose un recalcul. L'application utilise executeEdits avec deux bornes d'annulation : un Ctrl Z rétablit tout le listing, sans effacer l'historique précédent. Fermer le panneau conserve le buffer. Le build DSK utilise ensuite ce buffer comme toute autre modification manuelle.

## Formes prises en charge

Numéros décimaux locaux dans GOTO/GOSUB, THEN/ELSE, ON expression GOTO/GOSUB, AFTER/EVERY GOSUB, ON SQ GOSUB, ON BREAK GOSUB, ON ERROR GOTO, RESTORE, RESUME et RUN. THEN100/ELSE200 et GOTO100/GOSUB100 suivent le lexer existant. RESTORE/RESUME/RUN sans argument et RESUME NEXT n'introduisent pas de cible à réécrire. ON ERROR GOTO 0 reste une désactivation, limitée à son instruction et non au reste de la ligne.

Chaînes, REM, apostrophe et DATA sont opaques. Les espaces, indentations, fins LF et autres nombres sont conservés. RUN avec nom de fichier littéral et CHAIN avec fichier littéral plus éventuel numéro externe conservent leur portée et produisent un avertissement. CHAIN MERGE, paramètres externes calculés, cibles calculées, RSX, GO TO, formes compactes non reconnues, ERL et commandes LIST/DELETE/EDIT/AUTO/RENUM sont refusés. Certaines instructions valides mais hors sous-ensemble, notamment affectations de tableaux en tête de branche, nécessitent un traitement manuel. RESUME 0 et autres sentinelles non qualifiées ne sont pas interprétés comme ON ERROR GOTO 0.

CALL/POKE provoquent un avertissement : des dépendances mémoire aux numéros ne peuvent être déduites. Les données/chaînes peuvent aussi être utilisées indirectement par un programme ; leur conservation textuelle n'établit pas une équivalence sémantique générale. Une cible locale certaine absente, une chaîne ambiguë, un doublon, un ordre incorrect, une collision ou un dépassement de 65535 bloque le plan sans modifier la source. Budget : 1 Mio UTF-8, 10 000 lignes physiques, 4096 caractères par ligne. Les contraintes d'export restent contrôlées séparément ; la renumérotation ne garantit pas qu'une ligne agrandie respecte la saisie ROM.

## Outil agent

`language_renumber(id, expectedHash, start, step, from, to)` appelle le même planificateur puis la mutation project_replace_source existante. Sources déclarées seulement, hash exact, consultation des fiches couvertes, quotas, checkpoint et écriture sont conservés. Le résultat expose nouveau hash, total de substitutions, 100 premières associations et indicateur de troncature, avertissements et couverture partielle. Aucun plan complet volumineux ni octet ROM envoyé par cet outil.

En mode Agent, la mutation est automatique dans le périmètre de mission, selon le document 14 ; pas d'aperçu manuel obligatoire. Une vraie modification invalide la construction précédente. Un plan sans changement n'écrit rien et conserve un éventuel brouillon. Cet outil ne remplace pas les essais d'exécution et n'est pas exposé comme shell hôte.

## Preuves

Suite totale : **54 tests**. Six tests du planificateur : zones opaques, portée ON ERROR, listes/timers/handlers, RESUME/RESTORE/RUN, plage et références extérieures, fichiers externes, ambiguïtés, paramètres/collisions et budgets. Un test agent vérifie préconditions, refus, mutation persistée, build invalidé et absence d'écriture sur no-op.

Le parcours Chromium vérifie aperçu/application, DSK relu, Ctrl Z/Ctrl Shift Z et refus d'une version devenue périmée malgré retour au même texte. Le parcours Electron ajoute absence de sauvegarde implicite, annulation et refus après changement de document. Les parcours existants projets/agent/ROM restent exécutés. Le workflow conserve `renumber-alpha.png` ; consulter les résultats effectifs dans la PR. Aucun boot BASIC ni appel OpenAI réel n'est requis ou revendiqué par cette tranche.
