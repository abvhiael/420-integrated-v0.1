// Approved 420Storage v1 private retrieval transport. Never route confidential
// Arbitration files through public Storage, a redirect, untrusted host or cache.
import {EvidencePrivacyError420,ARBITRATION_EVIDENCE_MAX_BYTES_420} from './arbitration-evidence.js';
const fail=()=>{throw new EvidencePrivacyError420('approved private storage retrieval unavailable');};
const FIELDS=['object_id','manifest_id','shard_index','shard_root','size_bytes','commitment_id'];
const SHA=/^0x[0-9a-fA-F]{64}$/;
const assert=(condition)=>{if(!condition)fail();};
const toHex=bytes=>'0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export function createPrivate420StorageRetrieval420({endpoint,fetchImpl=globalThis.fetch,
  cryptoImpl=globalThis.crypto}={}){
  assert(typeof endpoint==='string'&&typeof fetchImpl==='function'&&cryptoImpl?.subtle);
  let base;
  try{base=new URL(endpoint);}catch{fail();}
  const local=base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname);
  assert(base.username===''&&base.password===''&&!base.search&&!base.hash&&
    (base.protocol==='https:'||local)&&base.pathname!==undefined);
  const retrieve=async({object,grant,mode,signal}={})=>{
    assert(mode==='private'&&object&&typeof object==='object'&&grant&&typeof grant==='object'&&
      !signal?.aborted);
    const subject=grant.storageSubject,sessionId=grant.storageSessionId;
    assert(typeof subject==='string'&&subject.length>0&&subject.length<=256&&
      typeof sessionId==='string'&&sessionId.length>20&&sessionId.length<=2048&&
      !/[\r\n]/.test(subject+sessionId));
    const url=new URL('/v1/resources/retrieve',base);
    for(const field of FIELDS){
      const value=object[field];
      assert(typeof value==='string'||typeof value==='number');
      const str=String(value);
      assert(str.length>0&&str.length<=256&&/^[a-zA-Z0-9:_-]+$/.test(str));
      url.searchParams.set(field,str);
    }
    assert(SHA.test(String(object.shard_root))&&
      Number.isSafeInteger(Number(object.size_bytes))&&Number(object.size_bytes)>0&&
      Number(object.size_bytes)<=ARBITRATION_EVIDENCE_MAX_BYTES_420+1024);
    try{
      const response=await fetchImpl(url.toString(),{
        method:'GET',mode:'cors',redirect:'error',cache:'no-store',credentials:'omit',
        referrerPolicy:'no-referrer',signal,
        headers:{
          'X-420-Access-Mode':'private','X-420-Subject':subject,
          'X-420-Session-ID':sessionId,'X-420-Capability':'read',
          'Cache-Control':'no-store','Pragma':'no-cache'
        }
      });
      assert(response?.ok&&response.status===200&&!signal?.aborted);
      const cacheControl=response.headers?.get?.('cache-control')||'';
      assert(/\bno-store\b/i.test(cacheControl)&&!/\bpublic\b/i.test(cacheControl));
      const expected=Number(object.size_bytes),lengthHeader=response.headers?.get?.('content-length');
      if(lengthHeader!=null)assert(/^\d+$/.test(lengthHeader)&&Number(lengthHeader)===expected);
      // Enforce the bounded object limit WHILE reading, not after an untrusted
      // origin has already forced an arbitrary-size arrayBuffer allocation.
      const reader=response.body?.getReader?.();assert(reader);
      const chunks=[];let length=0;
      try{
        for(;;){
          const chunk=await reader.read();
          if(chunk.done)break;
          assert(chunk.value instanceof Uint8Array&&!signal?.aborted);
          length+=chunk.value.length;
          assert(length<=expected);
          chunks.push(chunk.value);
        }
      }finally{reader.releaseLock();}
      assert(length===expected&&!signal?.aborted);
      const data=new Uint8Array(length);let offset=0;
      for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
      const digest=toHex(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',data)));
      assert(digest.toLowerCase()===String(object.shard_root).toLowerCase());
      return Object.freeze({visibility:'private',object:Object.freeze({...object}),bytes:data});
    }catch{fail();}
  };
  return Object.freeze({retrieve});
}
