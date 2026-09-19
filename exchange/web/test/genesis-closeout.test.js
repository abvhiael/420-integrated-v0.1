import test from 'node:test';
import assert from 'node:assert/strict';
import {assessGenesisCloseout,CLOSEOUT_GATES} from '../core/genesis-closeout.js';
import manifest from '../../../deployments/exchange/testnet.runtime.json' with {type:'json'};
import v156 from '../v15.6-qualification.json' with {type:'json'};
import v157 from '../v15.7-qualification.json' with {type:'json'};
import v158 from '../v15.8-qualification.json' with {type:'json'};
import v159 from '../v15.9-qualification.json' with {type:'json'};

test('V15.10 checked-in unresolved manifest and missing live evidence fail all launch gates',()=>{
 const result=assessGenesisCloseout({manifest,qualifications:{v156,v157,v158,v159}});
 assert.equal(result.status,'BLOCKED');
 assert.deepEqual(result.blocked,CLOSEOUT_GATES);
 assert.equal(result.gates.length,CLOSEOUT_GATES.length);
});

test('green mocked unit tests or forged operational flags do not override missing deployment',()=>{
 const result=assessGenesisCloseout({manifest,qualifications:{v159:{...v159,browserIntegrationStatus:'COMPLETE',browserMatrix:v159.browserMatrix.map(x=>({...x,status:'PASS'}))}},evidence:{swapLiveEvidence:{status:'QUALIFIED'}},review:{browserUiIntegrationApproved:true}});
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.blocked.includes('resolvedDeployment'));
 assert.ok(result.blocked.includes('swapLiveEvidence'));
 assert.ok(result.blocked.includes('realBrowserWalletMatrix'));
});

test('every required gate has a unique identifier and nonempty explanation',()=>{
 const result=assessGenesisCloseout();
 assert.equal(new Set(result.gates.map(x=>x.id)).size,CLOSEOUT_GATES.length);
 assert.ok(result.gates.every(x=>x.detail.length>10));
});
