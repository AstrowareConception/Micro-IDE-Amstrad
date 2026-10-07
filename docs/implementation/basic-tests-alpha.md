# Tests de programmes BASIC — alpha 0.37

Date : 7 octobre 2026. REQ-EMU-010 / ACC-37, IDE-077 partiel. [ADR 0044](../adr/0044-tests-basic-isoles.md).

## Utilisation

Menu **BASIC → Tests BASIC à la demande…**, palette ou onglet **Tests BASIC** des sorties. Ouvrir un programme de test autonome, choisir **Source active** ou **Listings déclarés parmi les sources chargées**, puis **Exécuter les tests BASIC**. Les brouillons sont utilisés sans sauvegarde. Le second périmètre inclut seulement les listings déclarant au moins un test ; aucun fichier non chargé n’est recherché.

Chaque listing possède son propre DSK MAIN.BAS, une instance WASM et un CPC propre. Aucun autre fichier n’est ajouté ou concaténé. La session CPC interactive et ses écritures ne sont pas remplacées. Le banc est muet, sans canvas ni clavier utilisateur. Le programme s’exécute par la ROM, sans compilation JavaScript. Aucun appel IA, shell hôte ou exécution pendant la frappe.

## Écrire un test

[Exemple complet à ouvrir](../../examples/basic-tests/tests-score.bas), aussi téléchargeable depuis le panneau. Le programme déclare un cas par ligne numérotée entière `REM @CPCTEST 1 Score positif` : slot unique 1–32, nom de 120 caractères maximum. Chaînes et commentaires après une instruction ne déclarent rien.

Le listing réserve **&8000–&8023** avec `MEMORY &7FFF` avant ses allocations. C’est un contrat explicite du programme de test, pas une adresse libre garantie dans tout jeu. Ne pas utiliser cette zone pour un autre objet ou une autre banque RAM. Le banc refuse une zone non vierge après le boot et une configuration RAM modifiée lors d’une observation.

Pour le slot N, écrire **1** (réussi) ou **2** (échoué) à `&8003 + N`. Les assertions emploient IF/THEN/ELSE et GOSUB natifs ; aucune commande ASSERT ajoutée. Exemple du slot 1 :

```basic
40 score=100:bonus=50:GOSUB 1000
50 IF score=150 THEN POKE &8004,1 ELSE POKE &8004,2
```

Après toutes les assertions, transmettre la signature complète de fin :

```basic
80 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
90 END
```

| Résultat | Condition |
| --- | --- |
| Réussi | Signature complète et tous les slots déclarés valent 1 |
| Échoué | Signature complète, tous les slots valent 1/2, au moins un vaut 2 |
| Incomplet | Signature complète mais un résultat manque ou vaut autre chose que 1/2 |
| Délai dépassé | Signature absente au terme du budget émulé |
| Bloqué | Préparation, ROM, moteur, zone initiale ou banque non qualifiés |
| Annulé | Aucun verdict reçu avant l’annulation |

Un délai dépassé ne distingue pas automatiquement boucle, INPUT, erreur BASIC ou protocole oublié. Une fin de programme seule ne suffit jamais. Le listing reste responsable de la pertinence de ses assertions ; écrire volontairement un faux résultat est possible comme dans tout code de test. Pas d’extraction de routine ou de génération automatique : construire explicitement un listing contenant la routine GOSUB et ses scénarios.

## Budgets, provenance et cycle de vie

8 listings maximum, 16 Kio UTF-8/listing, 32 assertions/listing. Budget **1–15 secondes émulées après la saisie de RUN**, 3 par défaut : le chargement disque est compris, un budget trop court peut expirer avant les assertions. Le boot de 5 secondes et le clavier précèdent ce budget ; le rapport affiche aussi leur temps émulé. Délai réel **60 secondes/listing**, préparation comprise. Tranches CPU de 20 ms dans le worker, yields groupés, ni frame/audio envoyés ni callback JavaScript par tick.

Jeu anglais identifié et signature Ready de la [recette CPC](emulator-run-alpha.md) uniquement. Hashes ROM et DSK revérifiés dans le worker. Autres ROM bloquées, sans confirmation manuelle Ready pour ce banc automatique ; une taille de 16 Kio ne suffit pas. Aucun firmware dans Git ou les rapports.

Le rapport contient date, budget, cas/octets, temps et hashes source/DSK/ROM lorsque préparés. Source modifiée, renommée ou retirée : **rapport obsolète**, sans relancement implicite. Projet remplacé : annulation et retrait du rapport. Exports Markdown/JSON sans code ni ROM, mais avec les noms/messages choisis par l’utilisateur à relire avant partage. Export en cours explicitement partiel ; JSON liste les listings encore sans verdict.

Worker terminé et callbacks retirés sur résultat, erreur, annulation, délai réel, changement de projet et démontage. Une image de préparation tardive ne crée aucun worker abandonné. Pas de manifeste de tests ni d’historique durable de rapports dans cette tranche.

## Vérification et limites

[Tests du contrat](../../tests/basic-tests.test.ts) : déclarations, quotas, signature, valeurs absentes/invalides, slot 32, exports, ROM et budgets. [Recette runtime réelle](../../tests/basic-test-runtime-smoke.mjs), partageant l’adaptateur du worker : réussi, échoué, incomplet, boucle, ERROR et INPUT. [Recette navigateur réelle](../../tests/basic-tests-firmware-smoke.mjs) : worker WASM, hashes du buffer/ROM, succès/échec, obsolescence, export et terminaison. Le scénario d’ergonomie dans `test:editor` utilise un transport contrôlé pour annulation, erreurs, délais, callbacks tardifs et changement de projet ; ce n’est pas une preuve ROM.

La PR distingue validations exécutées et restantes. Aucun Caprice32 indépendant, CPC physique, autre ROM/modèle ou timing matériel qualifié. Pas de sorties fichier, assertions visuelles, couverture, lecteur de variables, clavier scénarisé ou revue IA livrés par ce lot. Suite : fixtures/scénarios de projet, qualification du débogueur puis génération IA de tests explicitement revue.

La [0.39, premier lot](basic-test-suites-alpha.md), ajoute maintenant les suites persistantes et l’historique local ; les limites d’exécution de ce banc restent inchangées.
