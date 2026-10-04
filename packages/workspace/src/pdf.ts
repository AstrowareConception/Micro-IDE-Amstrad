import type { PdfTextPreview } from './project.ts';

export const PDF_PAGE_LIMIT = 20;
export const PDF_PAGE_TEXT_LIMIT = 64 * 1024;
export const PDF_TEXT_LIMIT = 256 * 1024;
/** Validate a decoder result before it crosses the host/application boundary. */
export function validatePdfText(value: unknown): PdfTextPreview {
  if (!value || typeof value !== 'object') throw new Error('PDF : résultat d’extraction invalide.');
  const preview = value as PdfTextPreview;
  if (preview.extraction !== 'pdfjs-text-v1' || !Number.isInteger(preview.pageCount) || preview.pageCount < 1 || preview.pageCount > PDF_PAGE_LIMIT || !Array.isArray(preview.pages) || preview.pages.length !== preview.pageCount) throw new Error('PDF : 1 à 20 pages requises.');
  let total = 0;
  const pages = preview.pages.map((page, index) => {
    if (!page || page.page !== index + 1 || typeof page.text !== 'string' || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\r]/.test(page.text)) throw new Error('PDF : texte ou numérotation invalide.');
    const size = new TextEncoder().encode(page.text).length; total += size;
    if (size > PDF_PAGE_TEXT_LIMIT || total > PDF_TEXT_LIMIT) throw new Error('quota-exceeded : texte PDF limité à 64 Kio/page et 256 Kio/document.');
    return { page: page.page, text: page.text };
  });
  return { pageCount: pages.length, pages, extraction: 'pdfjs-text-v1' };
}
