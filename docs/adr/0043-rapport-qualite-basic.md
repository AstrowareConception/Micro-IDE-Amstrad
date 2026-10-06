# ADR 0043 — Rapport de qualité BASIC à la demande

Statut : acceptée pour l’alpha 0.36. Date : 6 octobre 2026. Complète [ADR 0041](0041-analyse-basic-worker-monitoring.md).

## Contexte

La demande produit ajoute une revue ponctuelle de longueur, complexité, anti-patterns et code smells. Le BASIC CPC comporte des cibles numérotées, des instructions composées, des sous-programmes GOSUB, événements et accès machine. Un comptage de mots-clés ne suffit pas à reconstruire son graphe de contrôle. La compacité peut aussi répondre aux contraintes de la machine.

## Décision

- Livrer d’abord un moteur déterministe pur dans `basic-language`, sans dépendance nouvelle, appelé par un worker jetable uniquement sur demande. La source active ou les sources chargées sont copiées ensemble ; brouillons compris, sans sauvegarde implicite.
- Afficher des métriques lexicales par listing et une **complexité cyclomatique estimée**, avec formule et limites. Ne pas annoncer un McCabe exact, un nombre minimal de tests ni des sous-programmes déduits de GOSUB. Aucun score global ou somme entre listings indépendants.
- Distinguer observations de longueur/densité et pistes de revue conditionnelles, duplication et transfert inconditionnel. Employer des repères explicites, pas des interdictions CPC. Réutiliser le lexer qui protège chaînes, REM et DATA ; préserver le contenu des chaînes lors de la comparaison.
- Bornes de source, lot, ligne, tokens, résultats et temps. Worker terminé sur succès, erreur, annulation, timeout, changement de projet et démontage. Rapport conservé en session ; contenu modifié ou source renommée/supprimée rend la navigation obsolète. Aucun recalcul automatique.
- Exporter Markdown/JSON avec méthode, repères, couverture et emplacements, sans code source. Export d’un snapshot obsolète explicitement indiqué. Aucun ajout au DSK, aucune mutation de source, aucun appel fournisseur IA.

## Conséquences

[REQ-EDT-008 / ACC-36](../specifications/01-exigences-fonctionnelles.md) et IDE-076 décrivent ce socle. [Guide](../implementation/basic-quality-alpha.md). Le rapport ne remplace ni les diagnostics syntaxiques ni RUN sur la ROM. Un graphe de contrôle qualifié pourra ensuite permettre des métriques par routine et une analyse de portée plus précise. Une revue IA optionnelle pourra expliquer les résultats avec contexte et corpus, modèle/périmètre choisis, budget et checkpoints existants ; elle ne transformera pas une hypothèse en erreur certaine et ne transmettra pas les sources automatiquement.
