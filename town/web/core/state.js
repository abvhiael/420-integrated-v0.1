export const ViewState=Object.freeze({IDLE:'idle',LOADING:'loading',EMPTY:'empty',READY:'ready',ERROR:'error',TRANSACTION:'transaction'});
export function resultState(items){return Array.isArray(items)&&items.length?ViewState.READY:ViewState.EMPTY;}
export function transactionState({hash=null,error=null,pending=false}={}){if(error)return {state:ViewState.ERROR,error};if(pending)return {state:ViewState.TRANSACTION,hash};if(hash)return {state:ViewState.READY,hash};return {state:ViewState.IDLE};}
export function idempotencyKey(prefix='town'){const c=globalThis.crypto;if(!c?.getRandomValues)throw Error('secure randomness unavailable');const b=new Uint8Array(16);c.getRandomValues(b);return prefix+'-'+[...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
