import test from 'node:test';
import assert from 'node:assert/strict';
import { activityState, explorerHref, mergeActivity, normalizeBalance, portfolioSummary } from '../core/portfolio.js';

test('balances preserve canonical source and split available/locked',()=>{
  const b=normalizeBalance({assetId:'420',symbol:'420',balance:10,available:7,locked:3,source:'wallet',canonical:true});
  assert.deepEqual({balance:b.balance,available:b.available,locked:b.locked,canonical:b.canonical},{balance:10,available:7,locked:3,canonical:true});
});

test('activity merge de-duplicates record IDs deterministically',()=>{
  const rows=mergeActivity([
    {recordId:'r1',kind:'TRADE',timestamp:1,active:true},
    {recordId:'r1',kind:'TRADE',timestamp:2,active:false,replacedBy:'r2'},
    {recordId:'r2',kind:'TRADE',timestamp:3,active:true},
  ]);
  assert.equal(rows.length,2);
  assert.equal(rows[0].recordId,'r2');
  assert.equal(activityState(rows[1]),'reorg');
});

test('replacement state remains distinct from canonical',()=>{
  assert.equal(activityState({recordId:'r1',kind:'ORDER',timestamp:1,active:true,replacedBy:'r2'}),'replacement');
});

test('explorer links are deterministic and absent without provenance',()=>{
  assert.equal(explorerHref('https://explorer.example','0xabc'),'https://explorer.example/tx/0xabc');
  assert.equal(explorerHref(null,'0xabc'),null);
  assert.equal(explorerHref('https://explorer.example',null),null);
});

test('portfolio summary never invents valuation',()=>{
  assert.deepEqual(
    portfolioSummary([
      {assetId:'420',symbol:'420',balance:10,available:7,locked:3,source:'wallet',canonical:true},
      {assetId:'ETH',symbol:'ETH',balance:2,available:2,locked:0,source:'wallet',canonical:true},
    ]),
    {assetCount:2,canonicalAssetCount:2,totalLocked:3}
  );
});
