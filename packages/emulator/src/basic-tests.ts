export const BASIC_TEST_LIMITS = { sources: 8, cases: 32, sourceBytes: 16 * 1024, seconds: 15 } as const;
export const BASIC_TEST_MAILBOX = 0x8000;
export const BASIC_TEST_SIGNATURE = [67, 80, 67, 165] as const;
export interface BasicTestSource { id: string; name: string; source: string }
export interface BasicTestCase { slot: number; name: string; line: number }
export interface BasicTestPlan { source: BasicTestSource; cases: BasicTestCase[] }
export type BasicTestOutcome = 'passed' | 'failed' | 'incomplete' | 'timeout' | 'blocked' | 'cancelled';
export interface BasicTestResult {
 sourceId: string; name: string; outcome: BasicTestOutcome; message: string;
 cases: (BasicTestCase & { outcome: 'passed' | 'failed' | 'incomplete'; observed: number })[];
 emulatedSeconds: number; diskSha256?: string; sourceSha256?: string;
 firmware?: Record<'os' | 'basic' | 'amsdos', string>;
}
export function validBasicTestResult(value: unknown, plan: BasicTestPlan): value is BasicTestResult {
 if (!value || typeof value !== 'object') return false;
 const result = value as BasicTestResult;
 if (result.sourceId !== plan.source.id || result.name !== plan.source.name || typeof result.message !== 'string' || result.message.length > 4096 || !Number.isFinite(result.emulatedSeconds) || result.emulatedSeconds < 0 || !Array.isArray(result.cases)) return false;
 if (!['passed', 'failed', 'incomplete', 'timeout', 'blocked'].includes(result.outcome)) return false;
 for (const hash of [result.diskSha256, result.sourceSha256]) if (hash !== undefined && (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) return false;
 if (result.firmware && !['os', 'basic', 'amsdos'].every(role => typeof result.firmware![role as 'os'] === 'string' && /^[a-f0-9]{64}$/.test(result.firmware![role as 'os']))) return false;
 if (result.outcome === 'timeout' || result.outcome === 'blocked') return result.cases.length === 0;
 if (result.cases.length !== plan.cases.length || !result.diskSha256 || !result.sourceSha256) return false;
 if (!result.cases.every((test, index) => {
  const declared = plan.cases[index]!;
  return !!test && test.slot === declared.slot && test.name === declared.name && test.line === declared.line && Number.isInteger(test.observed) && test.observed >= 0 && test.observed <= 255 && test.outcome === (test.observed === 1 ? 'passed' : test.observed === 2 ? 'failed' : 'incomplete');
 })) return false;
 const expected = result.cases.some(test => test.outcome === 'incomplete') ? 'incomplete' : result.cases.some(test => test.outcome === 'failed') ? 'failed' : 'passed';
 return result.outcome === expected;
}
export function basicTestPlan(source: BasicTestSource): BasicTestPlan {
 if (!source || typeof source.id !== 'string' || typeof source.name !== 'string' || typeof source.source !== 'string' || new TextEncoder().encode(source.source).length > BASIC_TEST_LIMITS.sourceBytes) throw new Error('Listing de test limité à 16 Kio UTF-8.');
 const cases: BasicTestCase[] = [];
 for (const [index, line] of source.source.split(/\r?\n/).entries()) {
  // Only a whole numbered REM line declares a case, never strings or inline comments.
  const marker = /^\s*\d+\s+REM\s+@CPCTEST\b(.*)$/i.exec(line);
  if (!marker) continue;
  const item = /^\s+([1-9]\d?)\s+([^\r\n]+?)\s*$/.exec(marker[1]!);
  if (!item || Number(item[1]) > BASIC_TEST_LIMITS.cases || item[2]!.length > 120 || /[\x00-\x1f\x7f]/.test(item[2]!)) throw new Error(`Déclaration @CPCTEST invalide à la ligne ${index + 1} : slot 1–32 et nom de 120 caractères maximum requis.`);
  const slot = Number(item[1]);
  if (cases.some(test => test.slot === slot)) throw new Error(`Slot @CPCTEST ${slot} déclaré plusieurs fois.`);
  cases.push({ slot, name: item[2]!, line: index + 1 });
 }
 if (!cases.length) throw new Error('Aucun test déclaré : ajoutez une ligne numérotée REM @CPCTEST 1 Nom du test.');
 return { source: { ...source }, cases };
}
export function completedBasicTests(plan: BasicTestPlan, mailbox: Uint8Array): Pick<BasicTestResult, 'outcome' | 'message' | 'cases'> | undefined {
 if (mailbox.length !== 36) throw new Error('Boîte de résultats BASIC invalide.');
 if (!BASIC_TEST_SIGNATURE.every((value, i) => mailbox[i] === value)) return undefined;
 const cases = plan.cases.map(test => {
  const observed = mailbox[3 + test.slot]!;
  return { ...test, observed, outcome: observed === 1 ? 'passed' as const : observed === 2 ? 'failed' as const : 'incomplete' as const };
 });
 const outcome = cases.some(test => test.outcome === 'incomplete') ? 'incomplete' : cases.some(test => test.outcome === 'failed') ? 'failed' : 'passed';
 return { cases, outcome, message: outcome === 'passed' ? 'Toutes les assertions déclarées ont réussi.' : outcome === 'failed' ? 'Au moins une assertion a échoué.' : 'Fin reçue, mais une assertion manque ou contient une valeur autre que 1/2.' };
}
export function basicTestsMarkdown(results: BasicTestResult[]): string {
 const safe = (value: string) => value.replace(/[\r\n]/g, ' ').replace(/[\\`*_{}\[\]<>|#]/g, '\\$&');
 return '# Rapport de tests BASIC\n\nExécution CPC intégrée ; aucune qualification indépendante ou matérielle implicite.\n\n' + results.map(result => `## ${safe(result.name)}\n\nÉtat : ${result.outcome}. ${safe(result.message)}\n\nTemps émulé total : ${result.emulatedSeconds.toFixed(3)} s.\n\nSource SHA-256 : ${result.sourceSha256 ?? 'non préparée'}.\nDSK SHA-256 : ${result.diskSha256 ?? 'non préparé'}.\n\n${result.firmware ? Object.entries(result.firmware).map(([role, hash]) => `${role} : ${hash}`).join('\n') + '\n\n' : ''}${result.cases.map(test => `- Slot ${test.slot} · ${safe(test.name)} : ${test.outcome} (octet ${test.observed}).`).join('\n')}`).join('\n\n');
}
export const BASIC_TEST_EXAMPLE = `10 MEMORY &7FFF
20 REM @CPCTEST 1 Score positif
30 REM @CPCTEST 2 Bonus nul
40 score=100:bonus=50:GOSUB 1000
50 IF score=150 THEN POKE &8004,1 ELSE POKE &8004,2
60 score=100:bonus=0:GOSUB 1000
70 IF score=100 THEN POKE &8005,1 ELSE POKE &8005,2
80 POKE &8000,67:POKE &8001,80:POKE &8002,67:POKE &8003,165
90 END
1000 score=score+bonus
1010 RETURN
`;
