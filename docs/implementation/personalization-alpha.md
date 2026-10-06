# Personnalisation avancée — alpha 0.32

Cette tranche du lot 7 prolonge IDE-027/028/030. Elle fournit un centre de réglages, des profils personnels, une keymap configurable et des dispositions de travail. Les autres lots continuent d’être référencés dans la roadmap ; aucune qualification globale de l’IDE ou du CPC n’est déduite de cet ajout.

## Utilisation

Outils → Paramètres, ou Ctrl/Cmd virgule avec la base CPCéleste. La recherche retrouve les groupes de réglages ; les catégories limitent la vue. Modifier prépare une copie : Appliquer active les valeurs, Annuler les abandonne. Le focus revient au code.

Apparence : clair/sombre/système, cinq accents (cyan, ambre, violet, vert, rose), densité confortable/compacte, police installée et taille 10–32 px. Les dimensions des panneaux restent réglables. Les couleurs d’accent concernent l’atelier ; elles ne changent ni la palette CPC ni les pixels du programme.

Éditeur : indentation, parenthèses, retour visuel, minimap, interligne automatique ou explicite au moins égal à la taille du code, numéros physiques absolus/relatifs/masqués, caractères invisibles, curseur trait/bloc/souligné et clignotant/fixe, ligatures, guides, coloration des parenthèses et règle de colonne. Les numéros BASIC et octets du listing restent inchangés. Une police non installée utilise les substitutions du système ; les ligatures dépendent de la police. Menu Affichage et Ctrl/Cmd molette modifient désormais la même taille persistante.

## Raccourcis

La base CPCéleste conserve les combinaisons existantes, inspirées de VS Code. La base inspirée JetBrains change notamment la palette (Ctrl/Cmd Maj A), l’ouverture de source (Ctrl/Cmd Maj N), les paramètres (Ctrl/Cmd Alt S) et la concentration (Ctrl/Cmd Maj F12). Les deux combinaisons devenues conflictuelles de l’agent et d’Enregistrer sous sont retirées de cette base ; les commandes restent dans les menus. Il ne s’agit pas d’importer une keymap JetBrains complète ou de modifier tous les gestes Monaco.

Vingt-huit commandes de l’atelier sont configurables. Cliquer dans leur champ puis presser une combinaison ; Retour arrière/Suppr la retire. Les conflits entre commandes et les raccourcis réservés à l’édition ou au système empêchent l’application. Combinaisons simples Ctrl/Cmd avec lettre, chiffre, ponctuation prise en charge, espace ou Tab ; touches de fonction avec modificateurs facultatifs. Pas de séquences à plusieurs frappes, de double Maj ou de raccourcis souris personnalisés.

Menus, palette, boutons concernés et aide affichent la configuration courante. Les anciennes combinaisons de l’atelier sont consommées lorsqu’elles sont retirées, pour ne pas déclencher une action navigateur ou une sauvegarde Monaco parallèle. Les répétitions, la composition et AltGr ne déclenchent pas de commande de l’atelier. Les actions désactivées conservent leurs garde-fous. Les dialogues reçoivent leur clavier sans exécuter les commandes globales.

Référence des combinaisons JetBrains : [documentation officielle](https://www.jetbrains.com/help/idea/reference-keymap-win-default.html), consultée le 6 octobre 2026. Les raccourcis OS, dispositions clavier et macOS demandent leur propre qualification.

## Profils et dispositions

Douze profils locaux nommés au maximum, noms de 1–60 caractères, doublons insensibles à la casse refusés. Enregistrer/mettre à jour/supprimer un profil est une action immédiate distincte de l’application des réglages. Charger ou importer prépare les valeurs, puis Appliquer les active. Les profils incluent l’apparence, l’édition, l’auto-save, les dimensions de panneaux et la keymap ; vérifier l’auto-save avant application.

Exporter produit un fichier JSON UTF-8 contenant exactement `format: cpceleste-personalization`, `version: 1`, `name` et `preferences`. Import limité à 64 Kio, version/format/clefs inconnus et keymap contradictoire refusés. Les champs connus sont normalisés selon leurs bornes. Export par liste blanche : aucune clé IA/GitHub, identité Git, chemin de projet, ROM, source, conversation ou disposition flottante n’est jointe. Un profil local n’est pas un profil d’identité Git.

Affichage → Disposition Édition montre les outils et le code ; Exécution montre le code et les sorties CPC sans lancer un programme ; Agent montre le code et l’assistant. Ces presets réancrent les panneaux et conservent leurs dimensions. Concentration masque outils/agent/sorties puis restitue leur visibilité et géométrie précédentes. Ce mode temporaire ne remplace pas la disposition enregistrée. Restaurer la disposition des panneaux reste disponible depuis menu/palette. Masquer le CPC n’arrête pas une session en cours.

## Persistance et vérification

Préférences locales version 2, migration de la clef version 1 sans supprimer l’original ; ancien thème/police/auto-save/dimensions conservés. Keymap copiée et normalisée, defaults immuables. Une version future ou un JSON illisible reste intact ; les réglages appliqués fonctionnent seulement pour la session et un message indique la conservation indisponible. Les profils utilisent leur propre enveloppe version 1 ; une modification depuis une fenêtre périmée est refusée pour ne pas effacer des profils enregistrés ailleurs. La disponibilité et la durabilité de localStorage ne constituent pas une transaction disque des sources ni une synchronisation entre appareils.

227 tests Node et typage strict passent localement, dont huit recettes nouvelles : bornes, migration, conservation de versions inconnues/indisponibilité du stockage, conflits/reservations de keymap, Ctrl/Cmd/composition, export sans champs étrangers et import borné, rétention/versions de profils et refus d’une révision périmée. Builds renderer/main exécutés. `personalization-smoke.mjs` couvre brouillon/identité Monaco/undo, recherche, options visuelles, conflits, dispatch, import annulé, profils, concentration et dispositions, zoom et réouverture. `personalization-desktop-smoke.mjs` ajoute sauvegarde via main et redémarrage Electron. Les résultats effectivement exécutés de navigateur, Electron Linux et Windows sont consignés dans la PR.

## Suite

Overrides par projet, profils de géométrie personnalisés, ancrage sur un autre côté et fenêtres système, keymap exhaustive du code, import de keymaps tierces, centre de notifications, traduction et audit complet d’accessibilité restent ouverts. IDE-027/028/030 et lot 7 restent partiels ; les tests ponctuels ne valent pas audit WCAG ou qualification macOS.
