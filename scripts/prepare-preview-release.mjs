import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeChecksums } from './release-checksums.mjs';

export function validateSource(run, artifacts, repository, runId) {
  if (!/^\d+$/.test(String(runId)) || String(run.id) !== String(runId)
    || run.repository?.full_name !== repository || run.head_repository?.full_name !== repository
    || run.path !== '.github/workflows/package-preview.yml' || run.head_branch !== 'main'
    || !['push', 'workflow_dispatch'].includes(run.event)
    || run.status !== 'completed' || run.conclusion !== 'success'
    || !/^[a-f0-9]{40}$/.test(run.head_sha)) {
    throw new Error('La source doit être un packaging réussi de main dans ce dépôt.');
  }
  for (const name of ['cpceleste-windows-preview', 'cpceleste-linux-preview']) {
    const matches = artifacts.filter(artifact => artifact.name === name);
    if (matches.length !== 1 || matches[0].expired || matches[0].size_in_bytes <= 0
      || matches[0].workflow_run?.id !== run.id || matches[0].workflow_run?.head_sha !== run.head_sha) {
      throw new Error(`Artefact absent, expiré ou de provenance incohérente : ${name}`);
    }
  }
  return run.head_sha;
}

export function validateTag(tag, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^v\d+\.\d+\.\d+-preview\.\d+$/.test(tag)
    || !tag.startsWith(`v${version}-preview.`)) throw new Error('Le tag preview doit correspondre à la version du build source.');
}

export function verifyBundle(directory, platform, version) {
  const expected = platform === 'win'
    ? [`CPCeleste-Portable-${version}.exe`, `CPCeleste-Setup-${version}.exe`]
    : [`CPCeleste-${version}-x86_64.AppImage`, `cpceleste_${version}_amd64.deb`];
  const smokeName = `packaged-smoke-${platform === 'win' ? 'windows' : 'linux'}.json`;
  const checksumName = `SHA256SUMS-${platform}.txt`;
  const allowed = [...expected, smokeName, checksumName].sort();
  if (JSON.stringify(readdirSync(directory).sort()) !== JSON.stringify(allowed)
    || allowed.some(name => !lstatSync(join(directory, name)).isFile())) {
    throw new Error('Contenu du bundle inattendu ou incomplet.');
  }
  const smoke = JSON.parse(readFileSync(join(directory, smokeName), 'utf8'));
  if (smoke.version !== version || smoke.packaged !== true || smoke.wasmMagic !== true
    || smoke.page !== 'cpceleste://app/index.html') throw new Error('Preuve de démarrage incompatible.');
  const lines = readFileSync(join(directory, checksumName), 'utf8').trim().split(/\r?\n/);
  if (lines.length !== expected.length) throw new Error('Manifeste SHA-256 incomplet.');
  const seen = new Set();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || !expected.includes(match[2]) || seen.has(match[2])) throw new Error('Entrée SHA-256 invalide.');
    seen.add(match[2]);
    const digest = createHash('sha256').update(readFileSync(join(directory, match[2]))).digest('hex');
    if (digest !== match[1]) throw new Error(`SHA-256 incorrect : ${match[2]}`);
  }
  return { files: expected, smokeName };
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function prepareRelease({ repository, runId, tag }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !/^\d+$/.test(runId ?? '')) {
    throw new Error('Dépôt ou numéro de build invalide.');
  }
  const endpoint = `repos/${repository}`;
  const run = JSON.parse(gh(['api', `${endpoint}/actions/runs/${runId}`]));
  const artifacts = JSON.parse(gh(['api', `${endpoint}/actions/runs/${runId}/artifacts?per_page=100`]));
  if (artifacts.total_count !== artifacts.artifacts.length) throw new Error('Liste d’artefacts tronquée.');
  const sha = validateSource(run, artifacts.artifacts, repository, runId);
  const sourcePackage = JSON.parse(gh(['api', `${endpoint}/contents/package.json?ref=${sha}`]));
  if (sourcePackage.encoding !== 'base64') throw new Error('Package source illisible.');
  const { version } = JSON.parse(Buffer.from(sourcePackage.content, 'base64').toString('utf8'));
  validateTag(tag, version);
  // Existing releases and tags must never be overwritten or retargeted.
  for (const suffix of [`releases/tags/${tag}`, `git/ref/tags/${tag}`]) {
    let exists = false;
    try { gh(['api', `${endpoint}/${suffix}`]); exists = true; }
    catch (error) { if (!String(error.stderr).includes('HTTP 404')) throw error; }
    if (exists) throw new Error('Ce tag ou cette release existe déjà ; choisir un nouveau numéro preview.');
  }
  const directory = mkdtempSync(join(tmpdir(), 'cpceleste-preview-'));
  try {
    const bundle = join(directory, 'bundle');
    mkdirSync(bundle);
    for (const [platform, name] of [['win', 'cpceleste-windows-preview'], ['linux', 'cpceleste-linux-preview']]) {
      const platformDir = join(directory, platform);
      gh(['run', 'download', runId, '--repo', repository, '--name', name, '--dir', platformDir]);
      const verified = verifyBundle(platformDir, platform, version);
      for (const name of [...verified.files, verified.smokeName]) copyFileSync(join(platformDir, name), join(bundle, name));
    }
    writeChecksums(bundle);
    const notes = `# CPCéleste ${version} — Packaging Preview\n\nPreview alpha non signée : Windows x64 (Setup et portable), Linux x64 (AppImage et deb).\n\nBuild source : https://github.com/${repository}/actions/runs/${runId}\nCommit : ${sha}\n\nLes quatre binaires sont repris du même build validé, sans recompilation. Leurs empreintes SHA-256 d’origine et les preuves de démarrage sont vérifiées avant préparation.\n\nLes ROM ne sont pas incluses. Node.js, npm et Python ne sont pas nécessaires pour utiliser ces paquets. Git reste nécessaire pour les fonctions Git.\n\nLes tests de démarrage du paquet ne qualifient pas encore installation/désinstallation, upgrade, signature ou auto-update.\n\nVérifier SHA256SUMS.txt avant utilisation. Guide : https://github.com/${repository}/blob/${sha}/docs/implementation/packaging-preview-alpha.md\n`;
    const notesFile = join(bundle, 'README-PREVIEW.md');
    writeFileSync(notesFile, notes);
    writeFileSync(join(bundle, 'build-provenance.json'), JSON.stringify({ repository, runId: run.id, sourceSha: sha, version, tag, rebuilt: false }, null, 2) + '\n');
    const url = gh(['release', 'create', tag, '--repo', repository, '--draft', '--prerelease', '--target', sha,
      '--title', `CPCéleste ${version} — Packaging Preview`, '--notes-file', notesFile,
      ...readdirSync(bundle).sort().map(name => join(bundle, name))]).trim();
    if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Preview préparée sans nouveau build\n\n${url}\n\nSource : ${runId}, commit ${sha}.\n\nRelease **en brouillon** : publication publique distincte.\n`, { flag: 'a' });
    console.log(url);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { prepareRelease({ repository: process.env.GITHUB_REPOSITORY, runId: process.env.SOURCE_RUN_ID, tag: process.env.PREVIEW_TAG }); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
