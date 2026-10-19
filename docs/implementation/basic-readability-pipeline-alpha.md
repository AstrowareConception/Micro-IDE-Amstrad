# Mission de lisibilité composée — 0.41.29

Les outils de renommage, formatage, commentaires et découpage sont désormais exercés ensemble sur six petits programmes représentatifs des profils admis. Cette qualification couvre les raccords entre transformations, avec un fournisseur IA déterministe et de vraies écritures. Elle ne mesure pas les choix d’un modèle réel sur un jeu historique.

## Ce que construisent les derniers incréments

| Version | Apport |
| --- | --- |
| 0.41.25 | Appliquer le découpage, rouvrir le projet et rétablir la dernière mutation disque |
| 0.41.26 | Admettre les expressions entières, chaînes et affichage |
| 0.41.27 | Contrôler les deux issues des conditions simples |
| 0.41.28 | Contrôler les parcours bornés de FOR/NEXT et WHILE/WEND |
| 0.41.29 | Composer les transformations dans une mission et conserver les commentaires lors du découpage |

La finalité est un BASIC plus facile à maintenir, dont les transformations restent inspectables et réversibles. Ce n’est ni un interpréteur de remplacement ni une preuve d’équivalence de tout programme BASIC.

## Parcours et corrections

La mission préparée dans le panneau IA demande les outils déterministes de renommage, puis de mise en forme, puis d’insertion de commentaire, puis de découpage si l’option est cochée. Les hashes sont relus après chaque mutation. Les aperçus périmés doivent être renouvelés, y compris après une écriture documentaire. Un refus ne peut pas être contourné par remplacement libre. L’option de découpage reste désactivée par défaut ; son libellé indique désormais l’application des blocs admissibles. Les indications obsolètes interdisant tout déplacement ou tout renommage FN sont retirées.

Deux obstacles observés sont corrigés : les lignes REM empêchaient tout découpage ; CLS sans argument empêchait un index complet des variables et donc le renommage. L’index reconnaît maintenant cette seule forme sans opérande ; les variantes CLS avec flux ne sont pas élargies ici.

## Profil commenté v5

`terminal-commented-chain-merge-v5` applique les règles exécutables v2/v3/v4, avec scalaires explicitement typés, aux sources contenant des commentaires documentaires. Les profils sans commentaires gardent leurs identités et leurs restrictions.

- REM autonome, éventuellement vide ; texte ASCII de 1 à 96 caractères, premier caractère alphanumérique, ponctuation limitée à celle de l’insertion contrôlée.
- Ni apostrophe, guillemet, deux-points, directive `@CPCTEST`, commentaire en fin d’instruction ni caractère non ASCII.
- Numéros et lignes originales conservés. Les commentaires entre le GOTO terminal et sa cible accompagnent le module ; CHAIN MERGE conserve le numéro de cible exécutable, qui ne peut pas être un commentaire.
- REM autorisés avant les instructions, dans les corps bornés et après END. Ils comptent dans les limites physiques : 40 lignes au total, 20 dans le module, 4096 caractères et 255 par ligne.
- Boucles toujours fermées d’un côté de la frontière ; IF imbriqués/dans les corps, GOSUB/RETURN, DATA et états opaques toujours refusés. Les REM ne masquent aucune instruction au validateur.
- Consultation de la fiche REM requise pour appliquer v5. Corpus fourni inchangé, référence abrégée lignes 229–230, comportement confronté aux ROM identifiées.

Voir [ADR 0079](../adr/0079-composition-lisibilite-basic.md).

## Preuves

Le transport contrôlé pilote le vrai `AgentController` : lecture/audit et liste des suites, consultation, renommage `s%` en `score%`, formatage effectif, insertion d’un REM avant l’entrée 100, note documentaire, renouvellement de l’aperçu invalidé par cette note, extraction dans PART et construction. Aucun faux résultat de test CPC n’est injecté : ces témoins n’ont pas de suite autonome enregistrée et le bilan le dit.

| Témoin | Affichage littéral attendu, espaces BASIC compris |
| --- | --- |
| Expression `(3+2)*2` | `SCORE 10 ` |
| Condition fausse | `SCORE 2 ` |
| Condition vraie | `SCORE 7 ` |
| FOR sauté | `SCORE 0 I 1 ` |
| FOR trois tours | `SCORE 6 I 4 ` |
| WHILE décroissant, trois tours | `SCORE 6 I 0 ` |

Le banc exécute les DSK produits depuis les fichiers réels : original, appliqué puis rouvert, dernière mutation rétablie, mission initiale restaurée. Chaque affichage est comparé à un programme littéral indépendant, sur la première ligne vidéo hors Ready/curseur. Les commentaires déjà présents dans MAIN, le corps et après END restent couverts. Deux passages de mission par programme isolent les deux restaurations : aucune précondition n’est désactivée pour le test.

**Résultat local : six programmes, 24 exécutions des états de projet et six oracles, soit 30 exécutions CPC réussies.** Le rapport `out/basic-readability-qualification.json` porte les empreintes des ROM, du moteur, des sources, des DSK et des observations, sans distribuer de ROM. La recette v4 est rejouée avec l’observateur partagé. Tests Node sur refus, limites, consultations, invalidation, mutations effectives, documents et protection des edits étrangers.

```sh
CPC_TEST_ROM_DIR=/chemin/roms node scripts/qualify-basic-readability.mjs
node --test tests/basic-readability-pipeline.test.mjs
```

La CI ajoute la recette firmware bloquante et `tests/multifile-desktop-smoke.mjs --readability` aux recettes précédentes. Le parcours natif prépare la mission depuis ses options, applique les transformations, restaure le checkpoint initial en session, recommence, ferme complètement Electron, rouvre, annule une restauration, protège un brouillon, puis rétablit uniquement le découpage. Capture `out/basic-readability-desktop.png`. Le résultat natif doit être vérifié sur le SHA exact de la PR ; il n’est pas déduit des tests Node.

## Restaurations et limites

Le checkpoint initial restaure toute la mission encore présente dans le contrôleur, sources et documents. Les sources initialement chargées en CRLF sont normalisées en LF dans cet instantané : on vérifie le texte et l’identité du DSK, sans promettre leurs octets CRLF initiaux. Le menu durable après redémarrage restaure les octets précédant la dernière mutation disque : ici, il annule l’extraction, en conservant renommage, espaces, REM et note. Il ne restaure pas toute la mission. Le journal et ses limites de panne électrique/interprocessus sont inchangés.

La comparaison CPC est une recette de développement externe à la mission. Les outils `basic_tests_*` exécutent encore des listings autonomes et ne prouvent pas le DSK multifichier effectivement transformé. Le panneau et la consigne signalent cette absence. Aucun résultat de modèle réel, équivalence temporelle, mémoire libre, CPC physique ou émulateur indépendant n’est revendiqué.

**Suite prioritaire :** permettre des scénarios de test attachés au vrai projet/DSK et à ses empreintes, exécutables avant/après par l’agent. Élargir ensuite les structures selon les besoins observés (IF dans les boucles, imbrications), puis reprendre profiler 0.42 et observation CPC 0.43. Aucun packaging par commit.
