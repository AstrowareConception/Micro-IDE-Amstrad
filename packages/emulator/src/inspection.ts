export const CPC_REGISTER_NAMES = ['PC', 'SP', 'AF', 'BC', 'DE', 'HL', 'IX', 'IY', "AF′", "BC′", "DE′", "HL′", 'RAM', 'ROM', 'GA'] as const;
export interface CpcInspection { address: number; bytes: Uint8Array; registers: number[]; ticks: number }
export function parseRamAddress(text: string): number | undefined {
  const value = text.trim().replace(/^(?:&|0x)/i, '');
  if (!/^[0-9a-f]{1,4}$/i.test(value)) return undefined;
  return parseInt(value, 16);
}
export function validInspection(value: unknown): value is CpcInspection {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CpcInspection>;
  return Number.isInteger(data.address) && data.address! >= 0 && data.address! <= 65535 &&
    data.bytes instanceof Uint8Array && data.bytes.length >= 1 && data.bytes.length <= 64 &&
    data.address! + data.bytes.length <= 65536 && Array.isArray(data.registers) &&
    data.registers.length === CPC_REGISTER_NAMES.length && data.registers.every(n => Number.isInteger(n) && n >= 0 && n <= 65535) &&
    typeof data.ticks === 'number' && Number.isSafeInteger(data.ticks) && data.ticks >= 0;
}
export function ramRows(snapshot: CpcInspection): { address: string; hex: string; text: string }[] {
  const rows = [];
  for (let i = 0; i < snapshot.bytes.length; i += 16) {
    const part = snapshot.bytes.slice(i, i + 16);
    rows.push({ address: (snapshot.address + i).toString(16).toUpperCase().padStart(4, '0'),
      hex: [...part].map(n => n.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      text: [...part].map(n => n >= 32 && n < 127 ? String.fromCharCode(n) : '·').join('') });
  }
  return rows;
}
