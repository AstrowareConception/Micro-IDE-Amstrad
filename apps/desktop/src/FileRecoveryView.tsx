import { useState } from 'react';
import type { DiskImportPreview } from '../../../packages/cpc-disk/src/import-disk.ts';
import { files } from './port.ts';
import { Button } from './Icon.tsx';
export function FileRecoveryView({ previewId, file }: { previewId:string; file:DiskImportPreview['files'][number] }) {
  const [origin,setOrigin]=useState(file.loadAddress?.toString()??''),[offset,setOffset]=useState('0');
  const [length,setLength]=useState(String(Math.min(256,file.payloadBytes??file.recordBytes)));
  const [listing,setListing]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function extract(text?:string) {
    setBusy(true);try{const result=await files.diskImport?.extract?.({id:previewId,fileId:file.id,...(text===undefined?{}:{listing:text})});setMessage(result?('error' in result?result.error:`Enregistré : ${result.name}`):'Extraction annulée.');}catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  return <section aria-label="Récupération du fichier">
    <Button type="button" disabled={busy||!files.diskImport?.extract} onClick={()=>void extract()}>Extraire les octets originaux…</Button>
    {file.source===undefined && <>
      <p>Un binaire peut contenir du code, des images ou des données. Le désassemblage Z80 produit une interprétation de la plage choisie, sans retrouver les noms et commentaires d’origine.</p>
      {file.loadAddress!==undefined && <p>En-tête AMSDOS : chargement {file.loadAddress}, entrée {file.entryAddress}, charge utile {file.payloadBytes} octets.</p>}
      <label>Adresse de la première instruction (décimal ou 0x…)<input aria-label="Origine Z80" value={origin} onChange={e=>setOrigin(e.target.value)} /></label>
      <label>Décalage dans la charge utile<input aria-label="Décalage Z80" value={offset} onChange={e=>setOffset(e.target.value)} /></label>
      <label>Nombre d’octets (maximum 16384)<input aria-label="Longueur Z80" value={length} onChange={e=>setLength(e.target.value)} /></label>
      <Button type="button" disabled={busy||!origin.trim()||!files.diskImport?.disassemble} onClick={async()=>{setBusy(true);try{const result=await files.diskImport!.disassemble!({id:previewId,fileId:file.id,origin:Number(origin),offset:Number(offset),length:Number(length)});if('error'in result){setMessage(result.error);setListing('');}else{setListing(result.listing);setMessage('Lecture linéaire : annotez le listing avant de l’enregistrer. Aucun réassemblage automatique.');}}catch(e){setMessage(String(e));}finally{setBusy(false);}}}>Désassembler la plage Z80</Button>
      {listing && <><label>Listing assembleur et annotations<textarea aria-label="Listing Z80" rows={12} value={listing} onChange={e=>setListing(e.target.value)} /></label><Button type="button" disabled={busy} onClick={()=>void extract(listing)}>Enregistrer le listing .asm…</Button></>}
    </>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
