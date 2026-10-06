// Reproducible bounded parser measurement, not a claim about the renderer or CPU percentage.
import { cpus, platform, arch } from 'node:os';
import { createAnalysisEngine } from '../packages/basic-language/src/analysis-service.ts';
const source = Array.from({ length: 5000 }, (_, i) => `${(i + 1) * 10} A${i % 16}=B+${i}`).join('\n');
const cold = [], warm = []; let reused = 0;
for (let i = 0; i < 12; i++) {
 const inspect = createAnalysisEngine();
 const first = inspect({ id: 'benchmark', revision: 1, source });
 const second = inspect({ id: 'benchmark', revision: 2, source: source.replace('B+100\n', 'B+101\n') });
 cold.push(first.durationMs); warm.push(second.durationMs); reused = second.cacheHits;
 if (first.analysis.diagnostics.length || second.analysis.diagnostics.length) throw new Error('Unexpected benchmark diagnostics');
}
const stats = values => { const sorted = values.toSorted((a, b) => a - b); return { medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(2), p95Ms: +sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2) }; };
console.log(JSON.stringify({ node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, lines: 5000, characters: source.length, trials: cold.length, cold: stats(cold), oneLineEdit: stats(warm), reusedLines: reused, includesWorkerTransport: false, includesDebounce: false }, null, 2));
