import { parentPort, workerData } from 'node:worker_threads';
import { inspectDataDisk } from '../../packages/cpc-disk/src/import-disk.ts';
try { parentPort?.postMessage({ result: inspectDataDisk(workerData) }); }
catch (error) { parentPort?.postMessage({ error: error instanceof Error ? error.message : 'Disquette invalide.' }); }
