import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/editor/browser/coreCommands.js';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/editor/contrib/gotoSymbol/browser/goToCommands.js';
import 'monaco-editor/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.js';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/features/find/register.js';
import 'monaco-editor/features/linesOperations/register.js';
import 'monaco-editor/features/multicursor/register.js';
import 'monaco-editor/features/gotoError/register.js';
import 'monaco-editor/features/folding/register.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { COMMANDS, REFERENCE } from '../../../packages/basic-language/src/catalog.ts';
import { analyze, commandAt, completionContext, tokenize } from '../../../packages/basic-language/src/language.ts';

globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() };
const language = 'locomotive-basic';
monaco.languages.register({ id: language, extensions: ['.bas'], aliases: ['Locomotive BASIC 1.1'] });
monaco.languages.setLanguageConfiguration(language, {
  comments: { lineComment: "'" }, brackets: [['(', ')']],
  autoClosingPairs: [{ open: '(', close: ')', notIn: ['string', 'comment'] }],
  wordPattern: /[a-zA-Z][a-zA-Z0-9]*[$%!]?|\d+/g,
});
class LineState implements monaco.languages.IState {
  clone(): LineState { return this; }
  equals(other: monaco.languages.IState): boolean { return other instanceof LineState; }
}
monaco.languages.setTokensProvider(language, {
  getInitialState: () => new LineState(),
  tokenize: (line, state) => ({ endState: state, tokens: tokenize(line).map(t => ({ startIndex: t.start, scopes: t.kind })) }),
});
monaco.editor.defineTheme('cpc-workbench', {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: 'keyword', foreground: '7DCEFF' }, { token: 'number', foreground: 'F0BD70' },
    { token: 'string', foreground: 'ADE5B0' }, { token: 'comment', foreground: '829383', fontStyle: 'italic' },
    { token: 'data', foreground: 'CAB4F0' }, { token: 'identifier', foreground: 'E5EBF3' },
  ], colors: { 'editor.background': '#111821', 'editorLineNumber.foreground': '#596878', 'editor.lineHighlightBackground': '#172331' },
});
export const provenance = `Référence fournie · ${REFERENCE.id} · ${REFERENCE.version} · sous-ensemble éditorial, non qualifié sur ROM`;
monaco.languages.registerCompletionItemProvider(language, {
  triggerCharacters: [' ', '$'],
  provideCompletionItems: (model, position) => {
    const line = model.getLineContent(position.lineNumber);
    const context = completionContext(line, position.column - 1);
    if (context === 'none') return { suggestions: [] };
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    const analysis = analyze(model.getValue());
    if (context === 'target') return { suggestions: analysis.targets.map(target => ({
      label: String(target.number), kind: monaco.languages.CompletionItemKind.Reference,
      insertText: String(target.number), detail: `Ligne BASIC · position ${target.line}`, range,
    })) };
    return { suggestions: [
      ...COMMANDS.map(card => ({ label: card.name, insertText: card.name,
        kind: card.kind === 'function' ? monaco.languages.CompletionItemKind.Function : monaco.languages.CompletionItemKind.Keyword,
        detail: card.syntax, documentation: { value: `${card.description}\n\n${provenance}\n\nLocalisation : command-reference.txt, ligne ${card.line}` }, range,
      })),
      ...analysis.variables.filter(name => name !== word.word.toUpperCase()).map(name => ({ label: name, insertText: name, kind: monaco.languages.CompletionItemKind.Variable, detail: 'Identifiant observé (pas une déclaration vérifiée)', range })),
    ] };
  },
});
monaco.languages.registerHoverProvider(language, {
  provideHover: (model, position) => {
    const card = commandAt(model.getLineContent(position.lineNumber), position.column - 1);
    if (!card) return null;
    return { contents: [{ value: `**${card.name}**\n\n\`\`\`text\n${card.syntax}\n\`\`\`\n${card.description}\n\n${provenance}\n\ncommand-reference.txt:${card.line}` }] };
  },
});
monaco.languages.registerDefinitionProvider(language, {
  provideDefinition: (model, position) => {
    const analysis = analyze(model.getValue());
    const reference = analysis.references.find(ref => ref.line === position.lineNumber && ref.start <= position.column - 1 && position.column - 1 <= ref.end);
    const target = analysis.targets.find(t => t.number === reference?.number);
    return target ? { uri: model.uri, range: new monaco.Range(target.line, target.start + 1, target.line, target.end + 1) } : null;
  },
});
export { monaco, language };
