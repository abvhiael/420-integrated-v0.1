// Operator-only immutable queue dispatch. No provider key, raw entropy, self-grant or paid-receipt bypass.
import {readFile} from 'node:fs/promises';
import {seedHash} from '../../services/highcountry-economy/src/seed-opening-selection.js';
export async function dispatchSeedOpenings({apiUrl,token,dispatch=false,fetchImpl=fetch,report=x=>console.log(JSON.stringify(x))}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl)||typeof token!=='string'||!token||token.length>8192||/\s/.test(token))throw Error('reviewed origin and signed source issuer required');
 const post=async(path,body)=>{const response=await fetchImpl(new URL('/seeds/packs/'+path,apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('opening request rejected: '+response.status);const r=await response.json();if(r?.ok!==true||!r.result)throw Error('invalid opening response');return r.result;};
 let after='',pages=0,processed=0,failed=0;
 do{
  if(++pages>10000)throw Error('opening page limit');const p=await post('opening-pending',{after,limit:100});
  if(!Array.isArray(p.intents)||p.intents.length>100||(p.next!==null&&(typeof p.next!=='string'||p.next<=after)))throw Error('invalid opening queue');
  for(const i of p.intents){
   if(typeof i.packId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(i.packId)||!/^0x[0-9a-f]{64}$/i.test(i.openingKey))throw Error('invalid committed opening');processed++;
   if(!dispatch){report({mode:'plan',packId:i.packId,scopeHash:i.openingKey,module:seedHash('HC.MODULE.SEED_PACK_OPENING.V1'),action:seedHash('HC.ACTION.SEED_PACK_OPENING.REQUEST.V1'),amount:0,commitment:i.commitment,poolHash:i.poolHash,calldata:i.calldata});continue;}
   try{report({packId:i.packId,...await post('opening-dispatch',{packId:i.packId})});}catch{failed++;report({packId:i.packId,status:'dispatch-failed; original entitlement retained'});}
  }
  after=p.next;
 }while(after!==null);return {processed,failed};
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file://').href){
 try{const mode=process.argv[2]??'--plan';if(!['--plan','--dispatch'].includes(mode)||process.argv.length>3)throw Error('usage: dispatch_seed_openings.mjs [--plan|--dispatch]');const file=process.env.HC_SEED_OPERATOR_TOKEN_FILE;if(!file)throw Error('HC_SEED_OPERATOR_TOKEN_FILE required');const token=(await readFile(file,'utf8')).trim();const result=await dispatchSeedOpenings({apiUrl:process.env.HC_SEED_RUNTIME_URL,token,dispatch:mode==='--dispatch'});if(result.failed)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
}
