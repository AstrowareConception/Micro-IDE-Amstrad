import type { ButtonHTMLAttributes, ReactNode } from 'react';
export type IconName = 'file' | 'folder' | 'save' | 'saveAll' | 'search' | 'replace' | 'run' | 'stop' | 'pause' | 'disk' | 'undo' | 'redo' | 'git' | 'history' | 'branch' | 'terminal' | 'code' | 'book' | 'chip' | 'spark' | 'settings' | 'close' | 'plus' | 'check' | 'warning' | 'download' | 'trash' | 'eye' | 'key' | 'zoom' | 'menu' | 'dock' | 'undock' | 'maximize' | 'restore' | 'grip' | 'resize' | 'upload' | 'github' | 'pullRequest';
const paths: Record<IconName, string> = {
 upload: 'M12 21V5 M7 10l5-5 5 5 M3 5V3h18v2',
 github: 'M9 19v3 M15 19v3 M7 4L5 2v6a7 7 0 0 0 14 0V2l-2 2 M5 16c-4 0-4-4-4-4',
 pullRequest: 'M6 3v14 M4 3h4 M4 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0 M18 17V9c0-3-4-4-6-4 M14 2l-3 3 3 3 M16 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
 file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
 folder: 'M3 6h7l2 3h9v11H3z', save: 'M4 3h14l3 3v15H3V3z M7 3v6h9V3 M7 21v-8h10v8',
 saveAll: 'M7 3h11l3 3v12H7z M10 3v5h6V3 M3 7v14h14',
 search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
 replace: 'M4 6h14l-3-3 M18 6l-3 3 M20 18H6l3 3 M6 18l3-3 M5 11h3 M16 13h3',
 run: 'M7 3l14 9-14 9z', stop: 'M5 5h14v14H5z', pause: 'M7 4v16 M17 4v16',
 disk: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M12 3v4',
 undo: 'M8 5L3 10l5 5 M3 10h11a6 6 0 0 1 0 12', redo: 'M16 5l5 5-5 5 M21 10H10a6 6 0 0 0 0 12',
 git: 'M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M6 7v10 M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 9v2c0 4-12 0-12 6',
 history: 'M3 4v6h6 M3 10a9 9 0 1 1 0 6 M12 7v6l4 2',
 branch: 'M6 3v18 M6 15c0-7 12-1 12-10 M3 3h6 M15 3h6 M3 21h6',
 terminal: 'M3 4h18v16H3z M6 8l4 4-4 4 M13 16h5',
 code: 'M8 5l-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18',
 book: 'M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2z M12 5v16',
 chip: 'M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
 spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
 settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
 close: 'M5 5l14 14 M19 5L5 19', plus: 'M12 4v16 M4 12h16',
 check: 'M4 12l5 5L20 5', warning: 'M12 3l10 18H2z M12 9v5 M12 17v1',
 download: 'M12 3v12 M7 10l5 5 5-5 M3 16v5h18v-5', trash: 'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M9 10v7 M15 10v7',
 eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 key: 'M9 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M13 13l8 8 M17 17l3-3',
 zoom: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6 M7 10h6 M10 7v6',
 menu: 'M4 6h16 M4 12h16 M4 18h16',
 dock: 'M3 3h18v18H3z M3 15h18 M8 7l4 4 4-4 M12 5v6',
 undock: 'M3 7v14h14 M9 3h12v12H9z M12 12l6-6 M14 6h4v4',
 maximize: 'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',
 restore: 'M8 3h13v13 M3 8h13v13H3z',
 grip: 'M8 5h1 M15 5h1 M8 12h1 M15 12h1 M8 19h1 M15 19h1',
 resize: 'M7 21L21 7 M13 21l8-8 M19 21l2-2',
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
 return <svg className={`icon ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
export function iconForLabel(label: string): IconName {
 const value = label.toLocaleLowerCase('fr');
 const choices: [RegExp, IconName][] = [[/paramètre|réglage/, 'settings'], [/proposer|amélioration/, 'plus'], [/problème|diagnostic/, 'warning'], [/annuler la modification/, 'undo'], [/fermer|annuler|masquer|écarter/, 'close'], [/github/, 'github'], [/pull request|\bpr\b/, 'pullRequest'], [/branche/, 'branch'], [/push/, 'upload'], [/fetch|pull|cloner/, 'download'], [/git|index|commit|dépôt/, 'git'], [/historique|version|checkpoint|récup|brouillon/, 'history'], [/clé/, 'key'], [/agent|mission/, 'spark'], [/terminal|système/, 'terminal'], [/rom|firmware/, 'chip'], [/disquette|dsk/, 'disk'], [/enregistrer tout/, 'saveAll'], [/enregistrer|sauvegard/, 'save'], [/rétablir/, 'redo'], [/remplac/, 'replace'], [/recherch/, 'search'], [/exécuter|lancer|reprendre/, 'run'], [/arrêter|interrompre/, 'stop'], [/pause/, 'pause'], [/import|export|télécharg/, 'download'], [/retirer|oubli|supprim/, 'trash'], [/ajouter|créer/, 'plus'], [/projet|explorateur/, 'folder'], [/référence|aide|commande basic/, 'book'], [/zoom|agrandir|réduire/, 'zoom'], [/vérifier|confirmer|appliquer|autoriser/, 'check'], [/source|listing|ouvrir/, 'file']];
 return choices.find(([pattern]) => pattern.test(value))?.[1] ?? 'code';
}
function textOf(value: ReactNode): string { return typeof value === 'string' ? value : Array.isArray(value) ? value.map(textOf).join(' ') : ''; }
export function Button({ icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
 return <button {...props}><Icon name={icon ?? iconForLabel(props['aria-label'] ?? textOf(children))} />{children}</button>;
}
