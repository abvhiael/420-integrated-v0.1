import test from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalGamingFinality420} from '../src/canonical-gaming-finality.js';
import {keccak256} from '../../highcountry-economy/src/keccak.js';
const h=x=>'0x'+x.repeat(64),w=x=>'0x'+x.repeat(40);
const names=['games','identity','entitlements','crossGame','claims','bridge','migration'];
const code='0x6001600055',hash=keccak256(Buffer.from(code.slice(2),'hex'));
const contracts=Object.fromEntries(names.map((name,i)=>[name,{address:w((i+1).toString(16)),codeHash:hash}]));
const claim=h('a'),game=h('b'),profile=h('c'),guest=h('d'),payload=h('e'),target=w('f'),block=h('1');
const word=x=>x.slice(2).padStart(64,'0'),num=x=>BigInt(x).toString(16).padStart(64,'0');
const enc=x=>'0x'+x.map(word).join('');
const claimState=enc([claim,game,'0x'+word(target),guest,payload,'0x'+num(0),'0x'+num(1),'0x'+num(0),'0x'+num(1)]);
const claimByMethod={'claim(bytes32)':claimState};
let liveHash=block,secondary=true,badCode=false,wrongChain=false,result=claimState,called=0,finalized=true;
const rpc={request:async(method,args)=>{
 called++;
 if(method==='eth_chainId')return wrongChain?'0x1':'0x1a4';
 if(method==='eth_getBlockByNumber')return {hash:liveHash,number:'0xa'};
 if(method==='eth_getCode')return badCode?'0x6002':code;
 if(method==='eth_call')return result;
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
