import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { newProject } from '../packages/workspace/src/project.ts';

export async function verifyAgentWorkbench(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ manifest }) => {
    const initial = '10 REM ORIGINAL\n20 END\n', title = '10 MODE 1\n20 PRINT "MAHJONG"\n30 END\n';
    const snapshot = { sessionId: 'agent-ui', manifest, files: [{ ...manifest.sources[0], source: initial }] };
    const pricing = { model: 'gpt-5.6-luna', input: .2, cached: .02, output: 1.2, cacheWriteMultiplier: 1.25, fetchedAt: new Date().toISOString(), source: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna' };
    let configured = false, model = '', phase = 'paused', polls = 0;
    window.agentCalls = [];
    window.desktop = { setDirty() {}, open: async () => null, save: async () => null, exportDisk: async () => null,
      project: { open: async () => snapshot },
      agent: {
        models: async () => { configured = true; return { models: [{ id: 'gpt-5.6-luna', created: 100, owner: 'openai' }], fetchedAt: new Date().toISOString(), model }; },
        selectModel: async value => { model = value; return { model }; },
        configure: async () => { configured = false; return { configured: false, model: '' }; },
        pricing: async () => pricing,
        start: async (session, objective, buffers, docs, budget) => { window.agentCalls.push({ action: 'start', session, objective, buffers, docs, budget }); if (!configured || model !== pricing.model) throw new Error('Missing configuration'); return { taskId: 'mission-ui' }; },
        resume: async (taskId, buffers, session) => { window.agentCalls.push({ action: 'resume', taskId, buffers, session }); phase = 'resume'; return { taskId }; },
        status: async () => {
          const running = phase === 'resume' && polls++ < 1;
          const completed = phase === 'resume' && !running;
          return { taskId: 'mission-ui', running, status: completed ? 'completed' : 'paused-limit', turns: completed ? 16 : 12, calls: completed ? 15 : 12, tokens: completed ? 6000 : 4000,
            summary: completed ? 'Titre enregistré ; DSK construit. Aucun CPC exécuté.' : 'Budget de tours modèle atteint.', model, budget: { maxTurns: 12, maxCalls: 60, maxTokens: 60000 }, pricing,
            failedCalls: 1, usage: { input: completed ? 4500 : 3000, output: completed ? 1500 : 1000, cached: 600, cacheWrite: 100, reasoning: 400, complete: true }, estimatedUsd: .001234, costComplete: true,
            resumable: !completed && !running, workspace: { ...snapshot, files: [{ ...snapshot.files[0], source: completed ? title : initial, saved: completed ? title : initial }] },
            changed: completed ? ['src/main.bas'] : [], before: completed ? [{ id: 'main', source: initial }] : [], buildVerified: completed,
            events: [{ kind: 'message', text: 'Je prépare un titre avec quatre couleurs en MODE 1.' }, { kind: 'tool', tool: 'project_replace_source', text: 'project_replace_source' }, { kind: 'tool-result', tool: 'project_replace_source', success: false, text: 'reference-required : consulter MODE avec reference_read_many.' }, ...(completed ? [{ kind: 'tool-result', tool: 'project_replace_source', success: true, text: 'Source enregistrée : main' }] : [])] };
        },
        restore: async () => ({ ...snapshot, files: [{ ...snapshot.files[0], saved: initial }] }),
      },
    };
  }, { manifest: newProject('Agent interface', '20000000-0000-4000-8000-000000000001') });
  try {
    await page.goto('http://127.0.0.1:5173'); await page.locator('.view-lines').first().waitFor();
    await page.getByRole('button', { name: 'Ouvrir projet', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Agent OpenAI', exact: true });
    await expect(page.getByLabel('Clé API OpenAI', { exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Réglages IA', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Réglages de l’agent IA', exact: true });
    await settings.getByLabel('Clé API OpenAI', { exact: true }).fill('sk-ui-fixture-not-real');
    await settings.getByRole('button', { name: 'Configurer la clé', exact: true }).click();
    await expect(settings.getByLabel('Clé API OpenAI', { exact: true })).toHaveValue('');
    await settings.getByLabel('Modèle OpenAI', { exact: true }).selectOption('gpt-5.6-luna');
    await expect(settings).toContainText('Tarif officiel actualisé.');
    await settings.getByLabel('Tours modèle maximum', { exact: true }).fill('12');
    await page.screenshot({ path: 'out/agent-settings-alpha.png' });
    await page.keyboard.press('Escape'); await expect(settings).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Réglages IA', exact: true })).toBeFocused();
    await panel.getByLabel('Mission de programmation', { exact: true }).fill('Crée un écran de titre Mahjong en MODE 1.');
    await panel.getByRole('button', { name: 'Lancer l’agent', exact: true }).click();
    await expect(panel).toContainText('Mission en pause — limite atteinte');
    await expect(panel).toContainText('Aucun fichier modifié');
    await expect(panel.locator('.agent-tool-error').first()).toContainText('reference-required');
    await expect(panel).toContainText('0.001234 USD');
    await expect(panel.getByRole('button', { name: 'Restaurer le checkpoint initial', exact: true })).toBeDisabled();
    await expect(panel.locator('.agent-events')).toBeHidden();
    await panel.getByText(/Journal technique/).click();
    await expect(panel.locator('.agent-events')).toContainText('Échec');
    await page.screenshot({ path: 'out/agent-pause-alpha.png' });
    await panel.getByRole('button', { name: 'Reprendre la mission', exact: true }).click();
    await expect(panel).toContainText('Mission terminée');
    await expect(panel).toContainText('16 tours');
    await expect(page.locator('.view-lines')).toContainText('MAHJONG');
    await expect(panel.getByRole('button', { name: 'Restaurer le checkpoint initial', exact: true })).toBeEnabled();
    const calls = await page.evaluate(() => window.agentCalls);
    assert.equal(calls[0].budget.maxTurns, 12); assert.equal(calls[1].taskId, 'mission-ui'); assert.equal(calls[1].buffers[0].source, '10 REM ORIGINAL\n20 END\n');
    await panel.getByText('Changements (1)', { exact: true }).click();
    await expect(panel).toContainText('Avant'); await expect(panel).toContainText('Après');
    await page.screenshot({ path: 'out/agent-missions-alpha.png' });
    await panel.getByRole('button', { name: 'Restaurer le checkpoint initial', exact: true }).click();
    await expect(page.locator('.view-lines')).toContainText('ORIGINAL');
    await expect(panel).toContainText('Checkpoint initial restauré');
    await page.keyboard.press('Control+Alt+n'); const notifications = page.getByRole('dialog', { name: 'Centre de notifications', exact: true });
    await notifications.getByLabel('Origine des notifications', { exact: true }).selectOption('agent');
    await expect(notifications).toContainText('Mission terminée · 1 fichier(s) modifié(s) · 6000 tokens.');
    await expect(notifications).toContainText('Mission en pause — limite atteinte');
    await expect(notifications).not.toContainText('Je prépare un titre'); await expect(notifications).not.toContainText('sk-ui-fixture'); await expect(notifications).not.toContainText('reference-required');
    await page.keyboard.press('Escape');
    console.log('Agent UI: settings separated, key cleared, official rate, optional steering, pause/error/live counters/cost/resume/diff/restore passed with controlled fixtures.');
  } finally { await page.close(); }
}
