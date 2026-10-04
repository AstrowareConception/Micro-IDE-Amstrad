import { nativeImage } from 'electron';
import { inspectImage, PREVIEW_BYTES } from '../../packages/workspace/src/image.ts';
import type { ImageDecoder } from '../../packages/workspace/src/project.ts';

/** Decode verified bytes, then regenerate from pixels: no original metadata reaches preview/AI. */
export const decodeImage: ImageDecoder = async (bytes, mediaType) => {
  const header = inspectImage(bytes);
  if (header.mediaType !== mediaType) throw new Error('Signature image et type déclaré incohérents.');
  const decoded = nativeImage.createFromBuffer(Buffer.from(bytes));
  if (decoded.isEmpty()) throw new Error('Image non décodable.');
  const size = decoded.getSize();
  if (size.width !== header.width || size.height !== header.height) throw new Error('Dimensions décodées incohérentes.');
  const clean = nativeImage.createFromBitmap(decoded.toBitmap(), { width: size.width, height: size.height, scaleFactor: 1 });
  let side = 512;
  for (let attempt = 0; attempt < 10; attempt++, side = Math.max(1, Math.floor(side / 2))) {
    const scale = Math.min(1, side / Math.max(size.width, size.height));
    const previewWidth = Math.max(1, Math.round(size.width * scale)), previewHeight = Math.max(1, Math.round(size.height * scale));
    const preview = clean.resize({ width: previewWidth, height: previewHeight, quality: 'good' }).toPNG();
    if (preview.length <= PREVIEW_BYTES) return { width: size.width, height: size.height, previewWidth, previewHeight, dataUrl: `data:image/png;base64,${preview.toString('base64')}` };
  }
  throw new Error('Aperçu image trop volumineux.');
};
