import test from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalGamingFinality420} from '../src/canonical-gaming-finality.js';
import {selector,keccak256} from '../../highcountry-economy/src/keccak.js';
const h=x=>'0x'+x.repeat(64),w=x=>'0x'+x.repeat(40);
const names=['games','identity','entitlements','crossGame','claims','bridge','migration','mission','progression'];
const code='0x6001600055',hash=keccak256(Buffer.from(code.slice(2),'hex'));
const contracts=Object.fromEntries(names.map((name,i)=>[name,{address:w((i+1).toString(16)),codeHash:hash}]));
const claim=h('a'),game=h('b'),profile=h('c'),guest=h('d'),payload=h('e'),target=w('f'),block=h('1');
const word=x=>x.slice(2).padStart(64,'0'),num=x=>BigInt(x).toString(16).padStart(64,'0');
const enc=x=>'0x'+x.map(word).join('');
const claimState=enc([claim,game,'0x'+word(target),guest,payload,'0x'+num(0),'0x'+num(1),'0x'+num(0),'0x'+num(1)]);
const claimByMethod={'claim(bytes32)':claimState};
let liveHash=block,secondary=true,badCode=false,wrongChain=false,result=claimState,called=0,finalized=true;
let addressResponses=null,receipt=null;
const rpc={request:async(method,args)=>{
 called++;
 if(method==='eth_chainId')return wrongChain?'0x1':'0x1a4';
 if(method==='eth_getBlockByNumber')return args?.[0]==='0x9'?{hash:h('2'),number:'0x9'}:{hash:liveHash,number:'0xa'};
 if(method==='eth_getCode')return badCode?'0x6002':code;
 if(method==='eth_getTransactionReceipt')return receipt;
 if(method==='eth_call'){
  const v=addressResponses?.[args[0].to];
  return typeof v==='function'?v(args[0].data):v??result;
 }
 throw Error('rpc unexpected '+method);
},call:async()=>({result})};
const finality=()=>new CanonicalGamingFinality420({rpc,chainId:'420',gameId:game,contracts,
 independentWitness:async()=>secondary});
test('R05.7 real pinned RPC ignores forged adapter finalized=true, checks on-chain consumed claim',async()=>{
 result=claimState;secondary=true;badCode=false;wrongChain=false;liveHash=block;
 const v=await finality().claim({claimId:claim,targetWallet:target,guestStateCommitment:guest,payloadHash:payload,finalized:true});
 assert.equal(v.accepted,true);assert.equal(v.blockHash,block);assert.match(v.evidenceDigest,/^0x[0-9a-f]{64}$/);
 secondary=false;
 await assert.rejects(()=>finality().claim({claimId:claim,targetWallet:target,guestStateCommitment:guest,payloadHash:payload,finalized:true}),/r057-independent-witness-missing/);
 secondary=true;wrongChain=true;
 await assert.rejects(()=>finality().claim({claimId:claim,targetWallet:target,guestStateCommitment:guest,payloadHash:payload}),/r057-chain-mismatch/);
 wrongChain=false;badCode=true;
 await assert.rejects(()=>finality().claim({claimId:claim,targetWallet:target,guestStateCommitment:guest,payloadHash:payload}),/r057-codehash-mismatch/);
 badCode=false;result=enc([claim,game,'0x'+word(target),guest,payload,'0x'+num(0),'0x'+num(0),'0x'+num(0),'0x'+num(1)]);
 await assert.rejects(()=>finality().claim({claimId:claim,targetWallet:target,guestStateCommitment:guest,payloadHash:payload}),/r057-canonical-state-mismatch/);
});
test('R05.7 ownership and entitlement never accept unrelated or revoked state',async()=>{
 result=enc([profile]);
 assert.equal((await finality().ownership({wallet:target,profileId:profile})).kind,'OWNERSHIP');
 result=enc([h('f')]);
 await assert.rejects(()=>finality().ownership({wallet:target,profileId:profile}),/r057-canonical-state-mismatch/);
});
test('R05.7 malformed receipt and zero address fail before any RPC',async()=>{
 const before=called;
 await assert.rejects(()=>finality().receipt({claimId:claim,growerId:'0',guestStateCommitment:guest,payloadHash:payload}),/r057-receipt-invalid/);
 await assert.rejects(()=>finality().claim({claimId:claim,targetWallet:w('0'),guestStateCommitment:guest,payloadHash:payload}),/r057-claim-invalid/);
 assert.equal(before,called);
});

test('R05.7 same-anchor claim, bridge, identity and readiness all required',async()=>{
 result=claimState;secondary=true;badCode=false;wrongChain=false;liveHash=block;
 addressResponses={
  [contracts.claims.address]:claimState,
  [contracts.bridge.address]:enc(['0x'+num(7)]),
  [contracts.migration.address]:enc(['0x'+num(1)]),
  [contracts.identity.address]:enc([profile])
 };
 const actual=await finality().migrationBinding({claimId:claim,targetWallet:target,
  growerId:'7',guestStateCommitment:guest,payloadHash:payload});
 assert.equal(actual.accepted,true);
 assert.equal(actual.claimId,claim);
 addressResponses[contracts.bridge.address]=enc(['0x'+num(9)]);
 await assert.rejects(()=>finality().migrationBinding({claimId:claim,targetWallet:target,
  growerId:'7',guestStateCommitment:guest,payloadHash:payload}),/r057-migration-unbound/);
 addressResponses=null;
});
test('R05.7 finalized transaction must emit precisely the matching MigrationApplied log',async()=>{
 liveHash=block;secondary=true;badCode=false;wrongChain=false;
 const txHash=h('3'),older=h('2'),topic=keccak256(Buffer.from('MigrationApplied(bytes32,uint64,bytes32,bytes32)'));
 const goodLog={address:contracts.migration.address,topics:[topic,claim,'0x'+num(7).slice(2).padStart(64,'0')],
  data:'0x'+guest.slice(2)+payload.slice(2)};
 receipt={transactionHash:txHash,status:'0x1',blockHash:older,blockNumber:'0x9',logs:[goodLog]};
 addressResponses={[contracts.migration.address]:enc(['0x'+num(7),guest,payload,'0x'+num(1),'0x'+num(1)])};
 const confirmed=await finality().migrationTransaction({txHash,claimId:claim,growerId:'7',
  guestStateCommitment:guest,payloadHash:payload});
 assert.equal(confirmed.state,'FINALIZED');assert.equal(confirmed.blockHash,older);
 receipt={...receipt,logs:[{...goodLog,data:'0x'+guest.slice(2)+h('f').slice(2)}]};
 await assert.rejects(()=>finality().migrationTransaction({txHash,claimId:claim,growerId:'7',
  guestStateCommitment:guest,payloadHash:payload}),/r057-migration-receipt-log-invalid/);
 addressResponses=null;receipt=null;
});

test('R05.7 mission payout is only eligible from canonical finalized status, amount and ownership',async()=>{
 liveHash=block;secondary=true;badCode=false;wrongChain=false;
 const missionId=h('3'),profileId=profile;
 const authorized=enc(['0x'+num(3),'0x'+num(0),'0x'+num(0),'0x'+num(0),
  '0x'+num(1),'0x'+num(0),'0x'+num(0),'0x'+num(0),'0x'+num(42)]);
 addressResponses={
  [contracts.identity.address]:enc([profileId]),
  [contracts.mission.address]:authorized
 };
 const v=await finality().missionReward({wallet:target,missionId,amount:'42'});
 assert.equal(v.accepted,true);assert.equal(v.kind,'MISSION_REWARD');
 addressResponses[contracts.mission.address]=enc(['0x'+num(2),...Array(7).fill('0x'+num(0)),'0x'+num(42)]);
 await assert.rejects(()=>finality().missionReward({wallet:target,missionId,amount:'42'}),/r057-mission-unqualified/);
 addressResponses[contracts.mission.address]=authorized;
 addressResponses[contracts.identity.address]=enc(['0x'+num(0)]);
 await assert.rejects(()=>finality().missionReward({wallet:target,missionId,amount:'42'}),/r057-reward-owner-missing/);
 addressResponses=null;
});
test('R05.7 progression payout requires matching track amount and completed canonical progress',async()=>{
 liveHash=block;secondary=true;badCode=false;wrongChain=false;
 const trackId=h('4');
 const progress=enc(['0x'+num(7),'0x'+num(1)]);
 const track=enc(['0x'+num(1),'0x'+num(2),'0x'+num(3),'0x'+num(4),
  '0x'+num(42),'0x'+num(6)]);
 addressResponses={
  [contracts.identity.address]:enc([profile]),
  [contracts.progression.address]:data=>data.startsWith('0x'+selector('progress(address,bytes32)'))?progress:track
 };
 const v=await finality().progressionReward({wallet:target,trackId,amount:'42'});
 assert.equal(v.kind,'PROGRESSION_REWARD');
 addressResponses[contracts.progression.address]=data=>data.startsWith('0x'+selector('progress(address,bytes32)'))?
  enc(['0x'+num(7),'0x'+num(0)]):track;
 await assert.rejects(()=>finality().progressionReward({wallet:target,trackId,amount:'42'}),/r057-progression-unqualified/);
 addressResponses=null;
});
