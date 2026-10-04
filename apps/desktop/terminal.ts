import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { isAbsolute, join } from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import type { TerminalResult } from '../../packages/workspace/src/terminal.ts';

const OUTPUT_LIMIT = 64 * 1024;
/** No PTY, stdin, agent access, output interpretation or persisted transcript. */
export class ProjectTerminal {
  private child: ChildProcess | undefined;
  private result: TerminalResult | undefined;
  private owner: string | undefined;
  private bytes = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private starting = false;
  get running(): boolean { return this.starting || !!this.child; }
  static command(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 4096 || /[\0\r\n]/.test(value))
      throw new Error('Commande sur une ligne de 4 Kio maximum requise.');
    return value;
  }
  async run(sessionId: string, root: string, value: unknown): Promise<TerminalResult> {
    if (this.running) throw new Error('Une commande terminal est déjà active.');
    const command = ProjectTerminal.command(value); this.starting = true;
    try {
      if (await realpath(root) !== root || !(await lstat(root)).isDirectory()) throw new Error('Racine terminal modifiée.');
      const systemRoot = process.env.SystemRoot;
      const shell = process.platform === 'win32' ? (systemRoot && isAbsolute(systemRoot) ? join(systemRoot, 'System32/cmd.exe') : '') : '/bin/sh';
      if (!shell || !(await lstat(await realpath(shell))).isFile()) throw new Error('Shell système indisponible.');
      const env: NodeJS.ProcessEnv = {};
      for (const key of ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SSH_AUTH_SOCK'])
        if (process.env[key] !== undefined) env[key] = process.env[key];
      this.owner = sessionId; this.bytes = 0;
      this.result = { id: randomUUID(), command, state: 'running', output: '', exitCode: null, reason: '' };
      const child = spawn(shell, process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command],
        { cwd: root, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      this.child = child;
      const append = (text: string) => { if (this.result && text) this.result.output += text; };
      for (const stream of [child.stdout, child.stderr]) {
        const decoder = new StringDecoder('utf8');
        stream!.on('data', (chunk: Buffer) => {
          const available = OUTPUT_LIMIT - this.bytes, accepted = chunk.subarray(0, Math.max(0, available));
          this.bytes += accepted.length; append(decoder.write(accepted));
          if (chunk.length > available) this.kill('Sortie limitée à 64 Kio ; commande arrêtée.');
        });
        stream!.on('end', () => append(decoder.end()));
      }
      child.on('error', () => { if (this.result) this.result.reason = 'Démarrage du shell impossible.'; });
      // Kill remaining group members when the shell exits (background jobs are not supported).
      child.once('exit', () => this.terminate(child));
      child.once('close', code => {
        if (this.timer) clearTimeout(this.timer); this.timer = undefined;
        if (this.result) { this.result.exitCode = code; this.result.state = this.result.reason ? 'stopped' : 'completed'; }
        this.child = undefined;
      });
      this.timer = setTimeout(() => this.kill('Limite de 30 secondes ; commande arrêtée.'), 30_000);
      return { ...this.result };
    } finally { this.starting = false; }
  }
  private terminate(child: ChildProcess): void {
    if (!child.pid) return;
    if (process.platform === 'win32') {
      const root = process.env.SystemRoot;
      if (root && isAbsolute(root)) spawn(join(root, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => undefined);
      child.kill();
    } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Group already ended. */ } }
  }
  private kill(reason: string): void {
    if (!this.child || !this.result) return;
    this.result.reason ||= reason; this.terminate(this.child);
  }
  status(sessionId: string, id: unknown): TerminalResult {
    if (!this.result || sessionId !== this.owner || id !== this.result.id) throw new Error('Commande terminal périmée.');
    return { ...this.result };
  }
  stop(sessionId: string, id: unknown): TerminalResult {
    this.status(sessionId, id); this.kill('Arrêt demandé.'); return this.status(sessionId, id);
  }
}
