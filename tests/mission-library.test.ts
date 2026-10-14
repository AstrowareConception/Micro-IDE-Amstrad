import test from 'node:test';
import assert from 'node:assert/strict';
import { composeMission, MISSION_RECIPES, parsePersonalMissions } from '../packages/agent/src/missions.ts';
import { MISSION_STORAGE_KEY, readMissions, saveMissions } from '../apps/desktop/src/mission-storage.ts';

test('mission parameters stay literal, bounded and separate from tool authority', () => {
  const recipe = MISSION_RECIPES.find(item => item.id === 'basic-title')!;
  const text = composeMission(recipe, { focus: '$& {{goal}} <script>literal</script>', goal: 'Créer mon titre' });
  assert.ok(text.includes('$& {{goal}} <script>literal</script>'));
  assert.ok(text.includes('Aucun shell, installation, publication'));
  assert.throws(() => composeMission(recipe, { focus: '', goal: 'titre' }));
  assert.throws(() => composeMission(recipe, { focus: 'x', goal: 'x'.repeat(3001) }));
  for (const item of MISSION_RECIPES) assert.ok(composeMission(item, item).length < 20000);
  assert.equal(new Set(MISSION_RECIPES.map(item => item.id)).size, MISSION_RECIPES.length);
});
test('personal mission persistence validates quotas and refuses stale or damaged storage', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const mission = { id: 'user-example', kind: 'basic' as const, title: 'Mon titre', prompt: 'Un texte personnel <b>inerte</b>' };
  assert.deepEqual(readMissions(storage), { raw: null, missions: [] });
  const raw = saveMissions(storage, null, [mission]);
  assert.deepEqual(readMissions(storage).missions, [mission]);
  assert.throws(() => saveMissions(storage, null, []), /autre fenêtre/);
  assert.equal(storage.getItem(MISSION_STORAGE_KEY), raw);
  assert.throws(() => saveMissions(storage, raw, [mission, mission]), /invalide/);
  for (const candidate of [{ version: 2, missions: [] }, { version: 1, missions: [{ ...mission, kind: 'shell' }] }, { version: 1, missions: [{ ...mission, prompt: 'x'.repeat(20001) }] }, { version: 1, missions: Array.from({ length: 21 }, (_, index) => ({ ...mission, id: `user-${index}` })) }, { version: 1, missions: Array.from({ length: 11 }, (_, index) => ({ ...mission, id: `user-${index}`, prompt: 'x'.repeat(20000) })) }]) assert.throws(() => parsePersonalMissions(candidate));
  storage.setItem(MISSION_STORAGE_KEY, '{broken');
  assert.throws(() => readMissions(storage));
  assert.throws(() => saveMissions(storage, raw, []));
  assert.equal(storage.getItem(MISSION_STORAGE_KEY), '{broken');
  const unavailable = { getItem: () => null, setItem: () => { throw Error('QuotaExceeded'); } };
  assert.throws(() => saveMissions(unavailable, null, [mission]), /QuotaExceeded/);
});
