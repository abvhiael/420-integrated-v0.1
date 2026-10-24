import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const hash=x=>'0x'+createHash('sha256').update(JSON.stringify(x)).digest('hex');
const address=x=>{assert(typeof x==='string'&&/^0x[0-9a-f]{40}$/i.test(x)&&!/^0x0{40}$/i.test(x),'invalid public address');return x.toLowerCase();};
const bytes32=x=>{assert(typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x)&&!/^0x0{64}$/i.test(x),'missing public commitment');return x.toLowerCase();};
const uint=x=>{assert(typeof x==='bigint'||typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)||Number.isSafeInteger(x),'unsafe chip integer');const n=BigInt(x);assert(n>=0n&&n<1n<<256n,'invalid chip integer');return n;};
const publicFields=new Set(['source','chainId','engine','ledger','tableId','handId','admissionRoot','terminalTranscript','blockNumber','blockHash','transactionHash','players','startingChips','finalChips','contributed','folded','rake','bigBlind','phase','actionTimings']);

/// Review candidates from public settled observations, NEVER proof of intent or
/// authority to sanction. A trusted chain indexer must authenticate finality,
/// admission and receipts; structural validation here does not verify Groth16.
export function reviewPokerAbuse(records,{minimumSharedHands=8,minimumTransfer=100,minimumTimingActions=12,minimumTimingHands=3}={}){
 assert(Array.isArray(records)&&records.length>0&&records.length<=256,'bounded public observations required');
 assert(Number.isInteger(minimumSharedHands)&&minimumSharedHands>=3&&minimumSharedHands<=256,'insufficient hand sample');
 assert(Number.isInteger(minimumTimingActions)&&minimumTimingActions>=12&&minimumTimingActions<=4096,'insufficient timing sample');
 assert(Number.isInteger(minimumTimingHands)&&minimumTimingHands>=3&&minimumTimingHands<=256,'insufficient timing hand sample');
 const threshold=uint(minimumTransfer);assert(threshold>0n,'positive transfer threshold required');
 const ids=new Set(),pairs=new Map(),timing=new Map(),normalized=[];let context,previousBlock=0n,actionCount=0,finalizedHands=0;
 for(const r of records){
  assert(r&&Object.keys(r).every(k=>publicFields.has(k)),'private material or unsupported observation fields');
  assert(r&&['finalized-chain','native-execution'].includes(r.source),'unrecognized observation source');
  const c=[uint(r.chainId).toString(),address(r.engine),address(r.ledger),bytes32(r.tableId)];
  if(!context)context=c;else assert.deepEqual(c,context,'mixed chain/table/contract observations');
  const id=bytes32(r.handId);assert(!ids.has(id),'duplicate hand observation');ids.add(id);
  const admission=bytes32(r.admissionRoot),terminal=bytes32(r.terminalTranscript);
  const block=uint(r.blockNumber);assert(block>=previousBlock,'out-of-order canonical observations');previousBlock=block;
  if(r.source==='finalized-chain'){bytes32(r.blockHash);bytes32(r.transactionHash);finalizedHands++;}
  assert(Array.isArray(r.players)&&r.players.length>=2&&r.players.length<=9,'invalid participant count');
  const n=r.players.length,players=r.players.map(address);assert(new Set(players).size===n,'duplicate physical player');
  const bigBlind=uint(r.bigBlind);assert(bigBlind>0n,'positive canonical big blind required');
  for(const field of ['startingChips','finalChips','contributed','folded'])assert(Array.isArray(r[field])&&r[field].length===n,'mismatched public accounting');
  const starting=r.startingChips.map(uint),final=r.finalChips.map(uint),contributed=r.contributed.map(uint),fee=uint(r.rake);
  const total=starting.reduce((a,b)=>a+b,0n);assert(total>0n&&total<1n<<256n,'invalid escrow total');
  assert(final.reduce((a,b)=>a+b,0n)+fee===total,'public receipt fails escrow conservation');
  assert(['SHOWDOWN','UNCONTESTED'].includes(r.phase),'unfinished hand is not abuse evidence');
  for(let i=0;i<n;i++){assert(contributed[i]<=starting[i]&&typeof r.folded[i]==='boolean','invalid contribution/fold');assert(final[i]<=total,'phantom payout');}
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   const sorted=[players[i],players[j]].sort(),key=sorted.join(':');
   const p=pairs.get(key)||{players:sorted,hands:0,forward:0n,backward:0n,largeFolds:0,foldedChips:0n};p.hands++;
   const ni=final[i]-starting[i],nj=final[j]-starting[j];
   if(ni>0n&&nj<0n){const flow=ni< -nj?ni:-nj;if(players[i]===sorted[0])p.forward+=flow;else p.backward+=flow;}
   if(nj>0n&&ni<0n){const flow=nj< -ni?nj:-ni;if(players[j]===sorted[0])p.forward+=flow;else p.backward+=flow;}
   if(r.phase==='UNCONTESTED')for(const [a,b] of [[i,j],[j,i]])if(r.folded[a]&&!r.folded[b]&&contributed[a]>=bigBlind*2n){p.largeFolds++;p.foldedChips+=contributed[a];}
   pairs.set(key,p);
  }
  assert(Array.isArray(r.actionTimings)&&r.actionTimings.length<=256,'bounded public action timing required');
  for(const t of r.actionTimings){
   assert(t&&Object.keys(t).every(k=>['seat','openedAt','actedAt','deadline'].includes(k)),'private material or unsupported timing fields');
   assert(Number.isInteger(t.seat)&&t.seat>=0&&t.seat<n,'invalid action seat');
   const opened=uint(t.openedAt),acted=uint(t.actedAt),deadline=uint(t.deadline);
   assert(acted>=opened&&deadline>=acted,'accepted action outside canonical clock');
   const player=players[t.seat],entry=timing.get(player)||{hands:new Set(),latencies:new Map(),actions:0};
   entry.hands.add(id);entry.actions++;const latency=(acted-opened).toString();entry.latencies.set(latency,(entry.latencies.get(latency)||0)+1);timing.set(player,entry);actionCount++;
  }
  assert(actionCount<=4096,'bounded total action evidence required');
  normalized.push({source:r.source,context:c,id,admission,terminal,block:block.toString(),blockHash:r.source==='finalized-chain'?bytes32(r.blockHash):null,transactionHash:r.source==='finalized-chain'?bytes32(r.transactionHash):null,
   players,starting:starting.map(String),final:final.map(String),contributed:contributed.map(String),folded:r.folded,rake:fee.toString(),bigBlind:bigBlind.toString(),phase:r.phase,
   actionTimings:r.actionTimings.map(t=>({seat:t.seat,openedAt:uint(t.openedAt).toString(),actedAt:uint(t.actedAt).toString(),deadline:uint(t.deadline).toString()}))});
 }
 const sourceDigest=hash({domain:'420.BET.POKER.ABUSE.PUBLIC.OBSERVATIONS.V1',policy:{minimumSharedHands,minimumTransfer:threshold.toString(),minimumTimingActions,minimumTimingHands},records:normalized}),signals=[];
 for(const p of pairs.values())if(p.hands>=minimumSharedHands){
  const volume=p.forward+p.backward,largest=p.forward>p.backward?p.forward:p.backward;
  if(volume>=threshold&&largest*10000n>=volume*9000n)signals.push({kind:'CONCENTRATED_CHIP_FLOW',players:p.players,sharedHands:p.hands,observedChips:volume.toString()});
  if(p.largeFolds>=4&&p.foldedChips>=threshold)signals.push({kind:'REPEATED_LARGE_FOLDS',players:p.players,sharedHands:p.hands,observedChips:p.foldedChips.toString()});
 }
 for(const [player,t] of timing)if(t.actions>=minimumTimingActions&&t.hands.size>=minimumTimingHands){
  const maximum=Math.max(...t.latencies.values());
  if(maximum*100>=t.actions*90)signals.push({kind:'REPEATED_TURN_TIMING',players:[player],sharedHands:t.hands.size,actions:t.actions});
 }
 signals.sort((a,b)=>(a.kind+a.players.join()).localeCompare(b.kind+b.players.join()));
 for(const s of signals){s.reviewRequired=true;s.evidenceHash=hash({domain:'420.BET.POKER.ABUSE.REVIEW.CANDIDATE.V1',sourceDigest,signal:s});}
 return {version:1,sourceDigest,coverage:{hands:records.length,actions:actionCount,declaredFinalizedHands:finalizedHands,localExecutionHands:records.length-finalizedHands},signals,
  automatedSanction:false,limitations:['signals are not proof of collusion or automation','public block timing is coarse and may reflect batching','unknown related accounts and off-chain card sharing require independent investigation']};
}
