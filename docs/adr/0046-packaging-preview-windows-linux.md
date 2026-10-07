# ADR 0046 — Packaging Preview Windows et Linux

## Statut

Accepté pour l’alpha 0.38.1.

## Contexte

CPCéleste est déjà une application Electron, mais les recettes précédentes validaient surtout le build `dist/`. Une application exécutée depuis le dépôt et la même application installée n’ont pas exactement les mêmes contraintes : archive ASAR, chemins de ressources, workers, WebAssembly, stockage utilisateur et droits d’écriture.

Attendre la 1.0 pour découvrir ces différences créerait un risque inutile.

## Décision

L’alpha 0.38.1 produit des artefacts desktop installables ou autonomes :

- Windows x64 : installateur NSIS et exécutable portable ;
- Linux x64 : AppImage et paquet Debian ;
- SHA-256 pour chaque artefact ;
- smoke test de l’application réellement packagée sur les runners Windows et Linux.

La construction utilise Electron Builder 26.17.0 appelé par version exacte depuis un cache de packager isolé, sans `npx` : npm 11 peut interrompre `npx` sous Windows par `ECOMPROMISED / Lock compromised` pendant les gros téléchargements. Le workflow ne publie rien automatiquement et ne signe pas encore les binaires.

Le contenu applicatif embarqué est borné à `dist/`, `package.json`, les dépendances de production nécessaires et les notices de licence. Les ROM CPC restent strictement hors du paquet : elles continuent d’être importées localement dans `app.getPath('userData')/firmware`.

Le premier essai ASAR a prouvé que l’HTML principal s’ouvrait mais que les sous-ressources JS/CSS servies par le protocole `cpceleste://` échouaient avec `net::ERR_UNEXPECTED` une fois compressées dans `app.asar`. Pour 0.38.1, `asar` est donc explicitement désactivé : ASAR n’est pas une frontière de sécurité et la priorité du preview est une distribution fonctionnelle et testable. Une réintroduction éventuelle d’ASAR exige une recette dédiée des sous-ressources.

## Identité Windows

L’application utilise l’identifiant stable `com.astroware.cpceleste` comme `appId` et AppUserModelId. L’exécutable reste ASCII (`CPCeleste.exe`) tandis que le nom produit affiché est `CPCéleste`.

## Limites

Les previews 0.38.1 sont des builds alpha non signés. SmartScreen ou les politiques Linux peuvent donc afficher des avertissements. Les signatures, certificats, auto-update, canaux Stable/Beta/Nightly, publication GitHub Release et qualification upgrade/désinstallation restent rattachés à IDE-071/072 avant 1.0.
