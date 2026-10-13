import { obfuscateBasic, type ObfuscationOptions } from '../../basic-language/src/obfuscate.ts';
import { encodeBasicFile } from './basic-codec.ts';
import { encodeBasicAscii } from './basic-ascii.ts';
import { createDataDisk, type DiskFile } from './data-disk.ts';
export type DistributionMode = 'obfuscate' | 'protected' | 'combined';
export interface DistributionOptions extends ObfuscationOptions { mode: DistributionMode }
export function prepareDistribution(sources: { name: string; source: string }[], options: DistributionOptions) {
  if (!options || !['obfuscate','protected','combined'].includes(options.mode) || ['rename','comments','renumber'].some(key=>typeof options[key as keyof ObfuscationOptions]!=='boolean')) throw new Error('Options d’export invalides.');
  if (!sources.length || sources.length>64) throw new Error('1 à 64 sources requises.');
  if (sources.length>1 && options.mode!=='protected') throw new Error('Obfuscation réservée à un programme autonome : variables et entrées partagées entre fichiers non qualifiées.');
  return sources.map(file=> {
    const result=options.mode==='protected'?{ source:file.source,names:[],lines:[] }:obfuscateBasic(file.source,options);
    const bytes=options.mode==='obfuscate'?encodeBasicAscii(result.source):encodeBasicFile(file.name,result.source,true);
    return { name:file.name,...result,bytes };
  });
}
export function distributionDisk(sources: { name: string; source: string }[], options: DistributionOptions, resources: DiskFile[]=[]): Uint8Array {
  // Do not inadvertently ship an unselected BASIC source as an opaque resource.
  for (const file of resources) {
    const checksum=file.bytes.subarray(0,67).reduce((a,b)=>a+b,0);
    const basicHeader=file.bytes.length>=128 && checksum!==0 && checksum===file.bytes[67]!+256*file.bytes[68]! && [0,1].includes(file.bytes[18]!);
    const text=new TextDecoder().decode(file.bytes.subarray(0,256));
    if (basicHeader || /^\d+ +\S/.test(text)) throw new Error(`Ressource BASIC ${file.name} : importez-la comme source avant l’export de distribution.`);
  }
  return createDataDisk([...prepareDistribution(sources,options),...resources]);
}
