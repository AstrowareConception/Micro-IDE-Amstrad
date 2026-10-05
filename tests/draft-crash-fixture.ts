import { ProjectStore } from '../apps/desktop/project-store.ts';
const { store, snapshot } = await ProjectStore.open(process.argv[2]!);
await store.captureDrafts(snapshot.files.map(file => ({ id: file.id, source: file.source + `30 REM UNSAVED ${file.id}\n` })), null);
process.on('message', () => undefined); process.send?.({ ready: true }); await new Promise(() => undefined);
