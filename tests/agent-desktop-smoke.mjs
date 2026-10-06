import { expect } from '@playwright/test';

/** Native UI + IPC + controller + real project writes; OpenAI responses remain controlled/free. */
export async function verifyAgentDesktop(desktop, page) {
  await desktop.evaluate(() => {
    let step = 0;
    const model = 'gpt-5.6-luna';
    globalThis.fetch = async (url, init) => {
      if (url === 'https://api.openai.com/v1/models') return Response.json({ data: [{ id: model, created: 100, owned_by: 'openai' }] });
      if (url === `https://developers.openai.com/api/docs/models/${model}.md`) {
        if (init.headers.Authorization) throw new Error('Public price request leaked authorization');
        return new Response('Model ID: `gpt-5.6-luna`\n\n## Pricing\n\n| Input | $0.2 | 1M tokens |\n| Cached input | $0.02 | 1M tokens |\n| Output | $1.2 | 1M tokens |\n\n- Cache writes are billed at 1.25x the uncached input token rate.\n\n## Endpoints\n');
      }
      if (url !== 'https://api.openai.com/v1/responses') throw new Error('Unexpected endpoint');
      const body = JSON.parse(init.body);
      const call = (id, name, args) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) });
      let output;
      if (++step === 1) output = [call('resume-read', 'project_read_file', { id: 'main', startLine: 1, endLine: 200 })];
      else if (step === 2) output = [call('resume-refs', 'reference_read_many', { names: ['PRINT', 'END'] })];
      else if (step === 3) {
        const read = JSON.parse(body.input.find(item => item.type === 'function_call_output' && item.call_id === 'resume-read').output);
        output = [call('resume-write', 'project_replace_source', { id: 'main', expectedHash: read.hash, source: '10 PRINT "NATIVE RESUME"\n20 END\n' })];
      } else if (step === 4) output = [call('resume-build', 'build_project', {})];
      else output = [{ type: 'message', content: [{ type: 'output_text', text: 'Reprise native : fichier enregistré, DSK construit, aucun CPC exécuté.' }] }];
      return Response.json({ model, service_tier: 'default', status: 'completed', output, usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 40, cache_write_tokens: 10 }, output_tokens_details: { reasoning_tokens: 5 } } });
    };
  });
  await page.getByRole('button', { name: 'Réglages IA', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages de l’agent IA', exact: true });
  await settings.getByLabel('Clé API OpenAI', { exact: true }).fill('sk-test-fixture-not-real');
  await settings.getByRole('button', { name: 'Configurer la clé', exact: true }).click();
  await settings.getByLabel('Modèle OpenAI', { exact: true }).selectOption('gpt-5.6-luna');
  await expect(settings).toContainText('Tarif officiel actualisé.');
  await settings.getByLabel('Tours modèle maximum', { exact: true }).fill('1');
  await settings.getByRole('button', { name: 'Fermer les réglages IA', exact: true }).click();
  await page.getByLabel('Mission de programmation', { exact: true }).fill('Ajoute un titre puis construis le DSK.');
  await page.getByRole('button', { name: 'Lancer l’agent', exact: true }).click();
  const result = page.locator('.agent-result');
  for (let turn = 1; turn <= 4; turn++) {
    await expect(result).toContainText(`${turn} tours`);
    await expect(result).toContainText('Mission en pause — limite atteinte');
    await page.getByRole('button', { name: 'Reprendre la mission', exact: true }).click();
  }
  await expect(result).toContainText('Mission terminée');
  await expect(result).toContainText('5 tours');
  await expect(result).toContainText('600 tokens');
  await expect(result).toContainText(/0\.00018[67] USD/);
  await expect(result).toContainText('DSK construit et relu.');
  await expect(result).toContainText('1 fichier(s) modifié(s)');
  await page.screenshot({ path: 'out/agent-missions-desktop-alpha.png' });
  await page.getByRole('button', { name: 'Restaurer le checkpoint initial', exact: true }).click();
  await expect(page.locator('.agent-notice')).toContainText('Checkpoint initial restauré');
  console.log('Native agent: official tariff without key, one-turn pauses, same-task continuation across IPC, write/build, cumulative 600 tokens/USD and original checkpoint restore passed.');
}
