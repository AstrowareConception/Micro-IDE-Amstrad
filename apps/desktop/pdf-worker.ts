import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDF_PAGE_LIMIT, PDF_PAGE_TEXT_LIMIT, PDF_TEXT_LIMIT } from '../../packages/workspace/src/pdf.ts';

// No URLs, built-in resource reads, rendering, annotations, attachments or scripting APIs.
class NoExternalData { async fetch(): Promise<never> { throw new Error('External PDF data disabled.'); } }
globalThis.fetch = async () => { throw new Error('PDF network disabled.'); };
const loading = getDocument({ data: workerData as Uint8Array, verbosity: 0, disableFontFace: true, useSystemFonts: false, useWorkerFetch: false,
  BinaryDataFactory: NoExternalData, useWasm: false, stopAtErrors: true, isOffscreenCanvasSupported: false, isImageDecoderSupported: false, maxImageSize: 0 });
try {
  const pdf = await loading.promise;
  if (pdf.numPages < 1 || pdf.numPages > PDF_PAGE_LIMIT) throw new Error('quota');
  const pages: { page: number; text: string }[] = []; let total = 0;
  for (let page = 1; page <= pdf.numPages; page++) {
    const documentPage = await pdf.getPage(page);
    const reader = documentPage.streamTextContent().getReader(); let text = '', size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        for (const item of chunk.value.items) {
          if (!('str' in item)) continue;
          const part = item.str.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ') + (item.hasEOL ? '\n' : ' ');
          size += Buffer.byteLength(part);
          if (size > PDF_PAGE_TEXT_LIMIT || total + size > PDF_TEXT_LIMIT) throw new Error('quota');
          text += part;
        }
      }
    } finally { await reader.cancel().catch(() => undefined); documentPage.cleanup(); }
    total += size; pages.push({ page, text: text.trimEnd() });
  }
  parentPort?.postMessage({ pageCount: pdf.numPages, pages, extraction: 'pdfjs-text-v1' });
} catch (error) {
  parentPort?.postMessage({ error: error instanceof Error && error.name === 'PasswordException' ? 'encrypted' : error instanceof Error && error.message === 'quota' ? 'quota' : 'invalid' });
} finally { await loading.destroy(); }
