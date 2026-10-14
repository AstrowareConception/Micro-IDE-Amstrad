import { parsePersonalMissions, type PersonalMission } from '../../../packages/agent/src/missions.ts';

export const MISSION_STORAGE_KEY = 'cpceleste.missions.v1';
interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function readMissions(storage: StoragePort): { raw: string | null; missions: PersonalMission[] } {
  const raw = storage.getItem(MISSION_STORAGE_KEY);
  if (raw !== null && raw.length > 210000) throw Error('Bibliothèque personnelle trop volumineuse.');
  return { raw, missions: raw === null ? [] : parsePersonalMissions(JSON.parse(raw)) };
}
export function saveMissions(storage: StoragePort, expectedRaw: string | null, missions: PersonalMission[]): string {
  if (storage.getItem(MISSION_STORAGE_KEY) !== expectedRaw) throw Error('La bibliothèque a changé dans une autre fenêtre. Fermez puis rouvrez-la avant d’enregistrer.');
  const payload = { version: 1, missions };
  parsePersonalMissions(payload);
  const raw = JSON.stringify(payload);
  storage.setItem(MISSION_STORAGE_KEY, raw);
  return raw;
}
