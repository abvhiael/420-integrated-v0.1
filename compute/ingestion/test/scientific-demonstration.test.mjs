import test from 'node:test';import assert from 'node:assert/strict';import {checkScientificDemonstration,preliminaryDemonstrationStatus,ScientificDemonstrationError} from '../src/scientific-demonstration.mjs';
const bad=(x,c)=>assert.throws(()=>checkScientificDemonstration(x),e=>e instanceof ScientificDemonstrationError&&e.code===c);
test('no evidence cannot pass',()=>bad(null,'LIVE_RELEASE_NOT_QUALIFIED'));
test('fixtures cannot impersonate live funded release',()=>bad({schemaVersion:'420-cmp-9-13-scientific-demonstration-v1',environment:'OFFLINE_FIXTURE'},'LIVE_RELEASE_NOT_QUALIFIED'));
test('NO-GO explicitly remains until live evidence',()=>{let x=preliminaryDemonstrationStatus();assert.equal(x.qualified,false);assert.equal(x.decision,'NO_GO')});
test('invalid invented chain receipt cannot close milestone',()=>{let x={schemaVersion:'420-cmp-9-13-scientific-demonstration-v1',environment:'LIVE_FUNDED_TESTNET',releaseCommitment:'0x'+'a'.repeat(64),releaseSha:'abcdef1234',deploymentManifest:'manifest123',chainId:'chain-420',operatorSignoff:'operator-123',independentReviewer:'reviewer-456'};bad(x,'SCIENTIFIC_PREREQUISITES')});
