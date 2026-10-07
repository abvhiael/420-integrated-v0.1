const retries=new Map();
export function idempotencyKey(scope){
  const suffix=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
  return 'media-'+String(scope||'write')+'-'+suffix;
}
export function rememberRetry(scope,key,payload){
  retries.set(scope,{key,payload});
  return {key,payload};
}
export function retryState(scope){return retries.get(scope)||null;}
export function clearRetry(scope){retries.delete(scope);}
export function resetRetries(){retries.clear();}
