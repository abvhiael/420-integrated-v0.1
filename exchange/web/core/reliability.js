export const RETRYABLE_API_CODES=Object.freeze(['RATE_LIMITED','SERVICE_UNAVAILABLE','NETWORK_ERROR']);

export function classifyApiFailure(error){
  const status=Number(error?.status??0);
  const code=String(error?.code??'NETWORK_ERROR');
  if(code==='UNSUPPORTED_VERSION'||status===406) return {state:'blocked',retryable:false,message:'Exchange API version mismatch'};
  if(code==='RATE_LIMITED'||status===429) return {state:'degraded',retryable:true,message:'Exchange API rate limited'};
  if(status===503) return {state:'degraded',retryable:true,message:'Exchange API temporarily unavailable'};
  return {state:'degraded',retryable:true,message:'Exchange data unavailable'};
}

export function loadingCopy(kind){
  const map={
    markets:'Loading markets…',
    market:'Loading market history…',
    orders:'Loading orders…',
    bridge:'Loading bridge state…',
    portfolio:'Loading portfolio…',
  };
  return map[kind]??'Loading Exchange data…';
}

export function responsiveTableLabel(header,value){
  return {header:String(header),value:value===null||value===undefined?'—':String(value)};
}

export function focusAfterRender({previousId,documentRef}={}){
  if(!documentRef||!previousId) return false;
  const target=documentRef.getElementById(previousId);
  if(!target||typeof target.focus!=='function') return false;
  target.focus();
  return true;
}

export function onlineState(value){
  return value===false?'offline':'online';
}
