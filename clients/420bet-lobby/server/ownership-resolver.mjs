// BET-AUDIT-7: authenticated private ownership lookup for finalized Indexer objects.
// This is an actual backend HTTPS transport, NOT evidence that an external service is deployed.
// All four verticals require an independently operated authority and exact event-scoped proof.
const HEX=/^0x[0-9a-fA-F]{64}$/;
const ACCOUNT=/^0x[0-9a-fA-F]{40}$/;
const UINT=/^(0|[1-9][0-9]*)$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ROLES=Object.freeze({
 'casino-router':'casino','casino-settlement':'casino',
 'poker-ledger':'poker','fantasy-contest':'fantasy',
 'sports-tickets':'sportsbook'
});
function requireValid(ok,message){if(!ok)throw Error('420Bet ownership: '+message);}
function normalized(value,re){requireValid(typeof value==='string'&&re.test(value),'invalid event identity');return value.toLowerCase();}
function originOf(raw){
 const u=new URL(raw);
 requireValid(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&u.hostname,'HTTPS root ownership authority required');
 return u.origin;
}
function scope(event,chainId){
 requireValid(event&&typeof event==='object'&&!Array.isArray(event),'event required');
 requireValid(event.chainId===chainId&&ROLES[event.role],'unapproved chain or vertical');
 requireValid(typeof event.sourceId==='string'&&ID.test(event.sourceId),'unapproved source');
 requireValid(typeof event.kind==='string'&&ID.test(event.kind),'invalid event kind');
 requireValid(typeof event.blockNumber==='string'&&UINT.test(event.blockNumber),'missing finalized block number');
 requireValid(typeof event.logIndex==='string'&&UINT.test(event.logIndex),'missing log index');
 const account=event.account===null||event.account===undefined?null:normalized(event.account,ACCOUNT);
 return Object.freeze({
  chainId,vertical:ROLES[event.role],role:event.role,sourceId:event.sourceId,
  sourceAddress:normalized(event.sourceAddress,ACCOUNT),
  gameVersionId:event.gameVersionId===null||event.gameVersionId===undefined?null:normalized(event.gameVersionId,HEX),
  objectId:normalized(event.objectId,HEX),account,kind:event.kind,
  blockNumber:event.blockNumber,blockHash:normalized(event.blockHash,HEX),
  transactionHash:normalized(event.transactionHash,HEX),logIndex:event.logIndex
 });
}
const same=(a,b)=>a===b;
export function createRemoteBetOwnershipResolver({origin,bearerToken,chainId,fetcher=fetch,timeoutMs=8000,now=Date.now}={}){
 const base=originOf(origin);
 requireValid(typeof bearerToken==='string'&&bearerToken.length>=32&&bearerToken.length<=4096&&/^[A-Za-z0-9._~+/-]+$/.test(bearerToken),'private authority credential required');
 requireValid(typeof chainId==='string'&&/^[1-9][0-9]*$/.test(chainId),'approved chain required');
 requireValid(Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid timeout');
 return async function resolveAudience(event){
  const req=scope(event,chainId);
  const response=await fetcher(base+'/v1/420bet/ownership/resolve',{
   method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
   headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+bearerToken},
   body:JSON.stringify(req),signal:AbortSignal.timeout(timeoutMs)
  });
  requireValid(response?.ok,'private ownership authority unavailable');
  const raw=await response.text();
  requireValid(raw.length<=65536,'oversized private ownership response');
  const result=JSON.parse(raw);
  requireValid(result&&typeof result==='object'&&!Array.isArray(result)&&
   result.authoritative===true&&result.finalized===true&&result.revoked===false,
   'unqualified ownership decision');
  requireValid(result.chainId===req.chainId&&result.role===req.role&&
   result.sourceId===req.sourceId&&result.sourceAddress===req.sourceAddress&&
   result.vertical===req.vertical&&result.objectId===req.objectId&&
   result.gameVersionId===req.gameVersionId&&result.kind===req.kind&&
   result.blockNumber===req.blockNumber&&result.blockHash===req.blockHash&&
   result.transactionHash===req.transactionHash&&result.logIndex===req.logIndex,
   'ownership evidence not bound to finalized event');
  requireValid(Number.isSafeInteger(result.verifiedAt)&&
   result.verifiedAt<=now()+5000&&result.verifiedAt>=now()-30000,
   'stale ownership decision');
  requireValid(Array.isArray(result.owners)&&result.owners.length<=50,'invalid owner count');
  const unique=new Set();
  return Object.freeze(result.owners.map(owner=>{
   requireValid(owner&&owner.ownershipVerified===true&&owner.revoked===false&&
    owner.tenant==='420bet'&&typeof owner.userId==='string'&&ID.test(owner.userId),
    'unverified tenant or identity subject');
   const account=normalized(owner.account,ACCOUNT);
   requireValid(!req.account||req.account===account,'owner disagrees with event account');
   requireValid(same(owner.gameVersionId,req.gameVersionId)||(
    req.gameVersionId===null&&typeof owner.gameVersionId==='string'&&HEX.test(owner.gameVersionId)),
    'owner game version mismatch');
   requireValid(owner.proof&&owner.proof.objectId===req.objectId&&
    owner.proof.sourceAddress===req.sourceAddress&&
    owner.proof.blockHash===req.blockHash&&
    owner.proof.transactionHash===req.transactionHash&&
    owner.proof.logIndex===req.logIndex&&
    owner.proof.ownerAccount===account&&owner.proof.verified===true,
    'no exact independent ownership proof');
   const identity=owner.userId+'|'+account;
   requireValid(!unique.has(identity),'duplicate owner');
   unique.add(identity);
   requireValid(Array.isArray(owner.subscriptions)&&owner.subscriptions.length<=16,'unapproved subscriptions');
   const seen=new Set();
   const subs=owner.subscriptions.map(sub=>{
    requireValid(sub&&ID.test(sub.id)&&['mail','notifications'].includes(sub.channel)&&
     ID.test(sub.recipient)&&ID.test(sub.policyVersion),'invalid private subscription');
    const key=sub.id+'|'+sub.channel;
    requireValid(!seen.has(key),'duplicate subscription');seen.add(key);
    return Object.freeze({id:sub.id,channel:sub.channel,recipient:sub.recipient,policyVersion:sub.policyVersion});
   });
   return Object.freeze({ownershipVerified:true,account,gameVersionId:owner.gameVersionId.toLowerCase(),
    tenant:'420bet',userId:owner.userId,subscriptions:Object.freeze(subs)});
  }));
 };
}
