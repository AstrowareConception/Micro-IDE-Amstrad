import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const port = Number(process.argv[2] ?? 6128);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port 1024..65535 required');
const resources = new Map([
  ['/', ['tools/j0-harness/index.html', 'text/html; charset=utf-8']],
  ['/harness.css', ['tools/j0-harness/harness.css', 'text/css; charset=utf-8']],
  ['/harness.mjs', ['tools/j0-harness/harness.mjs', 'text/javascript; charset=utf-8']],
  ['/cpc.mjs', ['out/cpc.mjs', 'text/javascript; charset=utf-8']],
  ['/cpc.wasm', ['out/cpc.wasm', 'application/wasm']],
]);
createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(request.method) || ![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)) {
    response.writeHead(403); response.end(); return;
  }
  const resource = resources.get(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
  if (!resource) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const bytes = await readFile(new URL('../' + resource[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': resource[1] }); response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404); response.end('Build the WASM module first.'); }
}).listen(port, '127.0.0.1', () => console.log(`J0 local harness: http://127.0.0.1:${port}`));
