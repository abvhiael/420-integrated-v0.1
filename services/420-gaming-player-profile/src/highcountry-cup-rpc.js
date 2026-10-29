// HC-NEXT-7.4 — pinned finalized-block EVM Cup reader.
// Selectors and deployed bytecode are independently supplied from audited ABI/artifacts.
// Every field comes from eth_call at one EIP-1898 canonical block hash.
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const hex=(x,n)=>typeof x==='string'&&new RegExp('^0x[0-9a-fA-F]{'+n+'}$').test(x);
const bytes=x=>typeof x==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(x);
const lower=x=>x.toLowerCase();
const uint=x=>'0x'+BigInt(x).toString(16).padStart(64,'0');
const isAddress=x=>hex(x,40)&&BigInt(x)!==0n;
const word=(x,i)=>{if(typeof x!=='string'||!/^0x(?:[0-9a-fA-F]{64})+$/.test(x))fail('cup-rpc-result-invalid');const w=x.slice(2+i*64,2+(i+1)*64);if(w.length!==64)fail('cup-rpc-result-invalid');return '0x'+w;};
const addr=w=>{if(BigInt(w)>>160n)fail('cup-rpc-result-invalid');return '0x'+w.slice(-40);};
const number=w=>{let n=BigInt(w);if(n>BigInt(Number.MAX_SAFE_INTEGER))fail('cup-rpc-result-invalid');return Number(n);};
const bool=w=>{if(BigInt(w)>1n)fail('cup-rpc-result-invalid');return BigInt(w)===1n;};
export function createHighCountryCupRpc420({endpoint,chainId,cupAddress,engineAddress,cupCode,engineCode,selectors,fetchImpl=globalThis.fetch,timeoutMs=10000}={}){
 if(typeof endpoint!=='string'||!/^https:\/\/[^?#]+$/.test(endpoint)||!Number.isSafeInteger(chainId)||chainId<=0||
  !isAddress(cupAddress)||!isAddress(engineAddress)||!bytes(cupCode)||!bytes(engineCode)||
  !selectors||!['cups','finalResultCommitment','resultsCurrent','isIssued','events','winners','winnerScore','entrantAt','resultIsCurrent'].every(x=>hex(selectors[x],8))||
  typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)fail('cup-rpc-config-invalid');
 let requestId=0;
 const call=async(method,params=[])=>{
  const id=++requestId;
  try{
   const res=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',method,params,id}),signal:AbortSignal.timeout(timeoutMs)});
   if(!res?.ok)fail('cup-rpc-unavailable');
   const json=await res.json();
   if(json?.jsonrpc!=='2.0'||json.id!==id||json.error||!Object.hasOwn(json,'result'))fail('cup-rpc-unavailable');
   return json.result;
  }catch(e){if(e?.code)throw e;fail('cup-rpc-unavailable');}
 };
 const read=async(to,selector,params,block)=>{
  const data=lower(selector)+params.map(x=>x.slice(2)).join('');
  const out=await call('eth_call',[{to,data},{blockHash:block,requireCanonical:true}]);
  if(typeof out!=='string'||!/^0x(?:[0-9a-fA-F]{64})+$/.test(out))fail('cup-rpc-result-invalid');
  return out;
 };
 return Object.freeze({
 async readFinalizedCup({cupId,chainId:requestedChain,cupAddress:requestedAddress,codeHash}){
  if(!hex(cupId,64)||requestedChain!==chainId||lower(requestedAddress||'')!==lower(cupAddress)||!hex(codeHash,64))fail('cup-rpc-invalid-input');
  const actualChain=await call('eth_chainId');
  if(typeof actualChain!=='string'||!/^0x[0-9a-fA-F]+$/.test(actualChain)||BigInt(actualChain)!==BigInt(chainId))fail('cup-rpc-chain-mismatch');
  const f=await call('eth_getBlockByNumber',['finalized',false]);
  if(!hex(f?.hash,64)||!/^0x[0-9a-fA-F]+$/.test(f?.number||''))fail('cup-rpc-finality-unavailable');
  const witness=await call('eth_getBlockByHash',[f.hash,false]);
  if(!witness||lower(witness.hash||'')!==lower(f.hash)||witness.number!==f.number)fail('cup-rpc-finality-unavailable');
  const block=lower(f.hash);
  for(const [target,expected] of [[cupAddress,cupCode],[engineAddress,engineCode]]){
   const deployed=await call('eth_getCode',[target,{blockHash:block,requireCanonical:true}]);
   if(typeof deployed!=='string'||lower(deployed)!==lower(expected))fail('cup-rpc-code-mismatch');
  }
  const c=await read(cupAddress,selectors.cups,[cupId],block);
  // Cup public getter: organizer, semiA, semiB, finalEvent, rules, prizeRules, scope, finalized, champion
  const organizer=addr(word(c,0)),semiA=word(c,1),semiB=word(c,2),finalEvent=word(c,3);
  const rulesHash=word(c,4),prizeRulesHash=word(c,5),scope=word(c,6);
  const cupFinalized=bool(word(c,7)),champion=addr(word(c,8));
  if(!isAddress(organizer)||[semiA,semiB,finalEvent,rulesHash,prizeRulesHash,scope].some(x=>BigInt(x)===0n)||new Set([semiA,semiB,finalEvent]).size!==3)fail('cup-rpc-result-invalid');
  const resultCommitment=word(await read(cupAddress,selectors.finalResultCommitment,[cupId],block),0);
  const resultsCurrent=bool(word(await read(cupAddress,selectors.resultsCurrent,[cupId],block),0));
  const rounds=[];let season=null;
  for(const [roundIndex,eventId] of [semiA,semiB,finalEvent].entries()){
   const raw=await read(engineAddress,selectors.events,[eventId],block);
   // CompetitionEngine Event getter: seasonId, templateId, organizer, opensAt, closesAt, challengeUntil, entrants, closed, cancelled.
   if(addr(word(raw,2))!==organizer||!bool(word(raw,7))||bool(word(raw,8)))fail('cup-rpc-event-invalid');
   if(season===null)season=word(raw,0);
   if(BigInt(season)===0n||word(raw,0)!==season)fail('cup-rpc-season-mismatch');
   const count=number(word(raw,6));
   if(count!==2)fail('cup-rpc-event-invalid');
   const entrants=[];
   for(let i=0;i<count;i++)entrants.push(addr(word(await read(engineAddress,selectors.entrantAt,[eventId,uint(i)],block),0)));
   const winner=addr(word(await read(engineAddress,selectors.winners,[eventId],block),0));
   const winnerScore=number(word(await read(engineAddress,selectors.winnerScore,[eventId],block),0));
   const current=await Promise.all(entrants.map(async player=>bool(word(await read(engineAddress,selectors.resultIsCurrent,[eventId,uint(BigInt(player))],block),0))));
   // R04.13 checks semifinal winners and both final entrants; a losing semi entrant
   // may have been validly rejected without invalidating the winning advancement.
   const accepted=roundIndex===2?current.every(Boolean):current[entrants.findIndex(a=>a===winner)]===true;
   rounds.push({eventId,finalized:true,current:accepted,entrants,winner,winnerScore});
  }
  const issued=bool(word(await read(cupAddress,selectors.isIssued,[cupId,uint(BigInt(champion)),scope],block),0));
  const again=await call('eth_getBlockByHash',[block,false]);
  if(!again||lower(again.hash||'')!==block||again.number!==f.number)fail('cup-rpc-finality-unavailable');
  return {chainId,cupAddress,codeHash,blockHash:block,finalizedBlock:true,canonical:true,resultsCurrent,
   resultCommitment,rulesHash,prizeRulesHash,scope,cupFinalized,champion,rounds,
   prestigeIssued:issued,issuanceCurrent:issued};
 }
 });
}
