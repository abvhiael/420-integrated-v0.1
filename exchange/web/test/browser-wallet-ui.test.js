import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {walletChoices,executionSurfaceGate,V15_EXECUTION_CONTROL_IDS,EXECUTION_BLOCK_REASON} from '../browser-wallet-ui.js';
const root=path.resolve(import.meta.dirname,'..');
test('browser wallet selector keeps multiple distinct providers selectable',()=>{
 const one={request(){}},two={request(){}};
 const choices=walletChoices({ethereum:{providers:[one,two]}});
 assert.equal(choices.length,2);assert.notEqual(choices[0].id,choices[1].id);
 assert.equal(walletChoices({ethereum:one}).length,1);
});
test('browser execution surface rejects demo, unresolved and unwired testnet inputs',()=>{
 const runtime={deployment:{status:'RESOLVED',environment:'testnet'}};
 assert.equal(executionSurfaceGate({runtime:null,source:'api',canonicalBindings:true}).reason,'DEPLOYMENT_UNRESOLVED');
 assert.equal(executionSurfaceGate({runtime,source:'demo',canonicalBindings:true}).reason,'DEMO_OR_UNVERIFIED_SOURCE');
 assert.equal(executionSurfaceGate({runtime,source:'api'}).reason,'CANONICAL_EXECUTION_BINDINGS_MISSING');
 assert.equal(executionSurfaceGate({runtime,source:'api',canonicalBindings:true}).ok,true);
 assert.deepEqual(V15_EXECUTION_CONTROL_IDS,['swap-submit','order-sign','bridge-submit']);
 assert.match(EXECUTION_BLOCK_REASON,/canonical transaction controls/);
});
test('production artifact includes guarded browser selector before V14 app',()=>{
 const build=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
 assert.match(build,/browser-wallet-ui\.js/);
 assert.match(build,/html\.replace\(marker/);
 const source=fs.readFileSync(path.join(root,'browser-wallet-ui.js'),'utf8');
 assert.match(source,/addEventListener\('click',intercept,true\)/);
 assert.match(source,/stopImmediatePropagation\(\)/);
 assert.match(source,/observer\.observe\(view,\{childList:true\}\)/);
 assert.doesNotMatch(source,/eth_sendTransaction|eth_signTypedData_v4/);
});
