import { useEffect, useRef } from 'react';
import { monaco, language } from './monaco-language.ts';
import { analyze, commandAt, type Diagnostic } from '../../../packages/basic-language/src/language.ts';
import type { CommandCard } from '../../../packages/basic-language/src/catalog.ts';

interface Props {
  documents: { id: string; source: string }[]; activeId: string; diagnostics: Diagnostic[]; busy: boolean;
  onChange(id: string, source: string): void; onCommand(card: CommandCard | undefined): void;
  onPosition(line: number, column: number): void;
  onSave(): void; onReady(editor: monaco.editor.IStandaloneCodeEditor): void;
  onRenumber(): void; onPalette(): void; onExport(): void;
}
export function Editor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const latest = useRef(props);
  const models = useRef(new Map<string, { model: monaco.editor.ITextModel; change: monaco.IDisposable; view: monaco.editor.ICodeEditorViewState | null }>());
  const active = useRef<string | undefined>(undefined);
  latest.current = props;
  useEffect(() => {
    if (!host.current) return;
    const editor = monaco.editor.create(host.current, {
      model: null, theme: 'cpc-workbench', automaticLayout: true, fontSize: 16, fontFamily: 'Consolas, monospace',
      lineNumbers: 'on', minimap: { enabled: false }, scrollBeyondLastLine: false,
      tabSize: 2, wordWrap: 'on', ariaLabel: 'Listing Locomotive BASIC', editContext: false,
      quickSuggestions: { other: true, comments: false, strings: false },
      wordBasedSuggestions: 'off', renderWhitespace: 'selection',
    });
    instance.current = editor;
    const cursor = editor.onDidChangeCursorPosition(({ position }) => {
      const model = editor.getModel(); if (!model) return;
      latest.current.onCommand(commandAt(model.getLineContent(position.lineNumber), position.column - 1));
      latest.current.onPosition(position.lineNumber, position.column);
    });
    const save = editor.addAction({ id: 'save-listing', label: 'Enregistrer le listing', contextMenuGroupId: '2_cpc', contextMenuOrder: 1, keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS], run: () => latest.current.onSave() });
    const actions = [
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
    return () => {
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
  useEffect(() => { instance.current?.updateOptions({ readOnly: props.busy }); }, [props.busy]);
  useEffect(() => {
    const model = instance.current?.getModel();
    if (model) monaco.editor.setModelMarkers(model, language, props.diagnostics.map(d => ({
      startLineNumber: d.line, endLineNumber: d.line, startColumn: d.start + 1, endColumn: d.end + 1,
      message: d.message, code: d.code, severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, source: 'Analyse partielle / export ASCII',
    })));
  }, [props.diagnostics, props.activeId]);
  return <div className="editor-host" ref={host} />;
}
