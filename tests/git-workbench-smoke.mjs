import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { newProject } from '../packages/workspace/src/project.ts';
export async function verifyGitWorkbench(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ manifest }) => {
    const oid = 'a'.repeat(40), remote = [], branches = [{ name: 'main', oid, upstream: '', current: true, remote: false }];
    let current = 'main', serial = 0, fetchedAt = null;
    const snapshot = (source = '10 REM GIT ORIGINAL\n20 END\n') => ({ sessionId: 'git-' + serial, manifest, files: [{ ...manifest.sources[0], source }] });
    const overview = () => ({ revision: 'r' + serial, branch: current, head: oid, remotes: [...remote], branches: [...branches], ahead: 1, behind: 0, fetchedAt });
    window.gitCalls = []; window.githubCalls = []; window.confirm = () => false;
    const record = (name, input) => window.gitCalls.push({ name, input });
    window.desktop = { setDirty() {}, open: async () => null, save: async () => null, exportDisk: async () => null, project: { open: async () => snapshot() },
      git: {
        identity: async () => ({ revision: null, identity: null }), status: async () => ({ state: 'repository', version: 'git fixture', branch: current, head: oid, changes: [] }),
        history: async () => ({ head: oid, commits: [] }), prepareCommit: async (_session, input) => ({ ...input, id: 'commit', branch: current, head: oid, tree: oid, files: [{ path: 'src/main.bas', status: 'M' }], diff: '+10 REM GIT' }),
      },
      gitOperations: {
        overview: async () => overview(),
        prepare: async (_session, _revision, request) => { record('prepare', request); return { ...request, id: JSON.stringify(request), branch: request.branch ?? current, remote: request.remote ?? '', url: request.url ?? remote[0]?.url ?? '', head: oid, target: oid, commits: 1, files: ['src/main.bas'] }; },
        apply: async (_session, id) => {
          const request = JSON.parse(id); record('apply', request); serial++;
          if (request.action === 'add-remote') remote.push({ name: request.remote, url: request.url });
          if (request.action === 'create-branch') branches.push({ name: request.branch, oid, upstream: '', current: false, remote: false });
          if (request.action === 'switch-branch') { current = request.branch; branches.forEach(entry => { entry.current = entry.name === current; }); return { overview: overview(), summary: 'Branche chargée', project: snapshot('10 REM GIT FEATURE\n20 END\n') }; }
          if (request.action === 'fetch') fetchedAt = new Date().toISOString();
          return { overview: overview(), summary: 'Git confirmé' };
        },
        suggestMessage: async (_session, identity) => { record('suggest', identity); return { message: 'Ajoute un écran de titre', model: 'gpt-fixture' }; },
        clone: async (url, name) => { record('clone', { url, name }); serial++; return snapshot('10 REM GIT CLONE\n20 END\n'); },
      },
      github: {
        account: async () => ({ connected: !!window.githubConnected, login: window.githubConnected ? 'Fixture' : '' }),
        connect: async () => { window.githubConnected = true; return { connected: true, login: 'Fixture' }; },
        disconnect: async () => { window.githubConnected = false; return { connected: false, login: '' }; },
        repositories: async () => ({ repositories: [{ fullName: 'Fixture/jeu-prive', url: 'https://github.com/Fixture/jeu-prive.git', private: true, defaultBranch: 'main' }], nextPage: null }),
        pullRequests: async () => [{ number: 3, title: 'Un jeu CPC', url: 'https://github.com/Fixture/jeu-prive/pull/3', head: 'feature/jeu', base: 'main', draft: true }],
        createPullRequest: async (...input) => { window.githubCalls.push(input); return { number: 4, title: input[3], url: 'https://github.com/Fixture/jeu-prive/pull/4', head: current, base: input[2], draft: input[5] }; },
        open: async url => { window.githubCalls.push(url); return { ok: true }; },
      },
    };
  }, { manifest: newProject('Git interface', '10000000-0000-4000-8000-000000000001') });
  try {
    await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor();
    await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click(); await expect(page.locator('.view-lines')).toContainText('GIT ORIGINAL');
    const menus = page.getByRole('navigation', { name: 'Menus de l’atelier', exact: true });
    async function command(name) { await menus.getByRole('button', { name: 'Git', exact: true }).click(); await page.getByRole('menuitem', { name }).click(); }
    await command('Compte GitHub et dépôts privés…');
    const dialog = page.getByRole('dialog', { name: 'GitHub et clone', exact: true });
    await dialog.getByLabel('Jeton GitHub', { exact: true }).fill('github_pat_' + 'fixture'.repeat(9)); await dialog.getByRole('button', { name: 'Connecter le compte', exact: true }).click();
    await expect(dialog).toContainText('Fixture'); await expect(dialog.getByLabel('Jeton GitHub', { exact: true })).toHaveValue('');
    await dialog.getByRole('button', { name: 'Charger mes dépôts GitHub', exact: true }).click(); await dialog.getByRole('button', { name: 'Fixture/jeu-prive · privé', exact: true }).click();
    await expect(dialog.getByLabel('URL du dépôt à cloner', { exact: true })).toHaveValue('https://github.com/Fixture/jeu-prive.git');
    await dialog.getByRole('button', { name: 'Associer au projet courant…', exact: true }).click(); await expect(dialog).toContainText('Remote associé');
    await page.screenshot({ path: 'out/github-private-alpha.png' }); await dialog.getByRole('button', { name: 'Fermer', exact: true }).click(); await expect(page.locator('.github-dialog')).toHaveCount(0);
    await command('Branches locales et distantes');
    const panel = page.getByRole('region', { name: 'Contrôle de version Git', exact: true }), sync = page.getByLabel('Branches et synchronisation Git', { exact: true });
    await expect(sync).toContainText('main'); await sync.getByText('Branches locales et distantes', { exact: true }).click();
    await sync.getByLabel('Nouvelle branche Git', { exact: true }).fill('feature/jeu'); await sync.getByRole('button', { name: 'Créer la branche', exact: true }).click();
    await sync.getByRole('button', { name: 'Confirmer l’opération Git…', exact: true }).click(); await sync.getByRole('button', { name: 'Basculer sur feature/jeu', exact: true }).click();
    await sync.getByRole('button', { name: 'Confirmer l’opération Git…', exact: true }).click(); await expect(page.locator('.view-lines')).toContainText('GIT FEATURE');
    await page.keyboard.press('Control+Alt+g'); await expect(sync.getByLabel('Aperçu de l’opération Git', { exact: true })).toContainText('Fetch');
    await sync.getByRole('button', { name: 'Confirmer l’opération Git…', exact: true }).click(); await expect(sync).toContainText('Dernier fetch');
    await panel.getByRole('button', { name: 'Actualiser Git', exact: true }).click(); await panel.getByLabel('Nom de l’auteur Git', { exact: true }).fill('Fixture');
    await panel.getByLabel('Email de l’auteur Git', { exact: true }).fill('fixture@example.invalid'); await panel.getByRole('button', { name: 'Proposer le message par IA…', exact: true }).click();
    await expect(panel.getByLabel('Message du commit Git', { exact: true })).toHaveValue('Ajoute un écran de titre');
    await panel.getByLabel('Message du commit Git', { exact: true }).fill('Message relu et modifié');
    await panel.getByRole('button', { name: 'Préparer le commit de l’index', exact: true }).click(); await expect(panel.getByLabel('Diff du commit préparé', { exact: true })).toHaveValue('+10 REM GIT');
    await sync.getByText('Pull requests GitHub', { exact: true }).click(); await sync.getByRole('button', { name: 'Charger les PR ouvertes', exact: true }).click();
    await sync.getByLabel('Titre de la PR', { exact: true }).fill('Nouveau titre CPC'); await sync.getByLabel('Description de la PR', { exact: true }).fill('Recette de la branche');
    await sync.getByRole('button', { name: 'Créer la PR de la branche courante…', exact: true }).click(); await expect(sync).toContainText('#4 Nouveau titre CPC');
    assert.equal((await page.evaluate(() => window.githubCalls))[0][5], true);
    await page.screenshot({ path: 'out/git-remote-alpha.png' });
    const input = page.locator('.listing .monaco-editor textarea'); await input.focus(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('30 REM UNSAVED');
    await expect(sync.getByRole('button', { name: 'Push…', exact: true })).toBeDisabled(); const before = await page.evaluate(() => window.gitCalls.length);
    await page.keyboard.press('Control+Alt+k'); assert.equal(await page.evaluate(() => window.gitCalls.length), before);
    await command('Cloner un dépôt Git…'); await dialog.getByLabel('URL du dépôt à cloner', { exact: true }).fill('https://github.com/Fixture/jeu-prive.git');
    await dialog.getByLabel('Dossier du clone Git', { exact: true }).fill('copie'); await dialog.getByRole('button', { name: 'Cloner le projet…', exact: true }).click();
    await expect(dialog).toContainText('Clone annulé'); assert.equal((await page.evaluate(() => window.gitCalls)).some(call => call.name === 'clone'), false);
    await expect(page.locator('.view-lines')).toContainText('UNSAVED');
    await page.evaluate(() => { window.confirm = () => true; }); await dialog.getByRole('button', { name: 'Cloner le projet…', exact: true }).click();
    await expect(page.locator('.github-dialog')).toHaveCount(0); await expect(page.locator('.view-lines')).toContainText('GIT CLONE');
    console.log('Git workbench browser: private account/repository selection, direct remote association, branches/reload, fetch shortcut, reviewed AI message, draft PR and dirty clone guards passed.');
  } finally { await page.close(); }
}
