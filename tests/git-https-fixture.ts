import { createServer } from 'node:https';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
/** Real TLS + Git smart HTTP, exclusively temporary original repositories/credentials. */
export async function gitHttpsFixture(options: { allowAnonymous?: boolean } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cpceleste-https-'))), repository = join(root, 'remote.git');
  await mkdir(repository);
  execFileSync('git', ['init', '--bare', '--quiet', '--initial-branch=main', repository]);
  execFileSync('git', ['--git-dir=' + repository, 'config', 'http.receivepack', 'true']);
  const certificate = join(root, 'certificate.pem'), key = join(root, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { stdio: 'ignore' });
  const authorization = 'Basic ' + Buffer.from('fixture:' + 'not-a-personal-credential').toString('base64');
  const requests: { method: string; authorized: boolean; hasAuthorization: boolean }[] = [];
  let stalled = false;
  const server = createServer({ cert: await readFile(certificate), key: await readFile(key) }, (request, response) => {
    const authorized = !!options.allowAnonymous || request.headers.authorization === authorization; requests.push({ method: request.method ?? '', authorized, hasAuthorization: !!request.headers.authorization });
    if (!authorized) { response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="fixture"' }); response.end('Rejected fixture credential'); return; }
    if (stalled) return;
    const url = new URL(request.url ?? '/', 'https://127.0.0.1');
    if (!/^\/remote\.git\/(?:info\/refs|git-upload-pack|git-receive-pack)$/.test(url.pathname)) { response.writeHead(404); response.end(); return; }
    const parts: Buffer[] = []; let size = 0;
    request.on('data', part => { size += part.length; if (size > 2 * 1024 * 1024) request.destroy(); else parts.push(part); });
    request.on('end', () => {
      const body = Buffer.concat(parts), child = execFile('git', ['http-backend'], { env: { ...process.env, GIT_PROJECT_ROOT: root, GIT_HTTP_EXPORT_ALL: '1',
        PATH_INFO: url.pathname, QUERY_STRING: url.search.slice(1), REQUEST_METHOD: request.method, CONTENT_TYPE: request.headers['content-type'] ?? '', CONTENT_LENGTH: String(body.length), REMOTE_USER: 'fixture' },
        encoding: 'buffer', maxBuffer: 4 * 1024 * 1024, timeout: 15_000 }, (error, output) => {
        if (error) { response.writeHead(500); response.end('Fixture backend failed'); return; }
        let end = output.indexOf('\r\n\r\n'), separator = 4; if (end < 0) { end = output.indexOf('\n\n'); separator = 2; }
        if (end < 0) { response.writeHead(500); response.end(); return; }
        for (const line of output.subarray(0, end).toString('latin1').split(/\r?\n/)) {
          const colon = line.indexOf(':'); if (colon < 1) continue;
          const name = line.slice(0, colon), value = line.slice(colon + 1).trim();
          if (name.toLowerCase() === 'status') response.statusCode = Number(value.slice(0, 3)); else response.setHeader(name, value);
        }
        response.end(output.subarray(end + separator));
      });
      child.stdin?.on('error', () => undefined); child.stdin?.end(body);
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTPS fixture failed.');
  const url = 'https://127.0.0.1:' + address.port + '/remote.git';
  return { root, repository, certificate, authorization, url, requests, stall(value: boolean) { stalled = value; }, async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
