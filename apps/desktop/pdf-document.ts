import { Worker } from 'node:worker_threads';
import { DOCUMENT_LIMIT, type PdfTextPreview } from '../../packages/workspace/src/project.ts';
import { validatePdfText } from '../../packages/workspace/src/pdf.ts';

/** A bounded thread, not an OS sandbox. Only verified bytes enter; no project paths or secrets. */
export async function extractPdf(bytes: Uint8Array, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<PdfTextPreview> {
  if (bytes.length > DOCUMENT_LIMIT || new TextDecoder().decode(bytes.subarray(0, 8)).match(/^%PDF-\d\.\d/) === null) throw new Error('PDF : signature invalide ou fichier supérieur à 1 Mio.');
  const timeout = options.timeoutMs ?? 15000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 15000) throw new Error('PDF : délai invalide.');
  if (options.signal?.aborted) throw new Error('PDF : extraction annulée.');
  const url = new URL(import.meta.url.endsWith('.ts') ? './pdf-worker.ts' : './pdf-worker.js', import.meta.url);
  const worker = new Worker(url, { workerData: new Uint8Array(bytes), env: {}, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 }, stdout: true, stderr: true });
  // PDF.js diagnostics may contain untrusted text; never forward them to application logs.
  worker.stdout.resume(); worker.stderr.resume();
  try {
    return await new Promise<PdfTextPreview>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, result?: unknown) => {
        if (settled) return; settled = true; clearTimeout(timer); options.signal?.removeEventListener('abort', abort);
        if (error) reject(error);
        else { try { resolve(validatePdfText(result)); } catch (error) { reject(error); } }
      };
      const abort = () => finish(new Error('PDF : extraction annulée.'));
      const timer = setTimeout(() => finish(new Error('timeout : extraction PDF arrêtée après le délai autorisé.')), timeout);
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
      worker.once('error', () => finish(new Error('PDF : worker interrompu ou budget mémoire dépassé.')));
      worker.once('exit', () => finish(new Error('PDF : worker terminé sans résultat.')));
      worker.once('message', (message: unknown) => {
        if (message && typeof message === 'object' && 'error' in message) {
          const code = (message as { error: unknown }).error;
          finish(new Error(code === 'encrypted' ? 'PDF chiffré refusé : aucun mot de passe demandé ou transmis.' : code === 'quota' ? 'quota-exceeded : PDF limité à 20 pages, 64 Kio/page et 256 Kio de texte.' : 'PDF invalide ou texte non extractible par ce décodeur.'));
        } else finish(undefined, message);
      });
    });
  } finally { await worker.terminate(); }
}
