const $ = id => document.getElementById(id);
const status = message => { $('status').textContent = message; };
let cpc, live = false, paused = false, ready = false, clock = 0, last = 0, remainder = 0;
let queue = [], held = null, keyTime = 0, audioPointer = 0, diskPointer = 0, audioContext;
let nextAudio = 0, sourceNodes = new Set(), timings = [], provenance = {};
const screen = $('screen'), context = screen.getContext('2d');
let image;
function check(code, action) { if (code < 0) throw new Error(`${action} : code ${code}`); return code; }
function clearAudio() {
  for (const node of sourceNodes) { try { node.stop(); } catch {} }
  sourceNodes.clear(); nextAudio = 0;
}
function release() {
  queue = []; held = null; keyTime = 0;
  if (live) cpc._cpc_bridge_release_keys();
}
function setPaused(value) {
  check(cpc._cpc_bridge_pause(Number(value)), 'pause'); paused = value; release(); clearAudio();
  last = performance.now(); remainder = 0; $('pause').textContent = value ? 'Reprendre' : 'Pause';
}
async function binary(id, expected) {
  const file = $(id).files[0];
  if (!file || file.size !== expected) throw new Error(`${id} : sélectionner exactement ${expected} octets`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  provenance[id] = { bytes: bytes.length, sha256: [...digest].map(v => v.toString(16).padStart(2, '0')).join('') };
  return bytes;
}
function allocated(bytes) {
  const pointer = cpc._malloc(bytes.length);
  if (!pointer) throw new Error('Allocation WASM refusée');
  cpc.HEAPU8.set(bytes, pointer); return pointer;
}
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function observation() {
  const sorted = [...timings].sort((a, b) => a - b);
  return { kind: 'observed-session', core: '9e88298ce56319953ac7a43213a1120359f7a3a6',
    firmware: provenance, profile: 'cpc6128-classic-v1', qualification: 'experimental',
    promptReadiness: ready ? 'manual-user-observation' : 'not-confirmed',
    emulatedSeconds: cpc._cpc_bridge_ticks() / 4000000, paused,
    physicalRamMarkers: { '8000': cpc._cpc_bridge_peek(0x8000), '8001': cpc._cpc_bridge_peek(0x8001), '9000': cpc._cpc_bridge_peek(0x9000) },
    sliceMilliseconds: { samples: sorted.length, p95: sorted[Math.floor(sorted.length * .95)] ?? null, max: sorted.at(-1) ?? null },
    externalEmulatorTested: false, physicalCpcTested: false };
}
function paint() {
  const frame = cpc._cpc_bridge_frame(), palette = cpc._cpc_bridge_palette();
  const stride = cpc._cpc_bridge_stride();
  for (let y = 0; y < screen.height; y++) for (let x = 0; x < screen.width; x++) {
    const color = palette + cpc.HEAPU8[frame + y * stride + x] * 4;
    const offset = (y * screen.width + x) * 4;
    image.data[offset] = cpc.HEAPU8[color]; image.data[offset + 1] = cpc.HEAPU8[color + 1];
    image.data[offset + 2] = cpc.HEAPU8[color + 2]; image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}
function drainAudio() {
  const count = check(cpc._cpc_bridge_audio(audioPointer, 4096), 'audio');
  if (!count || !audioContext || audioContext.state !== 'running' || paused) return;
  if (nextAudio > audioContext.currentTime + .2) return;
  const buffer = audioContext.createBuffer(1, count, 44100);
  buffer.copyToChannel(cpc.HEAPF32.subarray(audioPointer / 4, audioPointer / 4 + count), 0);
  const node = audioContext.createBufferSource(); node.buffer = buffer; node.connect(audioContext.destination);
  const when = Math.max(audioContext.currentTime + .015, nextAudio);
  node.onended = () => sourceNodes.delete(node); sourceNodes.add(node); node.start(when); nextAudio = when + count / 44100;
}
function advanceKey(microseconds) {
  if (!queue.length && held === null) return;
  keyTime -= microseconds;
  if (keyTime > 0) return;
  if (held !== null) { check(cpc._cpc_bridge_key(held, 0), 'key up'); held = null; keyTime = 60000; }
  else if (queue.length) { held = queue.shift(); check(cpc._cpc_bridge_key(held, 1), 'key down'); keyTime = 60000; }
}
function tick(now) {
  if (!live) return;
  try {
    /* No catch-up after a stall/hidden tab. Maximum 5 slices per repaint. */
    const delta = Math.min(50, Math.max(0, now - last)); last = now;
    if (!paused) remainder += delta * 1000;
    while (remainder >= 10000) {
      advanceKey(10000);
      const begin = performance.now(); check(cpc._cpc_bridge_step(10000), 'exécution');
      timings.push(performance.now() - begin); if (timings.length > 1000) timings.shift();
      remainder -= 10000;
    }
    drainAudio(); paint();
    if (now - clock > 500) {
      clock = now; const data = observation(); $('clock').textContent = data.emulatedSeconds.toFixed(2) + ' s';
      $('observations').textContent = JSON.stringify(data, null, 2);
    }
    requestAnimationFrame(tick);
  } catch (error) { status(error.message); if (live) setPaused(true); }
}
function guarded(id, handler) { $(id).addEventListener('click', async () => { try { await handler(); } catch (error) { status(error.message); } }); }
guarded('start', async () => {
  $('start').disabled = true;
  const pointers = [];
  try {
    const os = allocated(await binary('os', 16384)); pointers.push(os);
    const basic = allocated(await binary('basic', 16384)); pointers.push(basic);
    const amsdos = allocated(await binary('amsdos', 16384)); pointers.push(amsdos);
    const disk = allocated(await binary('disk', 194816)); pointers.push(disk);
    check(cpc._cpc_bridge_init(os, 16384, basic, 16384, amsdos, 16384), 'ROM');
    check(cpc._cpc_bridge_mount(disk, 194816), 'DSK DATA');
    audioPointer = cpc._malloc(4096 * 4); diskPointer = cpc._malloc(194816);
    if (!audioPointer || !diskPointer) throw new Error('Allocation de sortie refusée');
    live = true; screen.width = cpc._cpc_bridge_width(); screen.height = cpc._cpc_bridge_height();
    image = context.createImageData(screen.width, screen.height);
    for (const id of ['pause', 'reset', 'break', 'sound', 'export', 'ready', 'report']) $(id).disabled = false;
    for (const id of ['os', 'basic', 'amsdos', 'disk']) $(id).disabled = true;
    status('Machine en cours d’exécution. Vérifier visuellement le prompt ; firmware non qualifié.');
    last = performance.now(); requestAnimationFrame(tick);
  } catch (error) {
    cpc._cpc_bridge_dispose(); live = false;
    if (audioPointer) cpc._free(audioPointer); if (diskPointer) cpc._free(diskPointer);
    audioPointer = diskPointer = 0; $('start').disabled = false; throw error;
  } finally { for (const pointer of pointers) cpc._free(pointer); }
});
guarded('pause', () => setPaused(!paused));
guarded('reset', () => { release(); clearAudio(); check(cpc._cpc_bridge_reset(), 'reset'); ready = false; $('type').disabled = true; status('Machine réinitialisée, secteurs de session conservés. Vérifier de nouveau le prompt.'); });
guarded('ready', () => { ready = true; $('type').disabled = false; status('Prompt confirmé manuellement. Les commandes peuvent être saisies.'); });
guarded('type', () => {
  if (!ready || paused) throw new Error('Machine prête et active requise');
  if (queue.length || held !== null) throw new Error('Une commande est déjà en cours de saisie');
  const command = $('command').value;
  if (!command || !/^[\x20-\x7d]+$/.test(command)) throw new Error('Commande ASCII simple requise');
  queue = [...command].map(c => c.charCodeAt(0)).concat(13); keyTime = 0; status('Saisie par touches CPC en cours…');
});
guarded('break', () => { if (paused) throw new Error('Reprendre avant ESC'); release(); queue = [3]; });
guarded('sound', async () => { audioContext ??= new AudioContext({ sampleRate: 44100 });
  if (audioContext.state === 'running') { clearAudio(); await audioContext.suspend(); $('sound').textContent = 'Activer le son'; }
  else { await audioContext.resume(); nextAudio = 0; $('sound').textContent = 'Couper le son'; }
});
guarded('export', () => { const count = check(cpc._cpc_bridge_export(diskPointer, 194816), 'export');
  download(cpc.HEAPU8.slice(diskPointer, diskPointer + count), 'session.dsk', 'application/octet-stream'); status('Copie des secteurs de session exportée. Tester sa relecture et l’émulateur indépendant.'); });
guarded('report', () => download(JSON.stringify(observation(), null, 2), 'j0-session.json', 'application/json'));
const specials = { Enter: 13, Escape: 3, Backspace: 1, Delete: 12, ArrowLeft: 8, ArrowRight: 9, ArrowDown: 10, ArrowUp: 11 };
screen.addEventListener('keydown', event => {
  if (!live || paused || event.ctrlKey || event.metaKey || queue.length || held !== null) return;
  const key = specials[event.key] ?? (event.key.length === 1 && /^[\x20-\x7d]$/.test(event.key) ? event.key.charCodeAt(0) : null);
  if (key !== null) { event.preventDefault(); check(cpc._cpc_bridge_key(key, 1), 'clavier'); }
});
screen.addEventListener('keyup', event => {
  if (!live) return;
  const key = specials[event.key] ?? (event.key.length === 1 ? event.key.charCodeAt(0) : null);
  if (key !== null && key <= 255) { event.preventDefault(); cpc._cpc_bridge_key(key, 0); }
});
screen.addEventListener('blur', release);
window.addEventListener('blur', () => { if (live && !paused) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (live && document.hidden && !paused) setPaused(true); });
window.addEventListener('pagehide', () => { release(); clearAudio(); if (live) cpc._cpc_bridge_dispose(); });
try { const { default: createCpc } = await import('/cpc.mjs'); cpc = await createCpc(); $('start').disabled = false; status('Module prêt. Sélectionner les trois ROM et une disquette DATA.'); }
catch (error) { status('Module indisponible : exécuter npm run build:wasm. ' + error.message); }
