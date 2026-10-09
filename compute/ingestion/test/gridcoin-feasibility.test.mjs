import test from 'node:test';import assert from 'node:assert/strict';import {evaluateG01,REQUIRED_G01} from '../src/gridcoin-feasibility.mjs';
const draft=()=>({schemaVersion:'420-gridcoin-g01-v1',checks:REQUIRED_G01.map(name=>({name,status:'UNVERIFIED',primaryReferences:[],liveNodeVerified:false}))});
test('default-deny incomplete research',()=>{const r=evaluateG01(draft());assert.equal(r.decision,'NO_GO');assert.equal(r.unresolved.length,15)});
test('missing verification cannot be replaced with governance approval',()=>{let x=draft();x.governanceApproved=true;x.independentReviewApproved=true;x.verifiedTwoWaySettlement=true;assert.equal(evaluateG01(x).decision,'NO_GO')});
test('cannot silently omit feasibility category',()=>{let x=draft();x.checks.pop();assert.throws(()=>evaluateG01(x),/incomplete/)});
test('declared verified without primary source and independent live node is still NO-GO',()=>{let x=draft();x.checks[0]={name:x.checks[0].name,status:'VERIFIED',primaryReferences:[],liveNodeVerified:false};assert.equal(evaluateG01(x).decision,'NO_GO')});
