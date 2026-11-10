// BET-AUDIT-7 private ownership authority. Resolves finalized, exact-chain
// ownership from independently fetched canonical contract state, NEVER from
// an HTTP client's claimed subject, recipient, or ownershipVerified flag.
import {encodeFunctionData,decodeFunctionResult} from 'viem';
import {EVENT_SPECS,decodeKnownEvent} from './indexer-event-abi.mjs';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const UINT=/^(0|[1-9][0-9]*)$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ROLES=Object.freeze({'casino-router':'casino','casino-settlement':'casino',
 'poker-ledger':'poker','poker-canonical':'poker','fantasy-contest':'fantasy',
 'sports-tickets':'sportsbook'});
const KINDS=Object.freeze({ 'wager-accepted':'WAGER_ACCEPTED',
 'wager-settled':'WAGER_SETTLED','wager-voided':'WAGER_VOIDED',
 'poker-hand-settled':'POKER_HAND_SETTLED','poker-hand-cancelled':'POKER_HAND_CANCELLED',
 'fantasy-entry-accepted':'FANTASY_ENTRY_ACCEPTED',
 'fantasy-pool-settled':'FANTASY_POOL_SETTLED','fantasy-pool-cancelled':'FANTASY_POOL_CANCELLED',
 'sports-ticket-funded':'SPORTS_TICKET_FUNDED','sports-ticket-settled':'SPORTS_TICKET_SETTLED',
 'sports-ticket-finalized':'SPORTS_TICKET_FINALIZED'});
const fail=(v,why)=>{if(!v)throw Error('420Bet ownership authority: '+why);};
const addr=v=>{fail(typeof v==='string'&&ADDRESS.test(v)&&!/^0x0{40}$/i.test(v),'invalid account');return v.toLowerCase();};
const hash=v=>{fail(typeof v==='string'&&HASH.test(v),'invalid hash');return v.toLowerCase();};
const uint=v=>{fail(typeof v==='string'&&UINT.test(v),'invalid uint');return BigInt(v);};
const field=(value,name,index)=>value?.[name]??value?.[index];
const word=(name,type)=>({name,type});
const WAGER_FIELDS=[
 word('wagerId','bytes32'),word('player','address'),word('operatorId','bytes32'),
 word('gameId','bytes32'),word('gameVersionId','bytes32'),word('asset','address'),
 word('stake','uint256'),word('maxGrossPayout','uint256'),word('paramsHash','bytes32'),
 word('vaultId','bytes32'),word('randomnessProfileId','bytes32'),
 word('riskProfileId','bytes32'),word('settlementProfileId','bytes32'),
 word('accessPolicyId','bytes32'),word('rulesetId','bytes32'),
 word('acceptedAt','uint64'),word('deadline','uint64'),word('status','uint8')
];
const WAGER_ABI=[{type:'function',name:'getWager',stateMutability:'view',
 inputs:[word('wagerId','bytes32')],outputs:[{type:'tuple',components:WAGER_FIELDS}]}];
const POKER_ABI=[
 {type:'function',name:'lockedMask',stateMutability:'view',inputs:[word('tableId','bytes32')],outputs:[{type:'uint16'}]},
 {type:'function',name:'seatOf',stateMutability:'view',inputs:[word('tableId','bytes32'),word('seat','uint8')],
  outputs:[{type:'tuple',components:[word('player','address'),word('chips','uint256'),word('sittingOut','bool'),word('epoch','uint64')]}]}
];
const FANTASY_ABI=[
 {type:'function',name:'poolOf',stateMutability:'view',inputs:[word('pool','bytes32')],
  outputs:[{type:'tuple',components:[
   word('state','uint8'),word('manifest','bytes32'),word('launcherAccount','address'),
   word('count','uint64'),word('revealed','uint64'),word('lastAcceptedAt','uint64'),
   word('revision','uint64'),word('publishedRevision','uint64'),
   word('gross','uint256'),word('netPrize','uint256'),word('fee','uint256'),word('publishedCandidate','bytes32')]}]},
 {type:'function',name:'entryOf',stateMutability:'view',
  inputs:[word('pool','bytes32'),word('index','uint64')],
  outputs:[{type:'tuple',components:[word('subject','bytes32'),word('userKey','bytes32'),
   word('beneficiary','address'),word('commitment','bytes32'),word('nonce','uint64'),
   word('revealed','bool'),word('claimed','bool'),{name:'lineup',type:'uint32[7]'}]}]}
];
function approvedRequest(req,chainId,sources){
 fail(req&&typeof req==='object'&&!Array.isArray(req),'invalid event request');
 fail(Object.keys(req).every(k=>['chainId','vertical','role','sourceId','sourceAddress',
  'gameVersionId','objectId','account','kind','blockNumber','blockHash',
  'transactionHash','logIndex'].includes(k)),'unexpected event fields');
 const source=sources.find(x=>x.id===req.sourceId&&x.role===req.role&&
  x.address===req.sourceAddress?.toLowerCase());
 fail(source&&req.chainId===chainId&&ROLES[req.role]===req.vertical,
  'unapproved source or chain');
 fail(KINDS[req.kind]&&ID.test(req.kind),'unsupported notification kind');
 fail(typeof req.blockNumber==='string'&&UINT.test(req.blockNumber)&&
  typeof req.logIndex==='string'&&UINT.test(req.logIndex),'invalid event height');
 const objectId=hash(req.objectId),blockHash=hash(req.blockHash),transactionHash=hash(req.transactionHash);
 const account=req.account==null?null:addr(req.account);
 const gameVersionId=req.gameVersionId==null?null:hash(req.gameVersionId);
 return {...req,objectId,blockHash,transactionHash,account,gameVersionId,sourceAddress:source.address};
}
export function createRpcCanonicalOwnershipSource({
 chainId,sources,rpcUrl,betRegistryAddress=null,fetcher=fetch,
 ticketAuthority=null,timeoutMs=10000
}={}){
 fail(typeof chainId==='string'&&/^[1-9][0-9]*$/.test(chainId),'approved chain ID required');
 const url=new URL(rpcUrl);
 fail(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&
  url.pathname==='/'&&url.hostname,'approved HTTPS RPC required');
 fail(Array.isArray(sources)&&sources.length>=1&&sources.length<=32&&
  sources.every(x=>ID.test(x.id)&&ROLES[x.role]&&
   typeof x.address==='string'&&ADDRESS.test(x.address)&&x.address===x.address.toLowerCase()&&
   typeof x.fromBlock==='string'&&UINT.test(x.fromBlock)),'canonical source manifest required');
 if(betRegistryAddress!==null)addr(betRegistryAddress);
 fail(ticketAuthority===null||typeof ticketAuthority==='function','invalid approved ticket reader');
 let number=0;
 async function rpc(method,params){
  const response=await fetcher(url.origin,{method:'POST',cache:'no-store',
   redirect:'error',credentials:'omit',
   headers:{Accept:'application/json','Content-Type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:++number,method,params}),
   signal:AbortSignal.timeout(timeoutMs)});
  fail(response?.ok,'approved RPC unavailable');
  const raw=await response.text();fail(raw.length>0&&raw.length<=1500000,'RPC response oversized');
  const payload=JSON.parse(raw);
  fail(payload&&payload.jsonrpc==='2.0'&&payload.id===number&&
   !payload.error&&payload.result!=null,'unqualified canonical RPC result');
  return payload.result;
 }
 async function call(to,abi,functionName,args,blockNumber){
  const data=encodeFunctionData({abi,functionName,args});
  const result=await rpc('eth_call',[{to,data},'0x'+blockNumber.toString(16)]);
  fail(/^0x[0-9a-fA-F]+$/.test(result),'invalid canonical contract result');
  return decodeFunctionResult({abi,functionName,data:result});
 }
 async function verifiedEvent(req){
  const e=approvedRequest(req,chainId,sources);
  const actualChain=await rpc('eth_chainId',[]);
  fail(BigInt(actualChain)===BigInt(chainId),'RPC wrong chain');
  const finalized=await rpc('eth_getBlockByNumber',['finalized',false]);
  fail(BigInt(finalized.number)>=uint(e.blockNumber),'event not finalized');
  const receipt=await rpc('eth_getTransactionReceipt',[e.transactionHash]);
  fail(receipt.status==='0x1'&&receipt.blockHash?.toLowerCase()===e.blockHash&&
   BigInt(receipt.blockNumber)===uint(e.blockNumber),'event receipt not canonical');
  const block=await rpc('eth_getBlockByNumber',['0x'+uint(e.blockNumber).toString(16),false]);
  fail(block.hash?.toLowerCase()===e.blockHash,'canonical block changed');
  const log=receipt.logs?.find(x=>BigInt(x.logIndex)===uint(e.logIndex));
  fail(log&&log.address?.toLowerCase()===e.sourceAddress&&
   log.blockHash?.toLowerCase()===e.blockHash&&
   log.transactionHash?.toLowerCase()===e.transactionHash,'missing exact contract log');
  const decoded=decodeKnownEvent(e.role,log);
  fail(decoded?.type===KINDS[e.kind]&&decoded.objectId===e.objectId&&
   decoded.account===e.account&&decoded.gameVersionId===e.gameVersionId,
   'canonical log disagrees with requested event');
  return {event:e,log,receipt,block};
 }
 async function canonicalOwners(req){
  const proof=await verifiedEvent(req);
  const {event:e,log}=proof;
  const at=uint(e.blockNumber);
  let members=[],version=e.gameVersionId;
  if(e.vertical==='casino'){
   fail(betRegistryAddress!==null,'approved WagerRegistry contract missing');
   const wager=await call(betRegistryAddress,WAGER_ABI,'getWager',[e.objectId],at);
   fail(field(wager,'wagerId',0)?.toLowerCase()===e.objectId,'wager ID mismatch');
   version=hash(field(wager,'gameVersionId',4));
   fail(version!=='0x'+'0'.repeat(64),'wager has no game version');
   members=[{account:addr(field(wager,'player',1))}];
  }else if(e.vertical==='poker'){
   const table=hash(log.topics[1]),hand=hash(log.topics[2]);
   fail(hand===e.objectId,'wrong poker hand');
   const ledger=sources.find(s=>s.role==='poker-ledger');
   fail(ledger,'approved poker seat ledger missing');
   const reserved=EVENT_SPECS['poker-ledger'].find(x=>x.signature.startsWith('HandReserved('));
   // The authoritative hand membership is the LOCKED seat mask at reservation,
   // not current occupants at settlement.
   const logs=await rpc('eth_getLogs',[{address:ledger.address,
    fromBlock:'0x'+uint(ledger.fromBlock).toString(16),
    toBlock:'0x'+at.toString(16),
    topics:[reserved.topic0,table,hand]}]);
   fail(Array.isArray(logs)&&logs.length===1,'missing unique canonical hand reservation');
   const original=logs[0],reservedHeight=BigInt(original.blockNumber);
   fail(reservedHeight<=at&&hash(original.topics[2])===hand,'invalid hand reservation');
   const canonicalReservation=await rpc('eth_getBlockByNumber',['0x'+reservedHeight.toString(16),false]);
   fail(canonicalReservation.hash?.toLowerCase()===original.blockHash?.toLowerCase(),
    'orphaned hand reservation');
   const mask=await call(ledger.address,POKER_ABI,'lockedMask',[table],reservedHeight);
   fail(mask>0n&&mask<512n,'invalid locked poker seat mask');
   for(let seat=0;seat<9;seat++)if((mask&(1n<<BigInt(seat)))!==0n){
    const record=await call(ledger.address,POKER_ABI,'seatOf',[table,seat],reservedHeight);
    members.push({account:addr(field(record,'player',0))});
   }
   fail(members.length>=2,'no verified poker hand participants');
  }else if(e.vertical==='fantasy'){
   const pool=hash(log.topics[1]);
   fail(pool===e.objectId,'incorrect fantasy pool identity');
   const contract=e.sourceAddress;
   const poolState=await call(contract,FANTASY_ABI,'poolOf',[pool],at);
   const count=field(poolState,'count',3);
   fail(count>0n&&count<=50n,'unqualified fantasy entry count');
   const requestedIndex=e.kind==='fantasy-entry-accepted'?BigInt(log.topics[2]):null;
   if(requestedIndex!==null)fail(requestedIndex>0n&&requestedIndex<=count,'wrong fantasy entry');
   for(let i=1n;i<=count;i++){
    if(requestedIndex!==null&&i!==requestedIndex)continue;
    const entry=await call(contract,FANTASY_ABI,'entryOf',[pool,i],at);
    const subject=hash(field(entry,'subject',0));
    fail(subject!=='0x'+'0'.repeat(64),'empty fantasy identity subject');
    if(requestedIndex!==null)fail(subject===hash(log.topics[3]),'entry subject mismatch');
    members.push({account:addr(field(entry,'beneficiary',2)),subject});
   }
  }else if(e.vertical==='sportsbook'){
   // No sportsbook ticket contract exists in the current repository.
   // Only an independently supplied canonical chain-bound ticket adapter qualifies.
   fail(ticketAuthority!==null,'no deployed canonical sportsbook ticket reader');
   const record=await ticketAuthority({event:e,receipt:proof.receipt,log});
   fail(record&&record.ticketId===e.objectId&&record.sourceAddress===e.sourceAddress&&
    record.blockHash===e.blockHash&&record.gameVersionId&&HASH.test(record.gameVersionId)&&
    record.verified===true&&record.finalized===true,'unverified canonical sportsbook ticket');
   version=hash(record.gameVersionId);
   members=[{account:addr(record.beneficiary)}];
  }
  fail(members.length>0&&members.length<=50,'missing canonical beneficiaries');
  fail(!e.account||members.every(m=>m.account===e.account),
   'indexed account and authoritative beneficiaries disagree');
  const unique=new Set();
  members=members.filter(m=>{if(unique.has(m.account))return false;unique.add(m.account);return true;});
  return Object.freeze({version,members,event:e});
 }
 return Object.freeze({canonicalOwners,verifiedEvent});
}
export function createBetOwnershipAuthority({
 chainId,sources,canonicalSource,verifyRegistry,resolveIdentity,subscriptions,now=Date.now
}={}){
 fail(typeof canonicalSource?.canonicalOwners==='function'&&
  typeof verifyRegistry==='function'&&typeof resolveIdentity==='function'&&
  typeof subscriptions==='function','independent canonical, Registry, Identity and consent sources required');
 fail(Array.isArray(sources)&&sources.length>0,'approved private source map required');
 return Object.freeze({async resolve(request){
  const e=approvedRequest(request,chainId,sources);
  const approved=await verifyRegistry();
  fail(approved?.result?.qualified===true&&approved.config?.chainId===chainId,
   'Registry not qualified');
  for(const x of sources)fail(approved.config.sources?.some(s=>s.id===x.id&&
   s.address===x.address&&s.role===x.role),'source no longer approved by Registry');
  const canonical=await canonicalSource.canonicalOwners(e);
  fail(canonical?.event?.transactionHash===e.transactionHash&&
   canonical.event.blockHash===e.blockHash&&Array.isArray(canonical.members),
   'unverified finalized provenance');
  const version=hash(canonical.version);
  fail(approved.config.games?.some(g=>g.gameVersionId===version&&g.vertical===e.vertical),
   'unapproved game version');
  if(e.gameVersionId!==null)fail(version===e.gameVersionId,'game version contradiction');
  const owners=[];
  for(const member of canonical.members){
   const account=addr(member.account);
   const identity=await resolveIdentity({account,chainId,blockNumber:e.blockNumber,
    subject:member.subject??null});
   fail(identity?.verified===true&&identity.active===true&&
    identity.account?.toLowerCase()===account&&ID.test(identity.userId)&&
    (!member.subject||identity.subject?.toLowerCase()===member.subject),
    'unverified private identity binding');
   const found=await subscriptions({tenant:'420bet',userId:identity.userId});
   fail(Array.isArray(found)&&found.length<=16,'unverified subscription directory');
   const seen=new Set();
   const subs=found.map(s=>{
    fail(s?.tenant==='420bet'&&s.userId===identity.userId&&
     ['mail','notifications'].includes(s.channel)&&
     ID.test(s.id)&&ID.test(s.recipient)&&ID.test(s.policyVersion)&&
     s.active===true&&s.consent===true&&s.muted===false&&s.revoked===false,
     'consent directory supplied unapproved subscription');
    const k=s.id+'|'+s.channel;fail(!seen.has(k),'duplicate subscriptions');seen.add(k);
    return {id:s.id,channel:s.channel,recipient:s.recipient,policyVersion:s.policyVersion};
   });
   owners.push({ownershipVerified:true,revoked:false,tenant:'420bet',
    userId:identity.userId,account,gameVersionId:version,
    subscriptions:subs,proof:{objectId:e.objectId,sourceAddress:e.sourceAddress,
     blockHash:e.blockHash,transactionHash:e.transactionHash,logIndex:e.logIndex,
     ownerAccount:account,verified:true}});
  }
  fail(owners.length<=50&&new Set(owners.map(x=>x.account)).size===owners.length,
   'duplicate canonical beneficiaries');
  return {chainId,vertical:e.vertical,role:e.role,sourceId:e.sourceId,
   sourceAddress:e.sourceAddress,objectId:e.objectId,gameVersionId:e.gameVersionId,
   kind:e.kind,blockNumber:e.blockNumber,blockHash:e.blockHash,
   transactionHash:e.transactionHash,logIndex:e.logIndex,
   authoritative:true,finalized:true,revoked:false,verifiedAt:now(),owners};
 }});
}
