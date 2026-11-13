// W15.6-M9: Ledger Ethereum app HID transport. Public-key discovery only.
// A device is never a signing authority until an explicit, hardware-confirmed
// signature route has been integrated and qualified.
import {computeAddress} from '../vendor/ethers-6.17.0.min.js';

export const LEDGER_VENDOR_ID_420=0x2c97;
export const HARDWARE_PATH_PREFIX_420="m/44'/60'/0'/0";
const CHANNEL=0x0101, TAG=0x05, REPORT=64;
const MAX_RESPONSE=4096, MAX_INDEX=499;
function fail(message){throw new Error(message);}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
export function ledgerDerivationPath420(index,account=0){
  if(!Number.isInteger(index)||index<0||index>MAX_INDEX||
    !Number.isInteger(account)||account<0||account>MAX_INDEX)fail('Unsupported hardware derivation index');
  const result=[0x8000002c,0x8000003c,0x80000000+account,0,index];
  const bytes=new Uint8Array(1+4*result.length);bytes[0]=result.length;
  result.forEach((value,i)=>new DataView(bytes.buffer).setUint32(1+4*i,value,false));
  return {path:`m/44'/60'/${account}'/0/${index}`,bytes};
}
export function ledgerWrap420(payload,channel=CHANNEL){
  if(!(payload instanceof Uint8Array)||payload.length>MAX_RESPONSE)fail('Invalid Ledger APDU');
  const packets=[];let offset=0,sequence=0;
  do{
    const packet=new Uint8Array(REPORT),view=new DataView(packet.buffer);
    view.setUint16(0,channel,false);packet[2]=TAG;view.setUint16(3,sequence++,false);
    let start=5;
    if(sequence===1){view.setUint16(5,payload.length,false);start=7;}
    const n=Math.min(REPORT-start,payload.length-offset);
    packet.set(payload.subarray(offset,offset+n),start);offset+=n;packets.push(packet);
  }while(offset<payload.length);
  return packets;
}
export function ledgerUnwrap420(packets,channel=CHANNEL){
  if(!Array.isArray(packets)||packets.length===0)fail('Missing Ledger response');
  let expected=null,used=0;
  const chunks=[];
  for(let i=0;i<packets.length;i++){
    const raw=packets[i];
    if(!(raw instanceof Uint8Array)||raw.length!==REPORT)fail('Invalid Ledger HID report');
    const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
    if(view.getUint16(0,false)!==channel||raw[2]!==TAG||view.getUint16(3,false)!==i)
      fail('Ledger response channel or sequence mismatch');
    const start=i===0?7:5;
    if(i===0){expected=view.getUint16(5,false);if(expected<2||expected>MAX_RESPONSE)fail('Ledger response length invalid');}
    const n=Math.min(expected-used,REPORT-start);
    chunks.push(raw.subarray(start,start+n));used+=n;
    if(used===expected){
      if(i!==packets.length-1)fail('Unexpected trailing Ledger packets');
      const result=new Uint8Array(expected);let at=0;
      for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}
      return result;
    }
  }
  fail('Incomplete Ledger response');
}
export function ledgerParseAddress420(response){
  if(!(response instanceof Uint8Array)||response.length<4)fail('Truncated Ledger address');
  const view=new DataView(response.buffer,response.byteOffset,response.byteLength);
  const status=view.getUint16(response.length-2,false);
  if(status!==0x9000)fail('Ledger Ethereum application rejected address request (0x'+status.toString(16)+')');
  const body=response.subarray(0,-2),pubLength=body[0];
  if(pubLength!==65||body.length<1+pubLength+1)fail('Unexpected Ledger public key length');
  const pub=body.subarray(1,66);
  if(pub[0]!==4)fail('Ledger public key must be uncompressed');
  const addrLength=body[66],encoded=body.subarray(67,67+addrLength);
  if(![40,42].includes(addrLength)||encoded.length!==addrLength)fail('Malformed Ledger address');
  const addr=new TextDecoder('ascii',{fatal:true}).decode(encoded);
  const normalized='0x'+addr.replace(/^0x/i,'');
  if(!/^0x[\da-fA-F]{40}$/.test(normalized))fail('Invalid Ledger address');
  const derived=computeAddress('0x'+hex(pub));
  if(derived.toLowerCase()!==normalized.toLowerCase())
    fail('Ledger public key and returned address disagree');
  return derived.toLowerCase();
}
export function ledgerGetAddressApdu420(index,account=0){
  const {bytes,path}=ledgerDerivationPath420(index,account);
  return {path,apdu:Uint8Array.from([0xe0,0x02,0x01,0x00,bytes.length,...bytes])};
}
export async function ledgerOpen420(hid=globalThis.navigator?.hid){
  if(!hid?.requestDevice)fail('WebHID is unavailable. Use a supported Chromium desktop browser.');
  // Only a direct user action may call requestDevice.
  const devices=await hid.requestDevice({filters:[{vendorId:LEDGER_VENDOR_ID_420}]});
  const device=devices?.find(d=>d.vendorId===LEDGER_VENDOR_ID_420);
  if(!device)fail('No Ledger device selected');
  if(!device.opened)await device.open();
  let channel=CHANNEL;
  async function exchange(apdu){
    if(!device.opened)fail('Ledger device disconnected');
    if(!(apdu instanceof Uint8Array)||apdu.length>255)fail('Invalid Ledger APDU request');
    channel=CHANNEL;const frames=ledgerWrap420(apdu,channel);
    let received=[],done=false;
    let rejectWait,resolveWait;
    let timer;
    const result=new Promise((resolve,reject)=>{
      resolveWait=resolve;rejectWait=reject;
      timer=setTimeout(()=>reject(new Error('Ledger response timed out')),25000);
    });
    const onInput=event=>{
      try{
        if(event.device!==device)return;
        const bytes=new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength);
        if(bytes.length!==REPORT)fail('Unexpected Ledger HID packet size');
        received.push(Uint8Array.from(bytes));
        const first=received[0],count=first[5]*256+first[6];
        if(count>MAX_RESPONSE||count<2)fail('Ledger response length invalid');
        const available=57+Math.max(0,received.length-1)*59;
        if(available>=count){done=true;resolveWait(ledgerUnwrap420(received,channel));}
      }catch(e){rejectWait(e);}
    };
    device.addEventListener('inputreport',onInput);
    try{
      for(const frame of frames)await device.sendReport(0,frame);
      return await result;
    }finally{
      clearTimeout(timer);device.removeEventListener('inputreport',onInput);
      received=[];
    }
  }
  return {
    deviceName:device.productName||'Ledger',
    async address(index=0,account=0){
      const {apdu,path}=ledgerGetAddressApdu420(index,account);
      const address=ledgerParseAddress420(await exchange(apdu));
      return {address,path,index,account,provider:'ledger'};
    },
    async signTransaction(path,unsignedSerialized){
      const approved=ledgerDerivationPath420(path.index,path.account);
      const chunks=ledgerTransactionChunks420({index:path.index,account:path.account},unsignedSerialized);
      let response;for(const chunk of chunks)response=await exchange(chunk);
      return ledgerSignature420(response);
    },
    async signTypedDataHash(path,domainHash,messageHash){
      // Hash-only EIP-712 does NOT provide clear-signing field verification.
      // Caller must opt-in to hash signing after showing this distinction.
      return ledgerSignature420(await exchange(ledgerTypedHashApdu420(path,domainHash,messageHash)));
    },
    async close(){if(device.opened)await device.close();}
  };
}

function ledgerStatus420(raw){
  if(!(raw instanceof Uint8Array)||raw.length<2)fail('Ledger returned no status word');
  const status=(raw[raw.length-2]<<8)|raw[raw.length-1];
  if(status!==0x9000)fail('Ledger Ethereum application declined signing (0x'+status.toString(16)+')');
  return raw.subarray(0,-2);
}
export function ledgerSignature420(raw){
  const body=ledgerStatus420(raw);
  if(body.length!==65)fail('Malformed Ledger secp256k1 signature');
  const v=body[0],r='0x'+hex(body.subarray(1,33)),s='0x'+hex(body.subarray(33,65));
  // EIP-155 legacy 'v' and EIP-1559 parity are both accepted only when
  // the recovered signer agrees with the reviewed hardware account.
  return {r,s,yParity:v===27||v===28?v-27:v%2};
}
export function ledgerTransactionChunks420(path,unsignedSerialized){
  const bytes=typeof unsignedSerialized==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(unsignedSerialized)?
    Uint8Array.from(unsignedSerialized.slice(2).match(/../g),x=>parseInt(x,16)):null;
  if(!bytes||bytes.length>65536)fail('Invalid unsigned transaction bytes');
  const p=ledgerDerivationPath420(path.index,path.account).bytes;
  const blocks=[];let offset=0;let first=true;
  while(offset<bytes.length){
    const prefix=first?p:new Uint8Array();
    const n=Math.min(255-prefix.length,bytes.length-offset);
    const chunk=new Uint8Array(prefix.length+n);chunk.set(prefix);chunk.set(bytes.subarray(offset,offset+n),prefix.length);
    blocks.push(Uint8Array.from([0xe0,0x04,first?0x00:0x80,0x00,chunk.length,...chunk]));
    offset+=n;first=false;
  }
  return blocks;
}
export function ledgerTypedHashApdu420(path,domainHash,messageHash){
  if(!/^0x[0-9a-fA-F]{64}$/.test(domainHash)||!/^0x[0-9a-fA-F]{64}$/.test(messageHash))
    fail('Invalid 32-byte EIP-712 hashes');
  const prefix=ledgerDerivationPath420(path.index,path.account).bytes;
  const payload=Uint8Array.from([...prefix,
    ...domainHash.slice(2).match(/../g).map(x=>parseInt(x,16)),
    ...messageHash.slice(2).match(/../g).map(x=>parseInt(x,16))]);
  return Uint8Array.from([0xe0,0x0c,0x00,0x00,payload.length,...payload]);
}
