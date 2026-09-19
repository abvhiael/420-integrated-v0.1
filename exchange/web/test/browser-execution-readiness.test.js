import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {browserExecutionReadiness} from '../browser-wallet-ui.js';

const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:'0x420'}};

test('unresolved or non-testnet deployment keeps execution disabled',()=>{
  for(const input of [null,{deployment:{status:'UNRESOLVED',environment:'testnet'}},{deployment:{status:'RESOLVED',environment:'mainnet'}}]){
    assert.deepEqual(browserExecutionReadiness({runtime:input,connected:true,verifiedQuote:true,canonicalReview:true}),{
      ready:false,reason:'Verified testnet deployment unavailable',
    });
  }
});

test('wallet selection and a resolved runtime cannot unlock display-only trading',()=>{
  assert.match(browserExecutionReadiness({runtime}).reason,/Connect a wallet/);
  assert.match(browserExecutionReadiness({runtime,connected:true}).reason,/Live executable quote unavailable/);
  assert.match(browserExecutionReadiness({runtime,connected:true,verifiedQuote:true}).reason,/Canonical transaction review/);
  const allClaimed=browserExecutionReadiness({runtime,connected:true,verifiedQuote:true,canonicalReview:true});
  assert.equal(allClaimed.ready,false);
  assert.match(allClaimed.reason,/operational qualification/);
});

test('deployed wallet UI renders blocked execution readiness and retains capture-phase lock',()=>{
  const root=path.resolve(import.meta.dirname,'..');
  const ui=fs.readFileSync(path.join(root,'browser-wallet-ui.js'),'utf8');
  const build=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
  assert.match(ui,/v15-execution-readiness/);
  assert.match(ui,/readiness\.textContent='Trading disabled/);
  assert.match(ui,/wallet-invalidated/);
  assert.match(ui,/lockExecution\(\)/);
  assert.match(ui,/stopImmediatePropagation\(\)/);
  assert.match(build,/browser-wallet-ui\.js/);
  assert.doesNotMatch(ui,/eth_sendTransaction|eth_signTypedData_v4/);
});
