// R06.3 retained R05 cloud-save HTTP adapter. Identity and profile provisioning are issuer-owned.
import {createServer} from 'node:http';
import {createPostgresGamingPlayerProfileService420} from './postgres-repository.js';
import {CloudSaveLifecycle420} from './cloud-save-lifecycle.js';
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const dec=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&x.length<=20;
export function createHighCountryCloudHttp420({authority,poolForPrincipal,provider,schemaVersion=1,origin}={}){
 if(typeof authority?.verifyToken!=='function'||typeof authority?.registeredPrincipal!=='function'||
 !/^0x[0-9a-fA-F]{64}$/.test(authority.gameId||'')||typeof poolForPrincipal!=='function'||
 typeof provider?.put!=='function'||typeof provider?.get!=='function'||typeof provider?.delete!=='function'||
 !Number.isInteger(schemaVersion)||schemaVersion<1||typeof origin!=='string'||!/^https:\/\/[^/]+$/.test(origin))fail('cloud-http-config-invalid');
 return createServer(async(req,res)=>{
  const send=(code,value)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store',
  'x-content-type-options':'nosniff','access-control-allow-origin':origin,'vary':'Origin'});res.end(JSON.stringify(value));};
  try{
   if(req.headers.origin&&req.headers.origin!==origin)fail('origin-denied');
   if(!['GET','POST'].includes(req.method))fail('method-denied');
   const token=/^Bearer ([^\s]{1,4096})$/.exec(req.headers.authorization||'')?.[1];
   if(!token)fail('authentication-required');
   const claims=await authority.verifyToken(token),principal=await authority.registeredPrincipal(token);
   if(!opaque(principal)||claims?.sub!==principal||claims.game!==authority.gameId)fail('authentication-denied');
   const scoped=await createPostgresGamingPlayerProfileService420({authority,token,poolForPrincipal});
   const url=new URL(req.url,'http://localhost');
   if(url.search||url.hash)fail('invalid-request');
   let body=null;
   if(req.method==='POST'){
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))fail('invalid-request');
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1048576)fail('request-too-large');}
    try{body=JSON.parse(raw);}catch{fail('invalid-request');}
    if(!body||typeof body!=='object'||Array.isArray(body))fail('invalid-request');
   }
   const lifecycle=new CloudSaveLifecycle420({repository:scoped,provider,schemaVersion});
   let result;
   if(req.method==='GET'&&url.pathname==='/highcountry/session'){
    const p=await scoped.transaction(tx=>tx.profile());
    result={authenticated:true,registered:!!p,profileId:p?.profile_id??null,revision:String(p?.save_revision??'0')};
   }else if(req.method==='POST'&&url.pathname==='/highcountry/register'){
    if(!opaque(body.profileId)||!/^0x[0-9a-f]{64}$/.test(body.rulesetId)||Object.keys(body).length!==2)fail('invalid-request');
    // Account itself must exist in the approved issuer-backed database; never create a caller-supplied account.
    const p=await scoped.transaction(async tx=>{if(!await tx.account())fail('registration-unavailable');
      return tx.createProfile({profileId:body.profileId,rulesetId:body.rulesetId});});
    result={registered:true,profileId:p.profile_id,revision:String(p.save_revision??'0')};
   }else if(req.method==='GET'&&url.pathname==='/highcountry/save'){
    const saved=await lifecycle.read();
    result=saved?{revision:saved.revision,save:saved.local}: {revision:'0',save:null};
   }else if(req.method==='POST'&&url.pathname==='/highcountry/save'){
    if(!dec(body.expectedRevision)||!opaque(body.consentId)||!opaque(body.schemaLabel)||
      !body.save||typeof body.save!=='object'||Array.isArray(body.save))fail('invalid-request');
    const bytes=new TextEncoder().encode(JSON.stringify(body.save));
    result=await lifecycle.publish({expectedRevision:body.expectedRevision,consentId:body.consentId,schemaLabel:body.schemaLabel,bytes});
   }else if(req.method==='POST'&&url.pathname==='/highcountry/restore'){
    if(!dec(body.backupRevision)||body.backupRevision==='0'||!dec(body.expectedHead)||
      !opaque(body.consentId)||!opaque(body.schemaLabel))fail('invalid-request');
    result=await lifecycle.restore({backupRevision:body.backupRevision,expectedHead:body.expectedHead,
      consentId:body.consentId,schemaLabel:body.schemaLabel});
   }else return send(404,{error:'not-found'});
   // Recheck issuer status before returning scoped data.
   const fresh=await authority.verifyToken(token),current=await authority.registeredPrincipal(token);
   if(fresh?.sub!==principal||fresh.game!==authority.gameId||current!==principal)fail('session-revoked');
   send(200,{gameId:authority.gameId,...result});
  }catch(e){const c=e?.code||e?.message;
   const denied=['authentication-required','authentication-denied','scope-denied','session-revoked','origin-denied','consent-denied','account-revoked'].includes(c);
   send(denied?403:c==='revision-conflict'?409:['invalid-request','request-too-large','save-invalid-schema','save-invalid-bytes','invalid-input'].includes(c)?400:503,
     {error:denied?'authentication-denied':c==='revision-conflict'?'revision-conflict':'service-unavailable'});
  }
 });
}
