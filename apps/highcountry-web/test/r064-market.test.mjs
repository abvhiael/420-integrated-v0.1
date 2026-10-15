import test from 'node:test';import assert from 'node:assert/strict';import {createHighCountryMarketConsumer420} from '../src/market.js';
const base='https://api.example',value={operation:'op1',listing:'listing1',transferOperation:'op-transfer'};
test('authenticated market: only reviewed routes, no owner or finalize authority',async()=>{
 let checked=0;const calls=[];
 const c=createHighCountryMarketConsumer420({apiUrl:base,authenticate:async()=>'token',
  assertWalletNetwork:async()=>{checked++;},fetchImpl:async(url,options)=>{
   calls.push({url:String(url),options});return {ok:true,json:async()=>({ok:true,result:{status:'prepared'}})};
  }});
 assert.equal((await c.prepare(value)).status,'prepared');
 assert.equal(checked,1);
 assert.equal(new URL(calls[0].url).pathname,'/market/prepare');
 assert.equal(calls[0].options.headers.authorization,'Bearer token');
 assert.equal(Object.hasOwn(JSON.parse(calls[0].options.body),'buyer'),false);
 assert.equal(Object.keys(c).sort().join(','),'claimReward,list,prepare');
});
test('denies wrong network, invalid operation, forged reward and unavailable service',async()=>{
 let sent=0;
 const offline=createHighCountryMarketConsumer420({apiUrl:base,authenticate:async()=>'token',
  assertWalletNetwork:async()=>{throw Error('wallet-wrong-network');},
  fetchImpl:async()=>{sent++;return {ok:true};}});
 await assert.rejects(offline.prepare(value),/wallet-wrong-network/);assert.equal(sent,0);
 assert.throws(()=>offline.prepare({...value,buyer:'victim'}),/market-input-invalid/);
 const c=createHighCountryMarketConsumer420({apiUrl:base,authenticate:async()=>'token',assertWalletNetwork:async()=>{},
  fetchImpl:async()=>({ok:false,status:503})});
 assert.throws(()=>c.prepare({...value,listing:''}),/market-input-invalid/);
 assert.throws(()=>c.claimReward({source:'source',proof:{payload:'x',signature:'s',owner:'victim'}}),/market-reward-proof-invalid/);
 await assert.rejects(c.prepare(value),/market-service-unavailable/);
});
