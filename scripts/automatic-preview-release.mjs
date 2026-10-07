import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBundle } from './prepare-preview-release.mjs';
import { writeChecksums } from './release-checksums.mjs';

const MARKER = /<!-- cpceleste-preview-inputs:([a-f0-9]{64}) -->/;
export function affectsPackage(path) {
  if (path === '.github/workflows/package-preview.yml') return true;
  if (/^(docs|tests|examples|\.github)\//.test(path)) return false;
  return !/^(README\.md|AGENTS\.md)$/.test(path);
}

// Git object IDs include content and the tree listing includes mode/path, hence
// deletions, renames, permissions, firmware locks and toolchain changes count too.
export function packageFingerprint(tree) {
  const entries = tree.split('\0').filter(Boolean).filter(entry => {
    const tab = entry.indexOf('\t');
    if (tab < 0) throw new Error('Arbre Git invalide.');
    return affectsPackage(entry.slice(tab + 1));
  }).sort();
  if (!entries.length) throw new Error('Aucune entrée de construction.');
  return createHash('sha256').update(entries.join('\0')).digest('hex');
}

export function distributionNames(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Version produit invalide.');
  return [`CPCeleste-Setup-${version}.exe`, `CPCeleste-Portable-${version}.exe`,
    `CPCeleste-${version}-x86_64.AppImage`, `cpceleste_${version}_amd64.deb`];
}

export function planPreview(releases, fingerprint, version) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Empreinte de construction invalide.');
  const expected = [...distributionNames(version), 'SHA256SUMS.txt', 'build-provenance.json',
    'packaged-smoke-windows.json', 'packaged-smoke-linux.json', 'README-PREVIEW.md'];
  const latest = releases.filter(release => !release.draft && release.prerelease
    && MARKER.test(release.body ?? '')).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))[0];
  const same = latest && MARKER.exec(latest.body)[1] === fingerprint;
  const complete = latest && expected.every(name => latest.assets?.filter(asset => asset.name === name
    && asset.state === 'uploaded' && asset.size > 0).length === 1);
  return { build: !(same && complete), previous: latest?.html_url ?? null,
    reason: same && complete ? 'Code inchangé : la préversion publiée contient déjà les paquets attendus.'
      : 'Première préversion, entrées modifiées ou fichiers publiés incomplets.' };
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function summary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n', { flag: 'a' });
}
function context() {
  const repository = process.env.GITHUB_REPOSITORY;
  const sourceSha = process.env.GITHUB_SHA;
  const runId = process.env.GITHUB_RUN_ID;
  if (process.env.GITHUB_REF !== 'refs/heads/main' || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository ?? '')
    || !/^[a-f0-9]{40}$/.test(sourceSha ?? '') || !/^\d+$/.test(runId ?? '')) throw new Error('Contexte de publication invalide : main requis.');
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (checkedOut !== sourceSha) throw new Error('Le checkout ne correspond pas au commit du workflow.');
  const tree = execFileSync('git', ['ls-tree', '-rz', 'HEAD'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const fingerprint = packageFingerprint(tree);
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  distributionNames(version);
  return { repository, sourceSha, runId, fingerprint, version, tag: `v${version}-preview.${runId}` };
}

export function publishPreview(ctx, runGh = gh) {
  const { repository, sourceSha, runId, fingerprint, version, tag } = ctx;
  distributionNames(version);
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(sourceSha)
    || !/^\d+$/.test(runId) || !/^[a-f0-9]{64}$/.test(fingerprint)
    || tag !== `v${version}-preview.${runId}`) throw new Error('Provenance de publication invalide.');
  const directory = mkdtempSync(join(tmpdir(), 'cpceleste-automatic-preview-'));
  try {
    const bundle = join(directory, 'bundle');
    mkdirSync(bundle);
    for (const [platform, artifact] of [['win', 'cpceleste-windows-preview'], ['linux', 'cpceleste-linux-preview']]) {
      const destination = join(directory, platform);
      runGh(['run', 'download', runId, '--repo', repository, '--name', artifact, '--dir', destination]);
      const verified = verifyBundle(destination, platform, version);
      for (const name of [...verified.files, verified.smokeName]) copyFileSync(join(destination, name), join(bundle, name));
    }
    writeChecksums(bundle);
    const notes = `# CPCéleste ${version} — préversion automatique\n\nWindows x64 : installateur Setup et portable. Linux x64 : AppImage et deb.\n\nTélécharger le fichier adapté dans Assets ci-dessous. Node.js, npm et Python ne sont pas nécessaires à l’utilisation.\n\nPreview alpha non signée. ROM CPC non incluses ; import local requis pour l’émulation. Git reste une dépendance séparée pour les fonctions Git.\n\nLes builds Windows/Linux, les tests Node et TypeScript, puis le démarrage des deux applications empaquetées ont réussi. Les SHA-256 d’origine et preuves UI/WASM ont été vérifiés avant publication. Installation/désinstallation, upgrade, signature et auto-update restent à qualifier.\n\nCommit : ${sourceSha}\nBuild : https://github.com/${repository}/actions/runs/${runId}\nGuide : https://github.com/${repository}/blob/${sourceSha}/docs/implementation/packaging-preview-alpha.md\n\nVérifier SHA256SUMS.txt avant utilisation. Les publications précédentes sont conservées.\n\n<!-- cpceleste-preview-inputs:${fingerprint} -->\n`;
    writeFileSync(join(bundle, 'README-PREVIEW.md'), notes);
    writeFileSync(join(bundle, 'build-provenance.json'), JSON.stringify({ schemaVersion: 1, repository, sourceSha,
      runId, version, tag, inputFingerprint: fingerprint, channel: 'preview', automatic: true }, null, 2) + '\n');
    // gh uploads assets to a draft first, then publishes. No --clobber, mutable
    // latest tag, force push, release deletion or stable-channel promotion.
    const url = runGh(['release', 'create', tag, '--repo', repository, '--target', sourceSha,
      '--prerelease', '--latest=false', '--title', `CPCéleste ${version} — Preview ${sourceSha.slice(0, 7)}`,
      '--notes-file', join(bundle, 'README-PREVIEW.md'), ...readdirSync(bundle).sort().map(name => join(bundle, name))]).trim();
    return url;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export function run(mode) {
  const ctx = context();
  if (mode === 'plan') {
    const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${ctx.repository}/releases?per_page=100`]));
    const plan = planPreview(pages.flat(), ctx.fingerprint, ctx.version);
    if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT absent.');
    writeFileSync(process.env.GITHUB_OUTPUT, `build=${plan.build}\nfingerprint=${ctx.fingerprint}\ntag=${ctx.tag}\n`, { flag: 'a' });
    summary(`## Décision de publication\n\n${plan.reason}\n\n${plan.previous ?? 'Aucune préversion automatique publiée.'}`);
    console.log(plan.reason);
  } else if (mode === 'publish') {
    if (process.env.EXPECTED_FINGERPRINT !== ctx.fingerprint || process.env.EXPECTED_TAG !== ctx.tag) {
      throw new Error('Les entrées ont changé depuis la préparation.');
    }
    const url = publishPreview(ctx);
    summary(`## Préversion publiée\n\n${url}\n\nCommit : ${ctx.sourceSha}. Quatre paquets, SHA-256 et preuves de démarrage joints.`);
    console.log(url);
  } else throw new Error('Usage : node scripts/automatic-preview-release.mjs <plan|publish>');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv[2]); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
