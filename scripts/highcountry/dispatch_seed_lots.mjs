// Operator-side queue plan/dispatch; no keys, entropy, self-grants or payment assertions.
import {readFile} from 'node:fs/promises';
import {word} from '../../services/highcountry-economy/src/finalized-rpc.js';
export async function dispatchSeedLots({apiUrl,token,dispatch=false,fetchImpl=fetch,report=entry=>console.log(JSON.stringify(entry))}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl)||typeof token!=='string'||!token||token.length>8192||/\s/.test(token))throw Error('reviewed HTTPS origin and signed issuer session required');
 const post=async(path,body)=>{const response=await fetchImpl(new URL('/seeds/packs/'+path,apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('seed operator request rejected: '+response.status);const r=await response.json();if(r?.ok!==true||!r.result)throw Error('invalid seed operator response');return r.result;};
 let after='',pages=0,failed=0,processed=0;
 do{
  if(++pages>5000)throw Error('seed queue page bound exceeded');
  const page=await post('pending',{after,limit:100});
  if(!Array.isArray(page.intents)||page.intents.length>100||(page.next!==null&&(typeof page.next!=='string'||page.next<=after)))throw Error('invalid seed queue page');
  for(const intent of page.intents){
   if(typeof intent.packId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(intent.packId)||typeof intent.lotId!=='string'||!/^\d{1,20}$/.test(intent.lotId)||BigInt(intent.lotId)<1n||BigInt(intent.lotId)>=2n**64n||intent.quantity!==3||intent.status!=='prepared')throw Error('invalid prepared seed intent');
   processed++;
   if(!dispatch){report({mode:'plan',packId:intent.packId,lotId:intent.lotId,scopeHash:'0x'+word(intent.lotId),quantity:intent.quantity,genomeId:intent.genomeId,wallet:intent.wallet,metadataHash:intent.metadataHash,calldata:intent.calldata});continue;}
   try{report({packId:intent.packId,...await post('dispatch',{packId:intent.packId})});}catch{failed++;report({packId:intent.packId,status:'dispatch-failed; immutable intent retained'});}
  }
  after=page.next;
 }while(after!==null);
 return {processed,failed};
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file://').href){
 try{
  const mode=process.argv[2]??'--plan';if(!['--plan','--dispatch'].includes(mode)||process.argv.length>3)throw Error('usage: dispatch_seed_lots.mjs [--plan|--dispatch]');
  const filename=process.env.HC_SEED_OPERATOR_TOKEN_FILE;if(!filename)throw Error('HC_SEED_OPERATOR_TOKEN_FILE required');
  const token=(await readFile(filename,'utf8')).trim(),result=await dispatchSeedLots({apiUrl:process.env.HC_SEED_RUNTIME_URL,token,dispatch:mode==='--dispatch'});
  if(result.failed)process.exitCode=1;
 }catch(error){console.error(error.message);process.exitCode=1;}
}
