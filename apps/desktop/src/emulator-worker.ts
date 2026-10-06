/// <reference lib="webworker" />
import { runCommand, type RunImage } from '../../../packages/emulator/src/run.ts';
import { CPC_REGISTER_NAMES } from '../../../packages/emulator/src/inspection.ts';
interface Cpc {
  HEAPU8: Uint8Array; HEAPF32: Float32Array;
  _malloc(bytes: number): number; _free(pointer: number): void;
  _cpc_bridge_init(a: number, al: number, b: number, bl: number, c: number, cl: number): number;
  _cpc_bridge_mount(pointer: number, length: number): number; _cpc_bridge_step(us: number): number;
  _cpc_bridge_pause(paused: number): number; _cpc_bridge_release_keys(): void;
  _cpc_bridge_key(key: number, down: number): number; _cpc_bridge_dispose(): void;
  _cpc_bridge_width(): number; _cpc_bridge_height(): number; _cpc_bridge_stride(): number;
  _cpc_bridge_frame(): number; _cpc_bridge_palette(): number; _cpc_bridge_ticks(): number;
  _cpc_bridge_audio(pointer: number, capacity: number): number; _cpc_bridge_export(pointer: number, capacity: number): number;
  _cpc_bridge_register(index: number): number; _cpc_bridge_read_ram(address: number, pointer: number, length: number): number;
}
const scope = self as unknown as DedicatedWorkerGlobalScope;
let cpc: Cpc | undefined, id = '', paused = false, live = false, starting = false, launched = false;
let image: RunImage, audio = 0, output = 0, held: number | undefined, wait = 0, queue: number[] = [], last = 0, repaint = 0;
let recognition = false, remainder = 0, framePending = false;
const check = (value: number) => { if (value < 0) throw new Error(`Moteur CPC : opération refusée (${value}).`); return value; };
const send = (value: Record<string, unknown>, transfer: Transferable[] = []) => scope.postMessage({ id, ...value }, transfer);
function release() { queue = []; held = undefined; wait = 0; cpc?._cpc_bridge_release_keys(); }
function typeRun() { if (!cpc || launched || paused) return; launched = true; release(); queue = [...runCommand(image.entry)].map(c => c.charCodeAt(0)); send({ type: 'state', phase: 'running', message: `Commande RUN"${image.entry}" envoyée au CPC. Résultat et erreurs visibles sur l’écran.` }); }
// Only an observed boot screen with an identified firmware may trigger automatic RUN.
const READY_SCREENS: Record<string, readonly string[]> = {
  'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf:58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977:ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d': ['463daf9b810f7bc36fb0c570a970269051bd023c91c6db7935ea21c0add3b607'],
};
async function recognize(frame: Uint8Array) {
  if (recognition || launched || !live || paused) return;
  const fingerprints = READY_SCREENS[[image.firmware.os, image.firmware.basic, image.firmware.amsdos].join(':')];
  if (!fingerprints) return;
  recognition = true;
  try { const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(frame.slice(0, 768 * 108))))].map(n => n.toString(16).padStart(2, '0')).join(''); if (live && fingerprints.includes(hash)) typeRun(); }
  finally { recognition = false; }
}
function frame() {
  if (!cpc || framePending) return;
  const width = cpc._cpc_bridge_width(), height = cpc._cpc_bridge_height(), stride = cpc._cpc_bridge_stride();
  const pointer = cpc._cpc_bridge_frame(), palette = cpc._cpc_bridge_palette();
  if (width < 1 || height < 1 || width > 1024 || height > 1024) throw new Error('Écran CPC hors limite.');
  const pixels = new Uint8ClampedArray(width * height * 4), indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = cpc.HEAPU8[pointer + y * stride + x]!, p = (y * width + x) * 4, color = palette + index * 4;
    indices[y * width + x] = index; pixels[p] = cpc.HEAPU8[color]!; pixels[p + 1] = cpc.HEAPU8[color + 1]!; pixels[p + 2] = cpc.HEAPU8[color + 2]!; pixels[p + 3] = 255;
  }
  void recognize(indices).catch(() => send({ type: 'state', phase: 'manual', message: 'Reconnaissance du prompt indisponible ; confirmez Ready à l’écran.' }));
  const seconds = cpc._cpc_bridge_ticks() / 4000000;
  framePending = true;
  send({ type: 'frame', width, height, pixels, seconds, paused }, [pixels.buffer]);
  const count = check(cpc._cpc_bridge_audio(audio, 4096));
  if (count && !paused) { const samples = cpc.HEAPF32.slice(audio / 4, audio / 4 + count); send({ type: 'audio', samples }, [samples.buffer]); }
}
function tick() {
  if (!live || !cpc) return;
  try {
    const now = performance.now(), delta = Math.min(40000, Math.max(0, (now - last) * 1000)); last = now;
    if (!paused) {
      remainder = Math.min(40000, remainder + delta);
      while (remainder >= 10000) {
        remainder -= 10000;
        if (queue.length || held !== undefined) {
          wait -= 10000;
          if (wait <= 0) {
            if (held !== undefined) { check(cpc._cpc_bridge_key(held, 0)); held = undefined; wait = 60000; }
            else { held = queue.shift()!; check(cpc._cpc_bridge_key(held, 1)); wait = 60000; }
          }
        }
        check(cpc._cpc_bridge_step(10000));
      }
    }
    if (now - repaint >= 40) { repaint = now; frame(); }
    setTimeout(tick, 10);
  } catch { release(); live = false; send({ type: 'error', message: 'Exécution du moteur interrompue ; arrêtez puis relancez le CPC.' }); }
}
scope.onmessage = event => {
  const value = event.data;
  if (!value || typeof value !== 'object') return;
  if (value.type === 'start' && !starting && !live) {
    starting = true; id = value.id;
    void (async () => {
      image = value.image as RunImage;
      if (typeof id !== 'string' || image.disk.length !== 194816 || Object.values(image.roms).some(rom => !(rom instanceof Uint8Array) || rom.length !== 16384)) throw new Error('Image CPC invalide.');
      runCommand(image.entry);
      const moduleUrl = new URL('../emulator/cpc.mjs', scope.location.href).href;
      const { default: createCpc } = await import(/* @vite-ignore */ moduleUrl);
      cpc = await createCpc({ locateFile: (name: string) => new URL(name, moduleUrl).href }) as Cpc;
      const allocated: number[] = [];
      const put = (bytes: Uint8Array) => { const p = cpc!._malloc(bytes.length); if (!p) throw new Error('Mémoire CPC indisponible.'); allocated.push(p); cpc!.HEAPU8.set(bytes, p); return p; };
      try { const os = put(image.roms.os), basic = put(image.roms.basic), amsdos = put(image.roms.amsdos), disk = put(image.disk); check(cpc._cpc_bridge_init(os, 16384, basic, 16384, amsdos, 16384)); check(cpc._cpc_bridge_mount(disk, image.disk.length)); }
      finally { for (const p of allocated) cpc._free(p); }
      audio = cpc._malloc(4096 * 4); output = cpc._malloc(194816); if (!audio || !output) throw new Error('Mémoire CPC indisponible.');
      live = true; last = performance.now(); send({ type: 'state', phase: 'manual', message: 'CPC démarré. Si RUN ne part pas automatiquement, attendez Ready puis confirmez le prompt.' }); tick();
    })().catch(() => { live = false; cpc?._cpc_bridge_dispose(); send({ type: 'error', message: 'Moteur CPC indisponible ou démarrage refusé. Vérifiez les ROM et le build WebAssembly.' }); });
    return;
  }
  if (!live || !cpc || value.id !== id) return;
  try {
    if (value.type === 'frame-ack') { framePending = false; }
    else if (value.type === 'pause' && typeof value.paused === 'boolean') { paused = value.paused; remainder = 0; last = performance.now(); release(); check(cpc._cpc_bridge_pause(Number(paused))); frame(); }
    else if (value.type === 'ready') typeRun();
    else if (value.type === 'release') release();
    else if (value.type === 'break' && !paused) { release(); queue = [3, 3]; }
    else if (value.type === 'key' && !paused && !queue.length && held === undefined && Number.isInteger(value.key) && value.key >= 0 && value.key <= 255 && typeof value.down === 'boolean') check(cpc._cpc_bridge_key(value.key, Number(value.down)));
    else if (value.type === 'inspect' && paused && Number.isInteger(value.address) && value.address >= 0 && value.address <= 65535 && Number.isSafeInteger(value.sequence)) {
      const length = Math.min(64, 65536 - value.address);
      check(cpc._cpc_bridge_read_ram(value.address, output, length));
      const registers = CPC_REGISTER_NAMES.map((_, index) => check(cpc!._cpc_bridge_register(index)));
      const bytes = cpc.HEAPU8.slice(output, output + length);
      send({ type: 'inspection', sequence: value.sequence, snapshot: { address: value.address, bytes, registers, ticks: cpc._cpc_bridge_ticks() } }, [bytes.buffer]);
    }
    else if (value.type === 'export') { const size = check(cpc._cpc_bridge_export(output, 194816)); const disk = cpc.HEAPU8.slice(output, output + size); send({ type: 'disk', disk }, [disk.buffer]); }
  } catch { send({ type: 'error', message: 'Commande CPC refusée ; relancez une session propre.' }); }
};
