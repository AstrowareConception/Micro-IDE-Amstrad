/// <reference lib="webworker" />
import type { BasicScenarioCapture } from '../../../packages/emulator/src/basic-test-scenario.ts';
import { basicTestPlan, type BasicTestSource } from '../../../packages/emulator/src/basic-tests.ts';
import { executeBasicTests, type BasicTestCpc } from '../../../packages/emulator/src/basic-test-runtime.ts';
import type { RunImage } from '../../../packages/emulator/src/run.ts';
const scope = self as unknown as DedicatedWorkerGlobalScope;
let started = false;
scope.onmessage = event => {
 if (started) return;
 started = true;
 const { id, source, image, seconds } = event.data as { id: string; source: BasicTestSource; image: RunImage; seconds: number };
 void (async () => {
  const plan = basicTestPlan(source);
  const moduleUrl = new URL('../emulator/cpc.mjs', scope.location.href).href;
  const { default: createCpc } = await import(/* @vite-ignore */ moduleUrl);
  const cpc = await createCpc({ locateFile: (name: string) => new URL(name, moduleUrl).href }) as BasicTestCpc;
  const captures: BasicScenarioCapture[] = [];
  const result = await executeBasicTests(cpc, image, plan, seconds, () => new Promise(resolve => setTimeout(resolve, 0)), capture => captures.push(capture));
  scope.postMessage({ id, result, captures }, captures.map(capture => capture.rgba.buffer as ArrayBuffer));
 })().catch(() => scope.postMessage({ id, error: 'Worker de tests CPC indisponible ; vérifiez le build WASM.' }));
};
