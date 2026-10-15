// R06.4 authenticated, canonical read-only optional features.
// The injected verifier MUST be R05.7's independent-finality / codehash checked implementation.
import {createServer} from 'node:http';
import {createPostgresGamingPlayerProfileService420} from './postgres-repository.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const H=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&x!=='0x'+'0'.repeat(64);
const dec=x=>typeof x==='string'&&/^[1-9][0-9]{0,19}$/.test(x)&&BigInt(x)<2n**64n;
const SHAPES=Object.freeze({
 'ownership':['profileId'],
 'entitlement':['profileId','entitlementId','entitlementType','contentId'],
 'cross-game':['profileId','attestationId'],
 'mission-reward':['profileId','missionId','amount'],
 'progression-reward':['profileId','trackId','amount']
});
const walletAddress=x=>x?.wallet??x?.wallet_account??null;
function checkBody(kind,body){
 const fields=SHAPES[kind];
 if(!fields||!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length!==fields.length||
  !fields.every(k=>Object.hasOwn(body,k)&& (k==='amount'?dec(body[k]):H(body[k]))))fail('feature-input-invalid');
}
export function createHighCountryScopedFeatures420({authority,poolForPrincipal,canonical}={}){
 const ops=['ownership','entitlement','attestation','missionReward','progressionReward'];
 if(!authority||typeof authority.verifyToken!=='function'||typeof authority.registeredPrincipal!=='function'||
  !H(authority.gameId)||typeof poolForPrincipal!=='function'||
  !ops.every(k=>typeof canonical?.[k]==='function'))fail('feature-config-invalid');
 return Object.freeze({
  async read(token,kind,input){
   checkBody(kind,input);
   if(typeof token!=='string'||!token||token.length>4096)fail('feature-auth-required');
   let claims,principal;
   try{claims=await authority.verifyToken(token);principal=await authority.registeredPrincipal(token);}catch{fail('feature-auth-denied');}
   if(!principal||principal!==claims?.sub||claims.game!==authority.gameId)fail('feature-scope-denied');
   const repo=await createPostgresGamingPlayerProfileService420({authority,token,poolForPrincipal});
   const state=await repo.transaction(async tx=>({profile:await tx.profile(),link:await tx.activeWallet()}));
   const wallet=walletAddress(state.link);
   if(!state.profile||!state.link||typeof wallet!=='string'||!/^0x[0-9a-f]{40}$/.test(wallet))fail('feature-wallet-not-linked');
   if(!dec(String(state.link.chain_id)))fail('feature-chain-invalid');
   const owner=await canonical.ownership({wallet,profileId:input.profileId});
   if(owner?.accepted!==true||owner.kind!=='OWNERSHIP'||
    String(owner.chainId)!==String(state.link.chain_id)||!H(owner.blockHash))
    fail('feature-ownership-not-canonical');
   let result=owner;
   if(kind==='entitlement')result=await canonical.entitlement({entitlementId:input.entitlementId,
     profileId:input.profileId,entitlementType:input.entitlementType,contentId:input.contentId});
   else if(kind==='cross-game')result=await canonical.attestation({attestationId:input.attestationId,profileId:input.profileId});
   else if(kind==='mission-reward')result=await canonical.missionReward({wallet,missionId:input.missionId,amount:input.amount});
   else if(kind==='progression-reward')result=await canonical.progressionReward({wallet,trackId:input.trackId,amount:input.amount});
   if(result?.accepted!==true||!H(result.blockHash)||result.blockHash!==owner.blockHash||
    String(result.chainId)!==String(state.link.chain_id)||!H(result.evidenceDigest))
    fail('feature-proof-not-canonical');
   // Final issuer status check, including auth epoch/revocation after the independent RPC calls.
   let updated;
   try{updated=await authority.verifyToken(token);}catch{fail('feature-session-revoked');}
   const current=await authority.registeredPrincipal(token);
   if(updated.sub!==principal||updated.game!==authority.gameId||current!==principal)fail('feature-session-revoked');
   return Object.freeze({gameId:authority.gameId,kind,accepted:true,chainId:String(result.chainId),
     blockHash:result.blockHash,evidenceDigest:result.evidenceDigest});
  }
 });
}
export function createHighCountryScopedFeatureHttp420({service,origin}={}){
 if(typeof service?.read!=='function'||typeof origin!=='string'||!/^https:\/\/[^/?#]+$/.test(origin))
  fail('feature-http-config-invalid');
 return createServer(async(req,res)=>{
  const send=(status,body)=>{
   res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',
    'x-content-type-options':'nosniff',...(req.headers.origin===origin?{'access-control-allow-origin':origin,
      'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'Origin'}:{})});
   res.end(JSON.stringify(body));
  };
  if(req.headers.origin!==origin)return send(403,{error:'feature-origin-denied'});
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':origin,
   'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'Origin'});return res.end();}
  if(req.method!=='POST')return send(405,{error:'method-denied'});
  const kind=new URL(req.url,'http://localhost').pathname.replace(/^\/v1\/features\//,'');
  if(!Object.hasOwn(SHAPES,kind)||new URL(req.url,'http://localhost').search)return send(404,{error:'not-found'});
  const token=/^Bearer ([^\s]{1,4096})$/.exec(req.headers.authorization??'')?.[1];
  if(!token)return send(403,{error:'feature-auth-required'});
  try{
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))fail('feature-input-invalid');
   let bytes=0,raw='';
   for await(const chunk of req){bytes+=chunk.byteLength;if(bytes>2048)fail('feature-input-invalid');raw+=chunk;}
   let input;try{input=JSON.parse(raw);}catch{fail('feature-input-invalid');}
   return send(200,{result:await service.read(token,kind,input)});
  }catch(e){
   const code=e?.code||e?.message;
   return send(code==='feature-input-invalid'?400:403,{error:code==='feature-input-invalid'?'feature-input-invalid':'feature-denied'});
  }
 });
}
