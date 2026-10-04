# Contenus tiers et attributions

La [licence MIT](LICENSE) couvre les contributions originales du projet. Elle ne remplace pas les droits des références, ROM ou dépendances tiers.

## Corpus fourni par l'utilisateur

`knowledge/locomotive-basic/originals` conserve les trois références fournies au lancement, sans modification des octets. Le catalogue garde noms d'origine, taille et empreintes. La présentation française mentionne une origine Wikipédia et conserve ses références. La référence de commandes est conservée avec son texte et son attribution disponible. La page sauvegardée conserve ses mentions et son lien de conditions CPCWiki ; son contenu, ses scripts et ses styles ne sont pas déclarés MIT par le projet.

Ces documents servent de sources de travail. Les fiches dérivées devront conserver provenance et conditions applicables. La distribution des références dans le paquet de l'application sera vérifiée séparément avant diffusion ; le snapshot HTML ne sera pas chargé comme page privilégiée ou exécuté par l'IDE.

## Composants utilisés dans J0

| Composant | Version verrouillée | Conditions / usage |
| --- | --- | --- |
| floooh/chips | `9e88298ce56319953ac7a43213a1120359f7a3a6` | Zlib ; 13 en-têtes téléchargés avec hashes, notices dans [chips.txt](licenses/chips.txt), moteur compilé |
| Emscripten / emsdk | 4.0.15 / `389a68bc35dcff7ebae4614e1615099dafda00d1` | MIT ou NCSA pour Emscripten ; [licence](licenses/emscripten.txt), compilation WASM et glue générée |
| TypeScript | 5.9.3 | Apache-2.0 ; contrôle de types, outil de développement |
| @types/node / undici-types | 24.0.0 / 7.8.0 | MIT ; déclarations de développement, versions/intégrités dans le lock npm |
| @playwright/test | 1.56.1 | Apache-2.0 ; essais du navigateur, aucune inclusion produit |

Le SDK comprend aussi LLVM/Binaryen et un Node embarqué, outils de construction avec leurs licences conservées dans l'installation emsdk. Ils ne sont pas distribués par le projet. Les artefacts WASM sont accompagnés des notices du moteur et d'Emscripten. Aucune ROM téléchargée, incorporée ou dérivée des firmwares Amstrad : le test original contient seulement l'instruction Z80 `JP 0`.

## Extraction PDF — alpha 0.11

`pdfjs-dist` 6.4.299, Apache-2.0, [projet Mozilla PDF.js](https://github.com/mozilla/pdf.js) ; package et intégrité figés dans `package-lock.json`, licence originale conservée dans le paquet installé. Build legacy utilisé pour le texte dans le thread, sans viewer ou rendu de page. Dépendance optionnelle Node `@napi-rs/canvas` 1.0.10 et variantes natives verrouillées, MIT ; licences/notices natives restent celles des paquets, à inventorier dans la distribution finale. Ce composant est chargé par les polyfills Node de PDF.js ; aucune qualification de rendu n'est déduite de sa présence. Aucun PDF tiers fourni comme fixture : exemples de recette originaux générés par le projet.

## Composants étudiés pour les incréments suivants

CPCBasicTS : MIT ; Caprice32 : GPLv2. Ils sont étudiés et référencés ; Caprice32 est un oracle externe prévu, pas un composant embarqué. L'intégration future préservera les notices exactes de chaque version effectivement utilisée.

Les ROM OS/BASIC/AMSDOS ne sont pas incluses. Les droits firmware sont distincts de ceux des émulateurs.
