# ADR 0044 — Tests BASIC isolés à la demande

Statut : acceptée pour l’alpha 0.37. Date : 7 octobre 2026.

## Contexte

Les tests de l’IDE ne sont pas les tests des programmes BASIC utilisateur. Le lancement CPC et la lecture RAM existent ; la lecture des variables et le débogueur BASIC restent à qualifier. Un écran non vide ou une interprétation JavaScript ne seraient pas un verdict d’assertion exécutée sur ROM CPC.

## Décision

- Listings de tests autonomes, déclarations REM @CPCTEST et assertions natives écrivant dans une zone RAM explicitement réservée. Aucune transformation de source, concaténation projet ou commande ASSERT inventée.
- Plan/résultat pur, adaptateur WASM partagé par recette Node et worker jetable ; une instance et un DSK par listing, sans altérer la session interactive.
- Jeu 6128 anglais épinglé, ROM/DSK rehashés, Ready observé par framebuffer. Zone vierge et banques contrôlées en pause. Signature complète puis tous les slots réussis requis ; incomplet/timeout/bloqué/annulé ne sont pas réussis.
- Budgets de taille, cas, temps émulé et réel. Exécution séquentielle seulement sur demande, terminaison/callbacks protégés sur toutes les sorties, aucun hook par tick ni sondage hors test.
- Snapshot et provenance, obsolescence visible, changement de projet invalidant la demande ; exports sans source/ROM mais conservant les noms de cas. Aucun accès IA/shell, lecteur de variables ou couverture prétendue.

## Conséquences

[Guide](../implementation/basic-tests-alpha.md), REQ-EMU-010 / ACC-37, IDE-077 partiel. Cette convention permet des tests dans le moteur intégré avant D3, mais demande de vrais listings de test et une mémoire réservée. Ce n’est ni un framework BASIC universel ni une preuve indépendante/matérielle. Scénarios et IA pourront ensuite utiliser le verdict déterministe avec gardes de révision et budgets.
