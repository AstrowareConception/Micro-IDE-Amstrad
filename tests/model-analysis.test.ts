import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedModelAnalysis, indexModelAnalysis, awaitModelAnalysis, releaseModelAnalysis } from '../apps/desktop/src/model-analysis.ts';
import { analyzeEditor } from '../packages/basic-language/src/syntax.ts';
test('Monaco index serves only the exact version and resolves explicit navigation without reparsing', async () => {
 let version = 1; const model = { uri: { toString: () => 'test://model' }, getVersionId: () => version };
 const analysis = analyzeEditor('10 GOTO 20\n20 END');
 assert.equal(cachedModelAnalysis(model), undefined);
 const waiting = awaitModelAnalysis(model); indexModelAnalysis(model, analysis); assert.equal(await waiting, analysis);
 version++; assert.equal(cachedModelAnalysis(model), undefined);
 const stale = awaitModelAnalysis(model); version++; indexModelAnalysis(model, undefined); assert.equal(await stale, undefined);
 const disposed = awaitModelAnalysis(model); releaseModelAnalysis(model); assert.equal(await disposed, undefined);
});
