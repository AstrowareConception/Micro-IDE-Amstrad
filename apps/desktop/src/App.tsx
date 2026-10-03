import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { analyze } from '../../../packages/basic-language/src/language.ts';
import { COMMANDS, type CommandCard } from '../../../packages/basic-language/src/catalog.ts';
import { files, type Failure, type FileResult } from './port.ts';
import { Editor } from './Editor.tsx';
import { monaco, provenance } from './monaco-language.ts';

const SAMPLE = '10 REM MICRO IDE AMSTRAD\n20 MODE 1\n30 INK 0,0:INK 1,24\n40 PEN 1\n50 PRINT "BONJOUR CPC 6128 !"\n60 FOR I=1 TO 5\n70 PRINT "LOCOMOTIVE BASIC";I\n80 NEXT I\n90 END\n';

export function App() {
  const [source, setSource] = useState(SAMPLE);
  const [saved, setSaved] = useState(SAMPLE);
  const [name, setName] = useState('MAIN.bas');
  const [status, setStatus] = useState('Prêt. Écrivez du BASIC, sans ROM ni connexion.');
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<CommandCard | undefined>();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const deferredSource = useDeferredValue(source);
  const analysis = useMemo(() => analyze(deferredSource), [deferredSource]);
  const dirty = source !== saved;
  useEffect(() => { files.setDirty(dirty); }, [dirty]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty && !window.desktop) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  async function perform(action: () => Promise<FileResult | Failure | null>, message: string, commit = false) {
    if (busy) return;
    setBusy(true);
    const snapshot = source;
    try {
      const result = await action();
      if (!result) { setStatus('Opération annulée.'); return; }
      if ('error' in result) { setStatus(result.error); return; }
      if (commit) { setSaved(snapshot); setName(result.name); }
      setStatus(`${message} : ${result.name}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Échec de l’opération.'); }
    finally { setBusy(false); }
  }
  async function open() {
    if (busy || (dirty && !window.confirm('Abandonner les modifications non enregistrées ?'))) return;
    setBusy(true);
    try {
      const result = await files.open();
      if (!result) return;
      if ('error' in result) { setStatus(result.error); return; }
      if (result.source !== undefined) { setSource(result.source); setSaved(result.source); setName(result.name); setStatus(`Listing ouvert : ${result.name}`); }
    } catch (error) { setStatus(String(error)); }
    finally { setBusy(false); }
  }
  return <main className="workbench">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">μ</span><div><h1>Micro IDE <span>Amstrad</span></h1><p>Atelier Locomotive BASIC · alpha 0.4</p></div></div>
      <span className="profile">CPC 6128 · BASIC 1.1</span>
    </header>
    <nav className="toolbar" aria-label="Actions du listing">
      <button disabled={busy} onClick={() => void open()}>Ouvrir</button>
      <button disabled={busy} onClick={() => void perform(() => files.save(source), 'Listing enregistré', true)}>Enregistrer <kbd>Ctrl S</kbd></button>
      <button disabled={busy} onClick={() => void perform(() => files.save(source, true), 'Listing enregistré', true)}>Enregistrer sous</button>
      <button className="primary" disabled={busy} onClick={() => void perform(() => files.exportDisk(source), 'DSK DATA construit — validation structurelle uniquement')}>Exporter DSK</button>
      <button onClick={() => { editor.current?.focus(); void editor.current?.getAction('editor.action.triggerSuggest')?.run(); }}>Compléter <kbd>Ctrl Espace</kbd></button>
    </nav>
    <div className="workspace">
      <section className="listing" aria-label="Éditeur">
        <div className="tab"><span className="dot" /> {name}{dirty ? ' • modifié' : ''}<span className="encoding">UTF-8 · LF</span></div>
        <Editor source={source} diagnostics={analysis.diagnostics} busy={busy} onChange={setSource} onCommand={setCard}
          onPosition={(line, column) => setPosition({ line, column })}
          onSave={() => void perform(() => files.save(source), 'Listing enregistré', true)} onReady={value => { editor.current = value; }} />
        <div className="problems"><h2>Diagnostics <span>{analysis.diagnostics.length}</span></h2>
          <p className="muted">Analyse partielle : numéros, chaînes, cibles littérales et contraintes d’export. Un listing sans diagnostic n’est pas garanti exécutable.</p>
          {analysis.diagnostics.length ? <ul>{analysis.diagnostics.map((d, i) => <li key={`${d.line}-${d.start}-${i}`}><button onClick={() => {
            editor.current?.revealLineInCenter(d.line); editor.current?.setPosition({ lineNumber: d.line, column: d.start + 1 }); editor.current?.focus();
          }}>L{d.line} · {d.message}</button></li>)}</ul> : <p className="success">Aucun problème détecté dans le sous-ensemble analysé.</p>}
        </div>
      </section>
      <aside aria-label="Références et état du produit">
        <section className="panel"><h2>Référence BASIC</h2>
          <label htmlFor="command-search">Rechercher une commande</label>
          <input id="command-search" placeholder="PRINT, MODE, GOTO…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="command-list">{COMMANDS.filter(c => c.name.includes(query.toUpperCase())).map(c => <button className={card?.name === c.name ? 'selected' : ''} key={c.name} onClick={() => setCard(c)}>{c.name}</button>)}</div>
          <h3>{card?.name ?? 'Une aide à portée de curseur'}</h3>
          {card ? <><pre>{card.syntax}</pre><p>{card.description}</p><p className="muted">command-reference.txt · ligne {card.line}</p></> : <p>Survolez une commande, placez le curseur dessus ou choisissez une fiche.</p>}
          <p className="muted">{provenance}. Signatures indicatives, options non exhaustives.</p>
        </section>
        <section className="panel"><h2>Votre atelier</h2><p><kbd>F12</kbd> Aller à une ligne ciblée</p><p><kbd>Ctrl Z</kbd> Annuler une modification</p><p>La complétion reconnaît commandes, identifiants observés et numéros de lignes. Elle est désactivée dans les commentaires, chaînes ouvertes et DATA.</p></section>
        <section className="panel pending"><h2>Prochaines connexions</h2><p>Émulateur : qualification ROM en attente.</p><p>Agent IA : non connecté dans cette alpha.</p><p>Export : disquette DATA avec MAIN.BAS ASCII, pas une compilation Z80.</p></section>
      </aside>
    </div>
    <footer role="status">{busy ? 'Opération en cours…' : status}<span>L{position.line} · C{position.column} · {window.desktop ? 'Bureau local' : 'Aperçu navigateur · enregistrement par téléchargement'}</span></footer>
  </main>;
}
