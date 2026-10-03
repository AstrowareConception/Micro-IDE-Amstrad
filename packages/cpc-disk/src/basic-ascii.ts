/** J0 transport validation only. Full BASIC syntax analysis belongs to J2. */
export function encodeBasicAscii(source: string): Uint8Array {
  if (!source || source.charCodeAt(0) === 0xfeff || source.includes("\r")) {
    throw new Error("BASIC source must be nonempty UTF-8 text with LF and no BOM");
  }
  const lines = source.endsWith("\n") ? source.slice(0, -1).split("\n") : source.split("\n");
  let previous = 0;
  for (const line of lines) {
    if (!/^[\x20-\x7e]+$/.test(line)) throw new Error("Only printable ASCII is supported by J0");
    const match = /^(\d+) +\S/.exec(line);
    const number = Number(match?.[1]);
    if (!match || number <= previous || number > 65535) {
      throw new Error("BASIC line numbers must increase from 1 to 65535");
    }
    previous = number;
  }
  return new TextEncoder().encode(lines.join("\r\n") + "\r\n\x1a");
}
