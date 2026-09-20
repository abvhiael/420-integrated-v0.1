import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCanary} from '../core/operational-rollout.js';
const link='https://evidence.example.org/release/bg20';
const releaseId='bg-canary-1';
const baseline=()=>({
 deployment:{environment:'staging',commit:'a'.repeat(40),releaseId,manifestUrl:link,configUrl:link},
 bg19Approval:{launchApproved:true,environment:'staging',releaseId,approvalUrl:link,journeyEvidenceUrl:link},
 thresholds:{minRequests:100,maxErrorRate:0.01,maxP95LatencyMs:500,minWindows:2,maxIndexLagBlocks:8},
 windows:[0,1].map(()=>({releaseId,requests:200,errors:0,p95LatencyMs:150,indexLagBlocks:2,privacyIncidents:0,moderationPolicyFailures:0,authBoundaryFailures:0,reorgConsistencyFailures:0,evidenceUrl:link})),
 rollback:{ready:true,releaseId,runbookUrl:link,drillEvidenceUrl:link,owner:'on-call'}
});
test('BG-20 does not automatically promote a clean, approved measured canary',()=>{
 const outcome=evaluateCanary(baseline());
 assert.equal(outcome.state,'hold_for_operator');
 assert.equal(outcome.eligibleForPromotion,false);
 assert.equal(outcome.operatorActionRequired,true);
});
test('BG-20 blocks missing or mismatched BG-19 evidence and untested rollback',()=>{
 const valid=baseline();
 for(const value of [null,{...valid.bg19Approval,launchApproved:false},
  {...valid.bg19Approval,releaseId:'other'},
  {...valid.bg19Approval,approvalUrl:'file:///tmp/approval'}]){
  assert.equal(evaluateCanary({...valid,bg19Approval:value}).state,'blocked');
 }
 assert.equal(evaluateCanary({...valid,rollback:{...valid.rollback,ready:false}}).state,'blocked');
 assert.equal(evaluateCanary({...valid,deployment:{...valid.deployment,commit:'unversioned'}}).state,'blocked');
});
test('BG-20 blocks absent, mixed-release, insufficient and malformed observations',()=>{
 const valid=baseline();
 for(const windows of [[],[valid.windows[0]],
  [{...valid.windows[0],releaseId:'other'},valid.windows[1]],
  [{...valid.windows[0],requests:0},valid.windows[1]],
  [{...valid.windows[0],errors:201},valid.windows[1]],
  [{...valid.windows[0],evidenceUrl:'http://not-secure.invalid'},valid.windows[1]]]){
  assert.equal(evaluateCanary({...valid,windows}).state,'blocked');
 }
});
test('BG-20 requests rollback on latency, error, lag, privacy, moderation, authorization or reorg breach',()=>{
 const valid=baseline();
 const breaches={errors:10,p95LatencyMs:501,indexLagBlocks:9,privacyIncidents:1,
  moderationPolicyFailures:1,authBoundaryFailures:1,reorgConsistencyFailures:1};
 for(const [field,value] of Object.entries(breaches)){
  const windows=[{...valid.windows[0],[field]:value},valid.windows[1]];
  const out=evaluateCanary({...valid,windows});
  assert.equal(out.state,'rollback_required',field);
  assert.equal(out.eligibleForPromotion,false);
 }
});
test('BG-20 never treats a clean CI result or a production label as launch approval',()=>{
 const valid=baseline();
 assert.equal(evaluateCanary({...valid,bg19Approval:{ciPassed:true}}).state,'blocked');
 assert.equal(evaluateCanary({...valid,deployment:{...valid.deployment,environment:'production'}}).state,'blocked');
});
