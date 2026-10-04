/** Firmware metadata only. No ROM bytes, host paths or qualification inferred from size. */
export const ROM_ROLES = ['os', 'basic', 'amsdos'] as const;
export type RomRole = typeof ROM_ROLES[number];
export const ROM_BYTES = 16384;
export const CPC_PROFILE = 'cpc6128-classic-v1';
export interface FirmwareConfiguration { schemaVersion: 1; profile: typeof CPC_PROFILE; slots: Partial<Record<RomRole, string>> }
export interface FirmwareStatus {
  profile: typeof CPC_PROFILE; qualification: 'experimental'; complete: boolean;
  slots: { role: RomRole; state: 'absent' | 'available' | 'invalid'; sha256?: string }[];
}
export interface FirmwarePort {
  status(): Promise<FirmwareStatus | { error: string }>;
  importRom(role: RomRole): Promise<FirmwareStatus | { error: string } | null>;
  clear(): Promise<FirmwareStatus | { error: string }>;
}
export function romRole(value: unknown): RomRole {
  if (!ROM_ROLES.includes(value as RomRole)) throw new Error('Rôle ROM invalide.');
  return value as RomRole;
}
export function parseFirmware(value: unknown): FirmwareConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuration ROM invalide.');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'profile,schemaVersion,slots' || v.schemaVersion !== 1 || v.profile !== CPC_PROFILE ||
      !v.slots || typeof v.slots !== 'object' || Array.isArray(v.slots)) throw new Error('Configuration ROM non prise en charge.');
  const slots: FirmwareConfiguration['slots'] = {};
  for (const [role, hash] of Object.entries(v.slots)) {
    const key = romRole(role);
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Empreinte ROM invalide.');
    slots[key] = hash;
  }
  return { schemaVersion: 1, profile: CPC_PROFILE, slots };
}
