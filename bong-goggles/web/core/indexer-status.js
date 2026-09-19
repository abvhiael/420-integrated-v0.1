// The only browser endpoint wired here is the existing 420-indexer /v1/status
// contract (420-indexer/src/http-transport.ts). This is NOT a Bong Goggles
// feed/profile projection, deployment-attestation, or permission authority.
const UNSIGNED=/^(0|[1-9][0-9]*)$/;
function unsignedOrNull(value){return value===null||(typeof value==='string'&&UNSIGNED.test(value));}
export function validateIndexerStatusEnvelope(envelope,chainId){
  if(!envelope||envelope.apiVersion!=='v1'||!envelope.data||typeof envelope.data!=='object')return null;
  const s=envelope.data;
  if(s.chainId!==String(chainId)||!unsignedOrNull(s.indexedHead)||!unsignedOrNull(s.lag)||!unsignedOrNull(s.indexedHeadTimestamp))return null;
  if(s.indexedHeadHash!==null&&(typeof s.indexedHeadHash!=='string'||!/^0x[0-9a-f]{64}$/i.test(s.indexedHeadHash)))return null;
  if(!s.finality||!['head','confirmations','safe'].includes(s.finality.mode)||!unsignedOrNull(s.finality.confirmations)||!unsignedOrNull(s.finality.safeHead))return null;
  if(s.authoritative!==false)return null;
  return Object.freeze({chainId:s.chainId,indexedHead:s.indexedHead,lag:s.lag,finality:s.finality.mode,authoritative:false});
}
export function createIndexerStatusReader({service,chainId}={}){
  if(!service||typeof service.request!=='function'||!Number.isSafeInteger(chainId)||chainId<=0)throw new Error('indexer transport and valid chainId required');
  let active=null,generation=0;
  function invalidate(){generation++;active?.abort();active=null;}
  async function read(){
    invalidate();const current=++generation;const controller=new AbortController();active=controller;
    try{
      const result=await service.request(`/v1/status?chainId=${chainId}`,{method:'GET',signal:controller.signal});
      if(current!==generation||controller.signal.aborted)return Object.freeze({status:'stale',data:null});
      const data=result?.ok?validateIndexerStatusEnvelope(result.data,chainId):null;
      return Object.freeze(data?{status:'ready',data}:{status:'unavailable',data:null});
    }catch{return Object.freeze({status:current!==generation||controller.signal.aborted?'stale':'unavailable',data:null});}
    finally{if(active===controller)active=null;}
  }
  return Object.freeze({read,invalidate});
}
