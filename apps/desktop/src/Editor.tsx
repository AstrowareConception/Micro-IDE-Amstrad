import type { Preferences } from './preferences.ts';
import { useEffect, useRef } from 'react';
import { monaco, language } from './monaco-language.ts';
import { analyze, commandAt, type Diagnostic } from '../../../packages/basic-language/src/language.ts';
import type { CommandCard } from '../../../packages/basic-language/src/catalog.ts';
import type { SearchChange, SearchMatch } from '../../../packages/workspace/src/search.ts';

export interface EditorWorkspace { apply(changes: SearchChange[]): void; source(id: string): string | undefined }

interface Props {
  preferences: Preferences;
  documents: { id: string; source: string }[]; activeId: string; diagnostics: Diagnostic[]; busy: boolean;
  onChange(id: string, source: string): void; onCommand(card: CommandCard | undefined): void;
  onPosition(line: number, column: number): void;
  onSave(): void; onReady(editor: monaco.editor.IStandaloneCodeEditor): void;
  onRenumber(): void; onPalette(): void; onExport(): void;
  onWorkspaceReady(workspace: EditorWorkspace | undefined): void;
  navigation: SearchMatch | undefined;
}
export function Editor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const latest = useRef(props);
  const models = useRef(new Map<string, { model: monaco.editor.ITextModel; change: monaco.IDisposable; view: monaco.editor.ICodeEditorViewState | null }>());
  const active = useRef<string | undefined>(undefined);
  const markerDecorations = useRef<monaco.editor.IEditorDecorationsCollection | undefined>(undefined);
  const appliedNavigation = useRef<SearchMatch | undefined>(undefined);
  latest.current = props;
  useEffect(() => {
    if (!host.current) return;
    const editor = monaco.editor.create(host.current, {
      model: null, theme: 'cpc-workbench', automaticLayout: true, fontSize: 16, fontFamily: 'Consolas, monospace',
      lineNumbers: 'on', minimap: { enabled: false }, scrollBeyondLastLine: false, glyphMargin: true, renderValidationDecorations: 'on', mouseWheelZoom: false,
      tabSize: 2, wordWrap: 'on', ariaLabel: 'Listing Locomotive BASIC', editContext: false,
      quickSuggestions: { other: true, comments: false, strings: false },
      wordBasedSuggestions: 'off', renderWhitespace: 'selection',
    });
    instance.current = editor;
    markerDecorations.current = editor.createDecorationsCollection();
    const cursor = editor.onDidChangeCursorPosition(({ position }) => {
      const model = editor.getModel(); if (!model) return;
      latest.current.onCommand(commandAt(model.getLineContent(position.lineNumber), position.column - 1));
      latest.current.onPosition(position.lineNumber, position.column);
    });
    const save = editor.addAction({ id: 'save-listing', label: 'Enregistrer le listing', contextMenuGroupId: '2_cpc', contextMenuOrder: 1, run: () => latest.current.onSave() });
    const navigateProblem = (reverse: boolean) => {
      const position = editor.getPosition(), diagnostics = latest.current.diagnostics; if (!position || !diagnostics.length) return;
      const ordered = reverse ? [...diagnostics].reverse() : diagnostics;
      const diagnostic = ordered.find(item => reverse ? item.line < position.lineNumber || (item.line === position.lineNumber && item.start + 1 < position.column) : item.line > position.lineNumber || (item.line === position.lineNumber && item.start + 1 > position.column)) ?? ordered[0]!;
      editor.setPosition({ lineNumber: diagnostic.line, column: diagnostic.start + 1 }); editor.revealLineInCenter(diagnostic.line); editor.focus();
    };
    const actions = [
      editor.addAction({ id: 'basic-comment', label: 'Commenter / décommenter les lignes BASIC', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash], run: () => {
        const model = editor.getModel(), selection = editor.getSelection(); if (!model || !selection || latest.current.busy) return;
        const last = selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber ? selection.endLineNumber - 1 : selection.endLineNumber;
        const lines = Array.from({ length: last - selection.startLineNumber + 1 }, (_, offset) => selection.startLineNumber + offset);
        const values = lines.map(line => model.getLineContent(line));
        const remove = values.every(text => /^\s*\d+\s*'/.test(text));
        const edits = lines.map((line, index) => ({ range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)), text: values[index]!.replace(/^(\s*\d+\s*)(.*)$/, (_, prefix: string, body: string) => prefix + (remove ? body.replace(/^' ?/, '') : "' " + body)) }));
        editor.pushUndoStop(); editor.executeEdits('basic-comment', edits); editor.pushUndoStop();
      } }),
      editor.addAction({ id: 'cpc-next-problem', label: 'Problème suivant', keybindings: [monaco.KeyCode.F8], run: () => navigateProblem(false) }),
      editor.addAction({ id: 'cpc-previous-problem', label: 'Problème précédent', keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F8], run: () => navigateProblem(true) }),
      editor.addAction({ id: 'cpc-renumber', label: 'Renuméroter le BASIC…', contextMenuGroupId: '2_cpc', contextMenuOrder: 2, run: () => { if (!latest.current.busy) latest.current.onRenumber(); } }),
      editor.addAction({ id: 'cpc-export', label: 'Exporter le projet en DSK…', contextMenuGroupId: '2_cpc', contextMenuOrder: 3, run: () => { if (!latest.current.busy) latest.current.onExport(); } }),
      editor.addAction({ id: 'cpc-commands', label: 'Commandes CPCéleste…', contextMenuGroupId: '2_cpc', contextMenuOrder: 4, run: () => latest.current.onPalette() }),
    ];
    const navigate = editor.addAction({ id: 'basic-goto-line', label: 'Aller à la cible BASIC', contextMenuGroupId: 'navigation', contextMenuOrder: 1, keybindings: [monaco.KeyCode.F12], run: () => {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (!position || !model) return;
      const analysis = analyze(model.getValue());
      const reference = analysis.references.find(ref => ref.line === position.lineNumber && ref.start <= position.column - 1 && position.column - 1 <= ref.end);
      const target = analysis.targets.find(item => item.number === reference?.number);
      if (target) { editor.setPosition({ lineNumber: target.line, column: target.start + 1 }); editor.revealLineInCenter(target.line); }
    } });
    latest.current.onReady(editor);
    latest.current.onWorkspaceReady({ source: id => models.current.get(id)?.model.getValue(), apply(changes) {
      if (latest.current.busy) throw new Error('Atelier occupé.');
      if (!changes.length || new Set(changes.map(change => change.id)).size !== changes.length) throw new Error('Sélection de sources invalide.');
      const edits = changes.map(change => {
        const model = models.current.get(change.id)?.model;
        if (!model || model.getValue() !== change.before) throw new Error('Source modifiée depuis l’aperçu : relancez la recherche.');
        return { model, text: change.after };
      });
      for (const { model, text } of edits) {
        model.pushStackElement();
        model.pushEditOperations(null, [{ range: model.getFullModelRange(), text }], () => null);
        model.pushStackElement();
      }
    } });
    return () => {
      latest.current.onWorkspaceReady(undefined);
      for (const action of actions) action.dispose(); navigate.dispose(); save.dispose(); cursor.dispose(); editor.dispose();
      for (const item of models.current.values()) { item.change.dispose(); item.model.dispose(); }
      models.current.clear(); active.current = undefined; instance.current = null;
    };
  }, []);
  useEffect(() => {
    const editor = instance.current; if (!editor) return;
    for (const document of props.documents) {
      let item = models.current.get(document.id);
      if (!item) {
        const model = monaco.editor.createModel(document.source, language);
        item = { model, change: model.onDidChangeContent(() => latest.current.onChange(document.id, model.getValue())), view: null };
        models.current.set(document.id, item);
      } else if (item.model.getValue() !== document.source) item.model.setValue(document.source);
    }
    if (active.current !== props.activeId) {
      const previous = active.current ? models.current.get(active.current) : undefined;
      if (previous) previous.view = editor.saveViewState();
      const next = models.current.get(props.activeId);
      editor.setModel(next?.model ?? null); active.current = props.activeId;
      if (next?.view) editor.restoreViewState(next.view);
      editor.focus();
    }
    for (const [id, item] of models.current) {
      if (!props.documents.some(document => document.id === id)) { item.change.dispose(); item.model.dispose(); models.current.delete(id); }
    }
  }, [props.documents, props.activeId]);
  useEffect(() => {
    const match = props.navigation, editor = instance.current;
    if (!match || !editor || match === appliedNavigation.current || match.documentId !== props.activeId) return;
    const model = editor.getModel(); if (!model) return;
    const start = model.getPositionAt(match.start), end = model.getPositionAt(match.end);
    const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
    appliedNavigation.current = match;
    editor.setSelection(range); editor.revealRangeInCenter(range); editor.focus();
  }, [props.navigation, props.activeId]);
  useEffect(() => { instance.current?.updateOptions({ readOnly: props.busy }); }, [props.busy]);
  useEffect(() => {
    const p = props.preferences;
    instance.current?.updateOptions({ fontFamily: p.fontFamily, fontSize: p.fontSize, tabSize: p.tabSize, insertSpaces: p.insertSpaces, wordWrap: p.wordWrap ? 'on' : 'off', minimap: { enabled: p.minimap }, autoIndent: p.autoIndent ? 'advanced' : 'none', autoClosingBrackets: p.autoClosingBrackets ? 'languageDefined' : 'never', lineHeight: p.lineHeight, lineNumbers: p.lineNumbers, renderWhitespace: p.whitespace, cursorStyle: p.cursorStyle, cursorBlinking: p.cursorBlinking, fontLigatures: p.fontLigatures, guides: { indentation: p.indentGuides }, bracketPairColorization: { enabled: p.bracketColors }, rulers: p.ruler ? [p.ruler] : [] });
    for (const item of models.current.values()) item.model.updateOptions({ tabSize: p.tabSize, insertSpaces: p.insertSpaces });
  }, [props.preferences, props.activeId]);
  useEffect(() => {
    const model = instance.current?.getModel();
    if (model) monaco.editor.setModelMarkers(model, language, props.diagnostics.map(d => ({
      startLineNumber: d.line, endLineNumber: d.line, startColumn: d.start + 1, endColumn: d.end + 1,
      message: d.message, code: d.code, severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, source: 'Syntaxe BASIC / analyse partielle',
    })));
    markerDecorations.current?.set(props.diagnostics.map(d => ({ range: new monaco.Range(d.line, 1, d.line, 1), options: { glyphMarginClassName: d.severity === 'error' ? 'basic-error-glyph' : 'basic-warning-glyph', glyphMarginHoverMessage: { value: d.message }, overviewRuler: { color: d.severity === 'error' ? '#f48080' : '#ffbe76', position: monaco.editor.OverviewRulerLane.Right } } })));
  }, [props.diagnostics, props.activeId]);
  return <div className="editor-host" ref={host} />;
}
