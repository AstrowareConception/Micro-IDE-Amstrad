import { useEffect, useRef } from 'react';
import { monaco, language } from './monaco-language.ts';
import { analyze, commandAt, type Diagnostic } from '../../../packages/basic-language/src/language.ts';
import type { CommandCard } from '../../../packages/basic-language/src/catalog.ts';

interface Props {
  source: string; diagnostics: Diagnostic[]; busy: boolean;
  onChange(source: string): void; onCommand(card: CommandCard | undefined): void;
  onPosition(line: number, column: number): void;
  onSave(): void; onReady(editor: monaco.editor.IStandaloneCodeEditor): void;
}
export function Editor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    instance.current?.updateOptions({ readOnly: props.busy });
  }, [props.busy]);
  useEffect(() => {
    if (!host.current) return;
    const model = monaco.editor.createModel(latest.current.source, language);
    const editor = monaco.editor.create(host.current, {
      model, theme: 'cpc-workbench', automaticLayout: true, fontSize: 16, fontFamily: 'Consolas, monospace',
      lineNumbers: 'on', minimap: { enabled: false }, scrollBeyondLastLine: false,
      tabSize: 2, wordWrap: 'on', ariaLabel: 'Listing Locomotive BASIC', editContext: false,
      quickSuggestions: { other: true, comments: false, strings: false },
      wordBasedSuggestions: 'off', renderWhitespace: 'selection',
    });
    instance.current = editor;
    const change = model.onDidChangeContent(() => latest.current.onChange(model.getValue()));
    const cursor = editor.onDidChangeCursorPosition(({ position }) => {
      latest.current.onCommand(commandAt(model.getLineContent(position.lineNumber), position.column - 1));
      latest.current.onPosition(position.lineNumber, position.column);
    });
    const save = editor.addAction({ id: 'save-listing', label: 'Enregistrer le listing', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS], run: () => latest.current.onSave() });
    const navigate = editor.addAction({ id: 'basic-goto-line', label: 'Aller à la cible BASIC', keybindings: [monaco.KeyCode.F12], run: () => {
      const position = editor.getPosition();
      if (!position) return;
      const analysis = analyze(model.getValue());
      const reference = analysis.references.find(ref => ref.line === position.lineNumber && ref.start <= position.column - 1 && position.column - 1 <= ref.end);
      const target = analysis.targets.find(item => item.number === reference?.number);
      if (target) { editor.setPosition({ lineNumber: target.line, column: target.start + 1 }); editor.revealLineInCenter(target.line); }
    } });
    latest.current.onReady(editor);
    return () => { navigate.dispose(); save.dispose(); cursor.dispose(); change.dispose(); editor.dispose(); model.dispose(); instance.current = null; };
  }, []);
  useEffect(() => {
    const model = instance.current?.getModel();
    if (model && model.getValue() !== props.source) model.setValue(props.source);
  }, [props.source]);
  useEffect(() => {
    const model = instance.current?.getModel();
    if (model) monaco.editor.setModelMarkers(model, language, props.diagnostics.map(d => ({
      startLineNumber: d.line, endLineNumber: d.line, startColumn: d.start + 1, endColumn: d.end + 1,
      message: d.message, code: d.code, severity: monaco.MarkerSeverity.Error, source: 'Analyse partielle / export ASCII',
    })));
  }, [props.diagnostics]);
  return <div className="editor-host" ref={host} />;
}
