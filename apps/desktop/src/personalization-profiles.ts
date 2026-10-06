import { parsePreferences, type Preferences } from './preferences.ts';
import { keymapErrors } from './keymap.ts';
export const PROFILES_KEY = 'cpceleste.personalization-profiles.v1';
export interface PersonalizationProfile { name: string; preferences: Preferences }
export const PROFILE_LIMIT = 12, PROFILE_BYTES = 65536;
export function profileName(value: string): string {
  const name = value.trim(); if (!name || name.length > 60 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Nom de profil requis, de 1 à 60 caractères.'); return name;
}
export function exportProfile(name: string, preferences: Preferences): string {
  return JSON.stringify({ format: 'cpceleste-personalization', version: 1, name: profileName(name), preferences: parsePreferences(preferences) }, null, 2);
}
export function importProfile(text: string): PersonalizationProfile {
  if (new TextEncoder().encode(text).length > PROFILE_BYTES) throw new Error('Profil limité à 64 Kio.');
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'format,name,preferences,version' || value.format !== 'cpceleste-personalization' || value.version !== 1 || typeof value.name !== 'string') throw new Error('Format ou version de profil inconnu ; import refusé.');
  const preferences = value.preferences;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences) || Object.keys(preferences).some(key => !Object.hasOwn(parsePreferences(null), key))) throw new Error('Le profil contient des réglages inconnus.');
  if (preferences.keymap && (typeof preferences.keymap !== 'object' || Array.isArray(preferences.keymap) || Object.keys(preferences.keymap).some(key => !Object.hasOwn(parsePreferences(null).keymap, key)) || keymapErrors({ ...parsePreferences(null).keymap, ...preferences.keymap }).length)) throw new Error('Raccourcis invalides ou contradictoires dans le profil.');
  return { name: profileName(value.name), preferences: parsePreferences(preferences) };
}
export function loadProfiles(): PersonalizationProfile[] {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? 'null');
    if (value?.version !== 1 || !Array.isArray(value.profiles) || value.profiles.length > PROFILE_LIMIT) return [];
    const profiles = value.profiles.map((profile: PersonalizationProfile) => importProfile(exportProfile(profile.name, profile.preferences)));
    if (new Set(profiles.map((profile: PersonalizationProfile) => profile.name.toLocaleLowerCase('fr'))).size !== profiles.length) return [];
    return profiles;
  } catch { return []; }
}
export function profilesRevision(): string | null | undefined { try { return localStorage.getItem(PROFILES_KEY); } catch { return undefined; } }
export function saveProfiles(profiles: PersonalizationProfile[], expected?: string | null): boolean {
  try {
    const current = localStorage.getItem(PROFILES_KEY);
    if (expected !== undefined && current !== expected) return false;
    if (current !== null && JSON.parse(current)?.version !== 1 || profiles.length > PROFILE_LIMIT) return false;
    const clean = profiles.map(profile => importProfile(exportProfile(profile.name, profile.preferences)));
    if (new Set(clean.map(profile => profile.name.toLocaleLowerCase('fr'))).size !== clean.length) return false;
    localStorage.setItem(PROFILES_KEY, JSON.stringify({ version: 1, profiles: clean })); return true;
  } catch { return false; }
}
