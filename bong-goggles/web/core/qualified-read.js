import {assertQualifiedBinding} from './journey-gates.js';

const PRIVATE_READS=new Set(['profileRead','relationshipRead','feedRead','communityRead','conversationRead','gameListRead','gameDetailRead','notificationRead','rewardRead','moderationRead']);
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const PATH=/^\/[a-zA-Z0-9/_-]{1,180}$/;

/** The audited deployment supplies a path, a qualified binding and a response validator.
 * No endpoint path, credentials, permission or canonical state is inferred by this client.
 */
export function createQualifiedProjectionReader({service,bindingName,binding,path,validate,privateRead=PRIVATE_READS.has(bindingName),getSession=()=>null}={}){
  assertQualifiedBinding(bindingName,binding);
  if(!service||typeof service.request!=='function')throw new Error('qualified service transport required');
  if(typeof path!=='string'||!PATH.test(path)||path.includes('//')||path.includes('..'))throw new Error('explicit safe projection path required');
  if(typeof validate!=='function')throw new Error('projection response validator required');
  let generation=0;
  let active=null;
  function invalidate(){generation++;active?.abort();active=null;}
  async function read(){
    invalidate();
    const current=++generation;
    const session=getSession();
    if(privateRead&&(!session?.connected||session.supportedNetwork!==true||!ADDRESS.test(session.account??'')))return Object.freeze({status:'locked',data:null});
    const account=privateRead?session.account.toLowerCase():null;
    const chain=privateRead?String(session.chainId??''):null;
    const controller=new AbortController();active=controller;
    try{
      const result=await service.request(path,{method:'GET',signal:controller.signal});
      const now=getSession();
      if(current!==generation||controller.signal.aborted||privateRead&&(!now?.connected||now.supportedNetwork!==true||String(now.account??'').toLowerCase()!==account||String(now.chainId??'')!==chain))return Object.freeze({status:'stale',data:null});
      if(!result?.ok)return Object.freeze({status:'unavailable',data:null});
      const projection=validate(result.data,{viewer:account,chainId:chain});
      if(projection==null||typeof projection!=='object')return Object.freeze({status:'unavailable',data:null});
      return Object.freeze({status:'ready',data:projection,authoritative:false});
    }catch{return Object.freeze({status:current!==generation||controller.signal.aborted?'stale':'unavailable',data:null});}
    finally{if(active===controller)active=null;}
  }
  return Object.freeze({read,invalidate});
}
