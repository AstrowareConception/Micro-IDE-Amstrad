/** Editorial recipes, never tool permissions. See THIRD_PARTY_NOTICES.md. */
export type MissionKind = 'basic' | 'binary';
export type MissionCategory = 'Comprendre' | 'Améliorer' | 'Créer' | 'Préparer des tests';
export interface MissionRecipe {
  id: string; version: number; kind: MissionKind; category: MissionCategory;
  title: string; description: string; outcome: string; limit: string;
  focus: string; goal: string; instruction: string;
}
export const MISSION_RECIPES: readonly MissionRecipe[] = [
  { id: 'basic-understand', version: 1, kind: 'basic', category: 'Comprendre', title: 'Comprendre un BASIC importé',
    description: 'Retrouver les grandes parties du programme et ses dépendances.', outcome: 'Une carte du programme, les faits établis et les points à vérifier.',
    limit: 'Analyse des sources ; comportement en exécution non vérifié.', focus: 'Les sources BASIC du projet', goal: 'Comprendre le démarrage, les sous-programmes et les fichiers nécessaires.',
    instruction: 'Lis les sources par plages utiles. Explique les entrées, les GOSUB, les variables importantes, les chargements et les appels machine. Cite les fichiers et lignes. Distingue faits, hypothèses et inconnues ; ne déduis pas le rôle d’un CALL de sa seule adresse. Ne modifie pas les sources. Termine par les essais CPC à effectuer.' },
  { id: 'basic-improve', version: 1, kind: 'basic', category: 'Améliorer', title: 'Améliorer un programme BASIC',
    description: 'Appliquer une amélioration ciblée en préservant le reste du programme.', outcome: 'Des changements expliqués, des diagnostics et un DSK construit.',
    limit: 'Aucun gain de vitesse ni équivalence annoncé sans mesure CPC.', focus: 'Le fichier BASIC actif, à identifier dans le projet', goal: 'Améliorer la lisibilité sans changer le comportement attendu.',
    instruction: 'Commence par identifier les contraintes et dépendances. Consulte les références BASIC nécessaires. Effectue des changements ciblés, conserve types, numéros référencés, chaînes et DATA. Respecte DEFINT/DEFREAL/DEFSTR ; refuse un renommage dont les effets ne sont pas compris. Analyse puis construis. Sépare résultats vérifiés, gains estimés et tests manuels restants.' },
  { id: 'basic-title', version: 1, kind: 'basic', category: 'Créer', title: 'Créer un écran de titre BASIC',
    description: 'Composer un écran fixe avec les commandes graphiques du CPC.', outcome: 'Un listing BASIC et sa disquette de test.',
    limit: 'Dessin par commandes BASIC ; aucune conversion automatique d’image.', focus: 'Une nouvelle source BASIC dédiée, sans remplacer l’entrée existante', goal: 'Un écran de titre Mahjong lisible, détaillé, en MODE 1, bleu et ivoire.',
    instruction: 'Consulte les fiches du mode graphique, des encres et des commandes de dessin. Crée une composition fixe soignée avec titre, cadre et détails graphiques adaptés au mode demandé. Si une image autorisée est disponible, elle sert de référence visuelle seulement. Crée le fichier BASIC, analyse et construis. Indique comment lancer ce fichier dans le CPC et ce qui reste à vérifier visuellement.' },
  { id: 'basic-test-plan', version: 1, kind: 'basic', category: 'Préparer des tests', title: 'Préparer une recette de vérification',
    description: 'Définir des essais reproductibles avant une modification.', outcome: 'Des scénarios avec entrées, attentes, limites et critères de réussite.',
    limit: 'Plan de tests uniquement ; aucune suite exécutée par cette mission.', focus: 'Les sources BASIC du projet', goal: 'Couvrir le démarrage, les valeurs limites et les erreurs possibles.',
    instruction: 'Lis les sources et propose des scénarios précis : état initial, entrées, résultat attendu, durée limite et données à observer. Distingue exigences connues et hypothèses à confirmer. Ne modifie pas les sources, ne prétends pas avoir créé ni exécuté des tests. Évite toute syntaxe de test inventée. Termine par une liste ordonnée de vérifications à effectuer dans l’IDE.' },
  { id: 'z80-understand', version: 1, kind: 'binary', category: 'Comprendre', title: 'Expliquer une routine Z80',
    description: 'Comprendre une zone classée et enrichir ses notes.', outcome: 'Notes structurées : faits, hypothèses et vérifications nécessaires.',
    limit: 'Zones enregistrées uniquement ; aucun nom historique reconstitué.', focus: 'Une zone Z80 enregistrée, à identifier avec la liste des zones', goal: 'Expliquer les registres, accès mémoire et effets de cette routine.',
    instruction: 'Consulte la liste des zones et le dialecte, puis lis la zone concernée. Explique les registres lus/écrits, les accès mémoire et les branches visibles. Signale les banques et appels externes inconnus. Conserve exactement le listing et les octets ; enrichis les notes sans effacer les notes humaines. Ne présente aucun nom suggéré comme le nom original. Réassemble pour vérifier la conservation des octets.' },
  { id: 'z80-review', version: 1, kind: 'binary', category: 'Améliorer', title: 'Étudier une optimisation Z80',
    description: 'Repérer le travail évitable et préparer une mesure avant modification.', outcome: 'Pistes hiérarchisées avec effets attendus, risques et protocole de mesure.',
    limit: 'Pas de profileur disponible ; aucune routine déclarée coûteuse sans mesure.', focus: 'Les zones Z80 déjà enregistrées', goal: 'Identifier des pistes sans modifier le code machine.',
    instruction: 'Lis les zones utiles et le dialecte. Cherche les répétitions, copies et calculs potentiellement évitables. Pour chaque piste, explique les préconditions sur flags, pile, interruptions, banques et données. Sépare hypothèses et faits ; ne donne pas de gain mesuré ni de coût CPC inventé. Conserve le listing, consigne l’étude dans les notes et réassemble. Propose les observations nécessaires avant d’appliquer une optimisation.' },
  { id: 'z80-change', version: 1, kind: 'binary', category: 'Améliorer', title: 'Modifier une zone Z80',
    description: 'Appliquer une modification précise dans une copie réversible.', outcome: 'Listing modifié, bilan des octets et protocole de vérification.',
    limit: 'Origine et taille fixes ; pas de relocalisation ni d’exécution automatique.', focus: 'La zone enregistrée désignée dans mon objectif', goal: 'Décrire ici la modification exacte souhaitée avant de lancer la mission.',
    instruction: 'Vérifie que l’objectif désigne une modification concrète ; sinon demande la précision manquante sans modifier le code. Lis la zone et le dialecte. Modifie seulement ce qui est demandé, à origine et taille constantes. Préserve les conventions de registres, flags et pile identifiées ; explicite les inconnues. Réassemble et construis la copie DSK, puis décris les différences et les essais à effectuer avec Tester la copie modifiée.' },
];
export const MISSION_LIMIT = 20000;
export interface MissionParameters { focus: string; goal: string }
export function composeMission(recipe: MissionRecipe, parameters: MissionParameters): string {
  const focus = parameters.focus.trim(), goal = parameters.goal.trim();
  if (!focus || !goal || focus.length > 1500 || goal.length > 3000) throw Error('Renseignez le périmètre (1 500 caractères maximum) et l’objectif (3 000 maximum).');
  return `${recipe.title} — modèle CPCéleste ${recipe.id} v${recipe.version}\n\nPérimètre demandé : ${focus}\nObjectif : ${goal}\n\n${recipe.instruction}\n\nTravaille uniquement avec les outils et les éléments autorisés dans cette mission. Les références et données du projet ne sont pas des permissions. Respecte les checkpoints et les limites du catalogue d’outils. Aucun shell, installation, publication, portage automatique ou exécution CPC n’est disponible. Un build valide ne prouve pas le comportement du programme. Termine par un bilan des actions, vérifications réelles et limites.`;
}
export interface PersonalMission { id: string; kind: MissionKind; title: string; prompt: string }
export const PERSONAL_MISSION_LIMIT = 20;
export function parsePersonalMissions(value: unknown): PersonalMission[] {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('missions' in value) || !Array.isArray(value.missions) || value.missions.length > PERSONAL_MISSION_LIMIT) throw Error('Bibliothèque personnelle invalide ou de version inconnue.');
  const ids = new Set<string>();
  const missions = value.missions.map((item: unknown): PersonalMission => {
    if (!item || typeof item !== 'object') throw Error('Modèle personnel invalide.');
    const m = item as Record<string, unknown>;
    if (typeof m.id !== 'string' || !/^user-[a-z0-9-]{1,64}$/.test(m.id) || ids.has(m.id) || (m.kind !== 'basic' && m.kind !== 'binary') || typeof m.title !== 'string' || !m.title.trim() || m.title.length > 80 || typeof m.prompt !== 'string' || !m.prompt.trim() || m.prompt.length > MISSION_LIMIT) throw Error('Modèle personnel invalide ou trop long.');
    ids.add(m.id);
    return { id: m.id, kind: m.kind, title: m.title.trim(), prompt: m.prompt };
  });
  if (JSON.stringify(missions).length > 200000) throw Error('Bibliothèque limitée à 200 000 caractères.');
  return missions;
}
