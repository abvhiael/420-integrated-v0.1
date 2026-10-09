import test from 'node:test';import assert from 'node:assert/strict';import {normalizeScienceObservations420,fetchScienceObservations420} from '../core/science.js';
const time=1760000000000;
const x={schemaVersion:'420-science-read-v1',chainId:'420',authoritative:false,rewardEligible:false,items:[{chainId:'420',provider:'BOINC',workKey:'a'.repeat(64),project:'project',creditUnit:'BOINC_CREDIT',creditedEvent:'20',eligibility:'UNVERIFIED',finality:'UNFINALIZED',observedAt:time-500,stale:false,authoritative:false,rewardEligible:false,amount420:null}]};
test('unverified credits cannot become monetary balances',()=>{let rows=normalizeScienceObservations420(x,{chainId:'420',now:time});assert.equal(rows[0].reward,'No $420 entitlement');assert.equal(rows[0].status,'UNVERIFIED')});
test('wrong chain and falsely authoritative projections fail',()=>{assert.throws(()=>normalizeScienceObservations420({...x,chainId:'1'},{chainId:'420'}));assert.throws(()=>normalizeScienceObservations420({...x,items:[{...x.items[0],amount420:'100'}]},{chainId:'420'}))});
test('stale data visible as stale',()=>assert.equal(normalizeScienceObservations420(x,{chainId:'420',now:time+90000000})[0].status,'STALE'));

test('empty, populated and unavailable endpoint are differentiated',async()=>{
 const ready={ok:true,json:async()=>({canonicalAuthority:false,data:x})};
 let requests=[];
 const fetched=await fetchScienceObservations420({indexerUrl:'https://indexer.example',chainId:'420',now:time,fetchImpl:async(url)=>{requests.push(url);return ready;}});
 assert.equal(fetched.length,1);
 assert.match(requests[0],/chainId=420/);
 const empty=await fetchScienceObservations420({indexerUrl:'https://indexer.example',chainId:'420',fetchImpl:async()=>({ok:true,json:async()=>({canonicalAuthority:false,data:{...x,items:[]}})})});
 assert.deepEqual(empty,[]);
 await assert.rejects(()=>fetchScienceObservations420({indexerUrl:'https://indexer.example',chainId:'420',fetchImpl:async()=>({ok:false,status:503})}),/unavailable/);
 await assert.rejects(()=>fetchScienceObservations420({indexerUrl:'https://indexer.example',chainId:'420',fetchImpl:async()=>{throw Error('network');}}),/unavailable/);
 await assert.rejects(()=>fetchScienceObservations420({indexerUrl:'https://indexer.example',chainId:'420',fetchImpl:async()=>({ok:true,json:async()=>({canonicalAuthority:true,data:x})})}),/untrusted/);
});
