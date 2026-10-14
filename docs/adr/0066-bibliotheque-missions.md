# ADR 0066 — Bibliothèque de missions contextualisées

Date : 14 octobre 2026. Statut : accepté pour l’alpha 0.41.8.

## Contexte

Le champ libre de l’agent demande de connaître son périmètre. L’étude de Portage_Opti met en évidence l’intérêt de phases explicites, d’une référence avant modification et d’un bilan séparant preuves et hypothèses. La première tranche les traduit en missions utilisables avec les outils déjà exposés par CPCéleste.

## Décision

Catalogue éditorial TypeScript pur dans le contexte agent : identifiant, version, type BASIC/binaire, catégorie, résultat, limite, paramètres et texte. Le renderer affiche uniquement les modèles compatibles. L’aperçu reste éditable ; les paramètres ne le remplacent que sur l’action Générer. L’insertion dans l’objectif ne lance pas l’agent, ne change ni scope, ni modèle, ni budgets, ni consentement documentaire.

Les modèles personnels sont des textes inertes, enregistrés explicitement dans le stockage local du profil applicatif, avec version 1, maximum 20 modèles, 20 000 caractères par prompt et 200 000 caractères sérialisés pour la collection. Lecture invalide ou version inconnue : conserver les données et rendre le catalogue intégré accessible. Écriture : valider puis refuser une base changée depuis la lecture. Cette garde n’est pas une transaction interprocessus ; plusieurs fenêtres simultanées restent hors qualification. Échec de stockage : aperçu utilisable et erreur visible. Pas de synchronisation ou d’export automatique.

Les prompts ne sont jamais des instructions système ni une permission d’installer/exécuter des scripts. Une demande d’analyse sans modification reste une consigne au modèle dans le catalogue agent existant ; le mode techniquement lecture seule d’IDE-066 reste ouvert. La comparaison comportementale, le profilage, la conversion graphique et le portage intermachines ne sont pas fournis par ce catalogue.

## Conséquences

Aucune nouvelle dépendance, aucun appel réseau pour consulter le catalogue, aucun projet transmis ou modifié par la préparation. Les tests couvrent les quotas, le stockage périmé/invalide, l’insertion réversible, le rechargement et les contextes BASIC/Z80. Les [crédits](../../THIRD_PARTY_NOTICES.md) identifient la source méthodologique ; les outils tiers et le PDF du dépôt étudié ne sont pas embarqués.
