export const BASIC_DEBUG_PROFILE = {
  firmwareKey: 'ce133ea170940147f6c73d6c9f9e7a05be81fc8ff9aae8386011c47e593852bf:58503070d553d7152a2dbce40976418281a8bf1f4a5a7ede75269f2e39275977:ea65e0fb44ee93ede4b6c507509b7e5ddf497fb7155023bea91ef229469fa04d',
  boundary: 0xde60,
  upperRom: 0,
  linePointerAddress: 0xae1d,
  statementRegisterIndex: 5,
  tickBudget: 40_000_000,
} as const;

export type BasicDebugStopReason = 'step' | 'breakpoint' | 'budget';

export interface BasicDebugSnapshot {
  line: number;
  linePointer: number;
  statementPointer: number;
  ticks: number;
  reason: BasicDebugStopReason;
}

export function firmwareKey(firmware: Record<'os' | 'basic' | 'amsdos', string>): string {
  return [firmware.os, firmware.basic, firmware.amsdos].join(':');
}

export function basicDebuggerAvailable(firmware: Record<'os' | 'basic' | 'amsdos', string>): boolean {
  return firmwareKey(firmware) === BASIC_DEBUG_PROFILE.firmwareKey;
}

export function parseBreakpointLines(text: string): number[] | undefined {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const values = trimmed.split(/[\s,;]+/).filter(Boolean);
  if (values.length > 64) return undefined;
  const lines = new Set<number>();
  for (const value of values) {
    if (!/^\d{1,5}$/.test(value)) return undefined;
    const line = Number(value);
    if (!Number.isInteger(line) || line < 1 || line > 65535) return undefined;
    lines.add(line);
  }
  return [...lines].sort((a, b) => a - b);
}

export function validBasicDebugSnapshot(value: unknown): value is BasicDebugSnapshot {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<BasicDebugSnapshot>;
  return Number.isInteger(data.line) && data.line! >= 1 && data.line! <= 65535 &&
    Number.isInteger(data.linePointer) && data.linePointer! >= 0x100 && data.linePointer! <= 0xffff &&
    Number.isInteger(data.statementPointer) && data.statementPointer! >= 0 && data.statementPointer! <= 0xffff &&
    typeof data.ticks === 'number' && Number.isSafeInteger(data.ticks) && data.ticks >= 0 &&
    (data.reason === 'step' || data.reason === 'breakpoint' || data.reason === 'budget');
}
