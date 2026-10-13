/** Z80 documented instructions. Unknown/undocumented encodings remain DEFB, never guessed. */
export interface Z80Row { offset: number; address: number; bytes: number[]; instruction: string; target?: number }
const hex=(n:number,width=2)=>'$'+n.toString(16).toUpperCase().padStart(width,'0');
const cc=['NZ','Z','NC','C','PO','PE','P','M'];
const alu=['ADD A,','ADC A,','SUB ','SBC A,','AND ','XOR ','OR ','CP '];
export function disassembleZ80(bytes: Uint8Array, origin: number, fileOffset=0): Z80Row[] {
  if (!Number.isInteger(origin)||origin<0||origin>65535||!Number.isInteger(fileOffset)||fileOffset<0||bytes.length>16384||origin+bytes.length>65536) throw new Error('Plage Z80 : 16 Kio maximum, sans dépassement de l’espace 16 bits.');
  const rows: Z80Row[]=[];
  for(let start=0;start<bytes.length;) {
    let p=start, target:number|undefined;
    const read=()=>{if(p>=bytes.length)throw Error('truncated');return bytes[p++]!;};
    const word=()=>read()+256*read();
    const relative=()=>{const d=read();target=(origin+p+(d>127?d-256:d))&65535;return hex(target,4);};
    let instruction:string;
    try {
      let op=read(),index='';
      if(op===0xdd||op===0xfd){index=op===0xdd?'IX':'IY';op=read();if([0xdd,0xfd,0xed].includes(op))throw Error('ignored prefix');}
      const x=op>>6,y=(op>>3)&7,z=op&7,q=y&1,rp=y>>1;
      const pairs=['BC','DE',index||'HL','SP'], pairs2=['BC','DE',index||'HL','AF'];
      let displacement:string|undefined;
      const mem=()=>{if(!index)return '(HL)';if(displacement===undefined){const d=read();displacement=`(${index}${d>127?'-':'+'}${hex(d>127?256-d:d)})`;}return displacement;};
      const reg=(r:number,withMemory=false)=>{
        if(r===6)return mem();
        if(index && (r===4||r===5) && !withMemory)throw Error('undocumented half index');
        return ['B','C','D','E','H','L','(HL)','A'][r]!;
      };
      if(op===0xcb){
        if(index)mem(); const cb=read(),cx=cb>>6,cy=(cb>>3)&7,cz=cb&7;
        if(index&&cz!==6||cx===0&&cy===6)throw Error('undocumented CB');
        const operand=index?displacement!:reg(cz);
        instruction=cx===0?['RLC','RRC','RL','RR','SLA','SRA','SLL','SRL'][cy]+' '+operand:['','BIT','RES','SET'][cx]+' '+cy+','+operand;
      }else if(op===0xed){
        const ed=read(),ex=ed>>6,ey=(ed>>3)&7,ez=ed&7,ep=ey>>1,eq=ey&1;
        if(ex===1){
          if(ez===0&&ey!==6)instruction='IN '+reg(ey)+',(C)';
          else if(ez===1&&ey!==6)instruction='OUT (C),'+reg(ey);
          else if(ez===2)instruction=(eq?'ADC':'SBC')+' HL,'+pairs[ep];
          else if(ez===3){const address=hex(word(),4);instruction=eq?`LD ${pairs[ep]},(${address})`:`LD (${address}),${pairs[ep]}`;}
          else if(ed===0x44)instruction='NEG';
          else if(ed===0x45)instruction='RETN';else if(ed===0x4d)instruction='RETI';
          else if([0x46,0x56,0x5e].includes(ed))instruction='IM '+({70:0,86:1,94:2}[ed]);
          else if(ez===7&&ey<=5)instruction=['LD I,A','LD R,A','LD A,I','LD A,R','RRD','RLD'][ey]!;
          else throw Error('undocumented ED');
        }else if(ex===2&&ey>=4&&ez<=3)instruction=[['LDI','CPI','INI','OUTI'],['LDD','CPD','IND','OUTD'],['LDIR','CPIR','INIR','OTIR'],['LDDR','CPDR','INDR','OTDR']][ey-4]![ez]!;
        else throw Error('undocumented ED');
      }else if(x===0){
        if(z===0){if(index)throw Error('ignored prefix');instruction=y===0?'NOP':y===1?"EX AF,AF'":y===2?'DJNZ '+relative():y===3?'JR '+relative():'JR '+cc[y-4]+','+relative();}
        else if(z===1)instruction=q?`ADD ${index||'HL'},${pairs[rp]}`:`LD ${pairs[rp]},${hex(word(),4)}`;
        else if(z===2){if(index&&rp!==2)throw Error('ignored prefix'); const address=rp===0?'BC':rp===1?'DE':hex(word(),4),register=rp===2?(index||'HL'):'A';instruction=q?`LD ${register},(${address})`:`LD (${address}),${register}`;}
        else if(z===3){if(index&&rp!==2)throw Error('ignored prefix');instruction=(q?'DEC ':'INC ')+pairs[rp];}
        else if(z===4||z===5)instruction=(z===4?'INC ':'DEC ')+reg(y);
        else if(z===6){const register=reg(y);instruction='LD '+register+','+hex(read());}
        else {if(index)throw Error('ignored prefix');instruction=['RLCA','RRCA','RLA','RRA','DAA','CPL','SCF','CCF'][y]!;}
      }else if(x===1){
        if(op===0x76){if(index)throw Error('ignored prefix');instruction='HALT';}
        else {if(index&&y!==6&&z!==6)throw Error('ignored/half-index'); const a=reg(y,y===6||z===6),b=reg(z,y===6||z===6);instruction='LD '+a+','+b;}
      }else if(x===2){if(index&&z!==6)throw Error('ignored/half-index');instruction=alu[y]+reg(z);}
      else {
        if(z===0){if(index)throw Error('ignored prefix');instruction='RET '+cc[y];}
        else if(z===1){if(!q){if(index&&rp!==2)throw Error('ignored prefix');instruction='POP '+pairs2[rp];}else {if(index&&rp<2)throw Error('ignored prefix');instruction=['RET','EXX',`JP (${index||'HL'})`,`LD SP,${index||'HL'}`][rp]!;}}
        else if(z===2){if(index)throw Error('ignored prefix');target=word();instruction='JP '+cc[y]+','+hex(target,4);}
        else if(z===3){if(index&&y!==4)throw Error('ignored prefix');if(y===0){target=word();instruction='JP '+hex(target,4);}else if(y===2)instruction='OUT ('+hex(read())+'),A';else if(y===3)instruction='IN A,('+hex(read())+')';else if(y===4)instruction=`EX (SP),${index||'HL'}`;else if(y===5)instruction='EX DE,HL';else if(y===6)instruction='DI';else if(y===7)instruction='EI';else throw Error('prefix');}
        else if(z===4){if(index)throw Error('ignored prefix');target=word();instruction='CALL '+cc[y]+','+hex(target,4);}
        else if(z===5){if(!q){if(index&&rp!==2)throw Error('ignored prefix');instruction='PUSH '+pairs2[rp];}else if(rp===0&&!index){target=word();instruction='CALL '+hex(target,4);}else throw Error('prefix');}
        else if(z===6){if(index)throw Error('ignored prefix');instruction=alu[y]+hex(read());}
        else {if(index)throw Error('ignored prefix');target=y*8;instruction='RST '+hex(target);}
      }
      if(index && x===0 && [1,4,5,6].includes(z) && (z===1?rp!==2&&!q:y!==6))throw Error('ignored prefix');
    }catch{p=start+1;target=undefined;instruction='DEFB '+hex(bytes[start]!)+' ; octet non décodé';}
    const row:Z80Row={offset:fileOffset+start,address:origin+start,bytes:[...bytes.subarray(start,p)],instruction};
    if(target!==undefined)row.target=target;
    rows.push(row);start=p;
  }
  return rows;
}
export function z80Listing(bytes:Uint8Array,origin:number,fileOffset=0):string {
  return '; Assembleur reconstruit par lecture lineaire Z80. Code et donnees peuvent etre melanges.\n; Noms/commentaires historiques non recuperes. Export documentaire, dialecte non qualifie pour reassemblage.\nORG '+hex(origin,4)+'\n'+disassembleZ80(bytes,origin,fileOffset).map(row=>`${row.instruction.padEnd(28)} ; ${hex(row.address,4)} | ${row.bytes.map(b=>hex(b).slice(1)).join(' ')} | offset ${row.offset}`).join('\n')+'\n';
}
