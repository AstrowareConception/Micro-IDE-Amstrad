/** Original minimal PDFs, generated from exact objects/xref offsets, without third-party content. */
export function pdfFixture(pages: string[][] = [['TITRE PDF', 'Regles originales'], ['PRIVATE UNREAD PDF PAGE']], encrypted = false, fontSize = 14): Buffer {
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert\(PRIVATE_SCRIPT\)) >> >>');
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (const [index, lines] of pages.entries()) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    const escape = (value: string) => value.replace(/[\\()]/g, character => '\\' + character);
    const stream = `BT /F1 ${fontSize} Tf 30 260 Td ${lines.map((line, i) => `${i ? '0 -24 Td ' : ''}(${escape(line)}) Tj`).join('\n')} ET`;
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }
  // Parser must refuse password-gated content without prompting, even with malformed ciphertext.
  if (encrypted) objects.push(`<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${'00'.repeat(32)}> /U <${'00'.repeat(32)}> /P -4 >>`);
  let result = '%PDF-1.7\n'; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(result, 'latin1')); result += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const start = Buffer.byteLength(result, 'latin1');
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${encrypted ? ` /Encrypt ${objects.length} 0 R /ID [<${'11'.repeat(16)}> <${'11'.repeat(16)}>]` : ''} >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(result, 'latin1');
}
