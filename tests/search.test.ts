import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSources, previewReplacement, verifySearchSnapshot } from '../packages/workspace/src/search.ts';
const options = { query: 'PRINT', matchCase: false, wholeWord: false };
const documents = [{ id: 'main', name: 'src/main.bas', source: '10 print "PRINT"\r\n20 END\n' }, { id: 'util', name: 'src/util.bas', source: '10 PRINT "X"\n' }];
test('search covers unsaved snapshots and gives UTF-16 offsets and physical positions', () => {
  const found = searchSources(documents, options);
  assert.equal(found.matches.length, 3);
  assert.deepEqual(found.matches.map(item => [item.documentId, item.line, item.column]), [['main', 1, 4], ['main', 1, 11], ['util', 1, 4]]);
  const unicode = searchSources([{ id: 'u', name: 'u', source: 'ß😀\n10 print' }], options).matches[0]!;
  assert.equal(unicode.start, 7); assert.equal(unicode.line, 2); assert.equal(unicode.column, 4);
  assert.equal(searchSources(documents, { ...options, matchCase: true }).matches.length, 2);
});
test('whole words account for BASIC suffixes and Unicode neighbours', () => {
  const found = searchSources([{ id: 'x', name: 'x', source: 'A A$ A% A! AB ÉA Aé A.A :A:' }], { ...options, query: 'a', wholeWord: true });
  assert.equal(found.matches.length, 2);
});
test('replacement is literal, nonoverlapping, excludes no-ops and preserves snapshots', () => {
  const found = searchSources(documents, options), changes = previewReplacement(found, '$&');
  assert.equal(changes[0]!.after, '10 $& "$&"\r\n20 END\n');
  assert.equal(changes[1]!.after, '10 $& "X"\n');
  assert.equal(documents[0]!.source, found.documents[0]!.source);
  assert.deepEqual(previewReplacement(searchSources(documents, { ...options, matchCase: true }), 'PRINT'), []);
  const repeated = searchSources([{ id: 'x', name: 'x', source: 'aaaaa' }], { ...options, query: 'aa' });
  assert.equal(previewReplacement(repeated, 'b')[0]!.after, 'bba');
});
test('a changed, removed, renamed or added scoped source invalidates the complete snapshot', () => {
  const found = searchSources(documents, options);
  verifySearchSnapshot(found, documents.map(item => ({ ...item })));
  for (const current of [documents.slice(1), [...documents, { id: 'other', name: 'other', source: '' }], documents.map(item => item.id === 'util' ? { ...item, source: 'changed' } : item), documents.map(item => ({ ...item, name: 'renamed' }))])
    assert.throws(() => verifySearchSnapshot(found, current), /modifiées/);
});
test('bounds reject incomplete results and excessive output without mutation', () => {
  assert.throws(() => searchSources(documents, { ...options, query: '' }), /Recherche requise/);
  assert.throws(() => searchSources([...documents, documents[0]!], options), /distinctes/);
  assert.throws(() => searchSources([{ id: 'x', name: 'x', source: 'x'.repeat(1001) }], { ...options, query: 'x' }), /1 000/);
  assert.throws(() => searchSources([{ id: 'x', name: 'x', source: 'x'.repeat(1024 * 1024 + 1) }], options), /1 Mio/);
  assert.throws(() => previewReplacement(searchSources(documents, options), '\n'), /une ligne/);
  const found = searchSources([{ id: 'x', name: 'x', source: 'x'.repeat(1000) }], { ...options, query: 'x' });
  assert.throws(() => previewReplacement(found, 'y'.repeat(4096)), /supérieure/);
});
