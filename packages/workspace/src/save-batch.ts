export interface SaveEntry { id: string; before: Uint8Array; after: Uint8Array }
export interface SaveBatchPort {
  assertCurrent(): Promise<void>;
  read(id: string): Promise<Uint8Array>;
  /** Resolve after replacement; reject before replacement. */
  write(id: string, content: Uint8Array): Promise<void>;
}
export class SaveBatchFailure extends Error {
  readonly incomplete: boolean;
  constructor(incomplete: boolean, cause: unknown) {
    super(incomplete ? 'Enregistrement partiel ; restauration incomplète. Projet bloqué : conserver les fichiers et rouvrir après examen.' : `Enregistrer tout a échoué ; écritures du lot restaurées. ${cause instanceof Error ? cause.message : 'Erreur disque.'}`);
    this.incomplete = incomplete;
  }
}
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, index) => value === b[index]);
/** In-process compensation only. No durable journal or interprocess lock. */
export async function saveBatch(entries: readonly SaveEntry[], port: SaveBatchPort): Promise<string[]> {
  if (!entries.length || new Set(entries.map(item => item.id)).size !== entries.length) throw new Error('Lot de sauvegarde vide ou dupliqué.');
  await port.assertCurrent();
  for (const item of entries) if (!same(await port.read(item.id), item.before)) throw new Error(`Conflit externe : ${item.id}. Aucune source enregistrée.`);
  const written: SaveEntry[] = [];
  try {
    for (const item of entries) {
      await port.assertCurrent();
      if (!same(await port.read(item.id), item.before)) throw new Error(`Conflit externe : ${item.id}.`);
      if (same(item.before, item.after)) continue;
      await port.write(item.id, item.after); written.push(item);
    }
    await port.assertCurrent();
    for (const item of entries) if (!same(await port.read(item.id), item.after)) throw new Error(`Conflit externe après écriture : ${item.id}.`);
    return written.map(item => item.id);
  } catch (cause) {
    let incomplete = false;
    for (const item of written.toReversed()) {
      try {
        if (!same(await port.read(item.id), item.after)) throw new Error('Version externe conservée.');
        await port.write(item.id, item.before);
      } catch { incomplete = true; }
    }
    throw new SaveBatchFailure(incomplete, cause);
  }
}
