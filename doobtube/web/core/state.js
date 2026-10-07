const retries=new Map();
export function idempotencyKey(scope){
  const id=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
  return 'doobtube-'+String(scope||'write')+'-'+id;
}
export function rememberRetry(scope,key,payload){const value={key,payload};retries.set(scope,value);return value;}
export function retryState(scope){return retries.get(scope)||null;}
export function clearRetry(scope){retries.delete(scope);}
export function resetAuthorityState(){retries.clear();}
