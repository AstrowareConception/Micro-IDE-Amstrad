/** Editorial subset, not a grammar or a machine-qualified reference. */
export const REFERENCE = {
  id: 'provided-command-reference',
  version: 'initial-import-1',
  sha256: '4515b3cda39f3e4a1280bcaa750ecb73729e0e6859532d0623622dfd275ab5ec',
  status: 'editorial-subset-not-rom-qualified',
} as const;

export interface CommandCard {
  name: string;
  syntax: string;
  description: string;
  line: number;
  kind: 'command' | 'function';
}

const command = (name: string, syntax: string, description: string, line: number): CommandCard =>
  ({ name, syntax, description, line, kind: 'command' });
const fn = (name: string, syntax: string, description: string, line: number): CommandCard =>
  ({ name, syntax, description, line, kind: 'function' });

// Signatures intentionally illustrate the subset; optional parameters are not exhaustive.
export const COMMANDS: readonly CommandCard[] = [
  fn('ABS', 'ABS(x)', 'Valeur absolue.', 12),
  command('AFTER', 'AFTER delay, timer GOSUB line', 'Programme un sous-programme différé.', 14),
  fn('ASC', 'ASC(x$)', 'Code du premier caractère.', 16),
  command('BORDER', 'BORDER colour1, colour2', 'Couleur de bordure ; deux couleurs permettent une alternance.', 24),
  command('CALL', 'CALL address, parameters', 'Appelle une routine machine.', 26),
  command('CAT', 'CAT', 'Catalogue du périphérique courant.', 28),
  fn('CHR$', 'CHR$(x)', 'Caractère correspondant à un code.', 38),
  command('CLG', 'CLG', 'Efface la zone graphique.', 44),
  command('CLOSEIN', 'CLOSEIN', 'Ferme le fichier en lecture.', 46),
  command('CLOSEOUT', 'CLOSEOUT', 'Ferme le fichier en écriture.', 48),
  command('CLS', 'CLS #stream', 'Efface une fenêtre texte.', 50),
  command('DATA', 'DATA constants', 'Stocke les constantes lues par READ.', 58),
  command('DIM', 'DIM array(size)', 'Réserve un tableau.', 70),
  command('DRAW', 'DRAW x,y,ink', 'Trace jusqu’à une position graphique.', 72),
  command('END', 'END', 'Termine le programme.', 80),
  command('FOR', 'FOR variable=start TO end STEP size', 'Commence une boucle terminée par NEXT.', 102),
  command('GOSUB', 'GOSUB line', 'Appelle un sous-programme terminé par RETURN.', 106),
  command('GOTO', 'GOTO line', 'Transfère l’exécution vers une ligne BASIC.', 108),
  command('IF', 'IF expression THEN statement ELSE statement', 'Exécution conditionnelle.', 114),
  command('INK', 'INK number,colour', 'Associe une couleur à une encre.', 116),
  fn('INKEY$', 'INKEY$', 'Lit une touche ou renvoie une chaîne vide.', 120),
  command('INPUT', 'INPUT variable', 'Lit une valeur ; voir la référence pour les flux et invites.', 124),
  fn('LEN', 'LEN(string)', 'Longueur d’une chaîne.', 145),
  command('LET', 'LET variable=expression', 'Affectation explicite.', 147),
  command('LOAD', 'LOAD filename,address', 'Charge un programme ou un binaire.', 153),
  command('LOCATE', 'LOCATE x,y', 'Positionne le curseur texte.', 155),
  command('MEMORY', 'MEMORY address', 'Fixe la limite supérieure de mémoire BASIC.', 165),
  command('MODE', 'MODE number', 'Sélectionne le mode graphique CPC (0, 1 ou 2).', 173),
  command('MOVE', 'MOVE x,y', 'Déplace le curseur graphique.', 175),
  command('NEXT', 'NEXT variable', 'Termine une boucle FOR.', 181),
  command('ON', 'ON expression GOTO lines', 'Branchement ou gestion d’événement ; consulter les variantes.', 183),
  command('OPENIN', 'OPENIN "filename"', 'Ouvre un fichier en lecture.', 195),
  command('OPENOUT', 'OPENOUT "filename"', 'Ouvre un fichier en écriture.', 197),
  command('ORIGIN', 'ORIGIN x,y', 'Fixe l’origine des coordonnées graphiques.', 199),
  command('PAPER', 'PAPER ink', 'Encre de fond texte.', 203),
  fn('PEEK', 'PEEK(address)', 'Lit un octet mémoire.', 205),
  command('PEN', 'PEN ink', 'Encre du texte.', 207),
  fn('PI', 'PI', 'Constante π.', 209),
  command('PLOT', 'PLOT x,y,ink', 'Place un point graphique.', 211),
  command('POKE', 'POKE address,value', 'Écrit un octet mémoire.', 215),
  command('PRINT', 'PRINT expression', 'Affiche une expression ; ? est un raccourci.', 219),
  command('READ', 'READ variable', 'Lit les constantes DATA.', 225),
  command('REM', 'REM comment', 'Commentaire jusqu’à la fin de la ligne.', 229),
  command('RESTORE', 'RESTORE line', 'Repositionne la lecture DATA.', 235),
  command('RETURN', 'RETURN', 'Retour d’un sous-programme.', 239),
  command('RUN', 'RUN line', 'Exécute le listing courant ; la variante fichier est distincte.', 249),
  command('SOUND', 'SOUND channel,period,duration,volume', 'Produit un son ; paramètres d’enveloppe supplémentaires possibles.', 262),
  command('STOP', 'STOP', 'Interrompt l’exécution.', 274),
];

export const KEYWORDS = new Set([
  ...COMMANDS.map(card => card.name), 'THEN', 'ELSE', 'TO', 'STEP', 'AND', 'OR', 'XOR', 'NOT', 'MOD',
  // Additional keyword spellings present in the supplied reference (no hover signature claimed).
  'AUTO', 'BIN$', 'CHAIN', 'MERGE', 'CINT', 'CLEAR', 'CONT', 'COS', 'CREAL', 'DEF', 'FN', 'DEFINT',
  'DEFSTR', 'DEFREAL', 'DEG', 'DELETE', 'DI', 'DRAWR', 'EDIT', 'EI', 'ENT', 'ENV', 'EOF', 'ERASE',
  'ERR', 'ERL', 'ERROR', 'EVERY', 'EXP', 'FIX', 'FRE', 'HEX$', 'HIMEM', 'INKEY', 'INP', 'INT', 'JOY',
  'KEY', 'LEFT$', 'LINE', 'LIST', 'LOG', 'LOG10', 'LOWER$', 'MAX', 'MID$', 'MIN', 'MOVER', 'NEW',
  'BREAK', 'SQ', 'OUT', 'PLOTR', 'POS', 'RAD', 'RANDOMIZE', 'RELEASE', 'REMAIN', 'RENUM', 'RESUME',
  'RIGHT$', 'RND', 'ROUND', 'SAVE', 'SGN', 'SIN', 'SPACE$', 'SPEED', 'SQR', 'STR$', 'STRING$',
  'SYMBOL', 'TAB', 'TAG', 'TAGOFF', 'TEST', 'TESTR', 'TIME', 'TROFF', 'TRON', 'UPPER$', 'VAL',
  'VPOS', 'WAIT', 'WEND', 'WHILE', 'WIDTH', 'WINDOW', 'WRITE', 'ZONE',
]);
