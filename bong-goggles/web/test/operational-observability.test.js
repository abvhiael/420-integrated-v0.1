import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateObservability,validateAggregateWindow} from '../core/operational-observability.js';
const window=()=>({environment:'staging',releaseId:'bg20-test',windowStartMs:1000,windowEndMs:2000,requests:100,errors:0,p95LatencyMs:50,indexLagBlocks:1,finalityLagBlocks:1,authorizationDenials:4,moderationPolicyFailures:0,privacyIncidents:0,authBoundaryFailures:0,reorgConsistencyFailures:0});
const policy=()=>({environment:'staging',releaseId:'bg20-test',ownerTeam:'social-ops',retentionHours:24,maxWindowAgeMs:1000,minRequests:20,maxErrorRate:0.05,maxP95LatencyMs:100,maxIndexLagBlocks:3,maxFinalityLagBlocks:3});
const run=(w=window(),p=policy(),nowMs=2100)=>evaluateObservability({window:w,policy:p,nowMs});
test('BG-20.2 healthy aggregate has only static summary and does not page',()=>{
 assert.equal(validateAggregateWindow(window()),true);
 assert.deepEqual(run(),{state:'within_declared_limits',reasons:[],alerts:[],operatorActionRequired:false});
});
test('BG-20.2 rejects identifiers, arbitrary labels and untrusted raw telemetry fields',()=>{
 for(const extra of [{wallet:'0x'+ 'a'.repeat(40)},{ip:'127.0.0.1'},{session:'secret'},{message:'private text'},{route:'/messages/1'},{labels:{user:'x'}},{content:'post'}, {url:'https://example.org'}]){
  const w={...window(),...extra};assert.equal(validateAggregateWindow(w),false);assert.equal(run(w).state,'blocked');
 }
});
test('BG-20.2 rejects impossible, stale and malformed measurements',()=>{
 for(const w of [{...window(),errors:101},{...window(),requests:-1},{...window(),p95LatencyMs:Infinity},{...window(),windowEndMs:1000},{...window(),windowEndMs:3_700_000},{...window(),privacyIncidents:1.5}])assert.equal(run(w).state,'blocked');
 assert.deepEqual(run(window(),policy(),4000).reasons,['missing_or_stale_measurement']);
 assert.deepEqual(run(window(),policy(),1999).reasons,['missing_or_stale_measurement']);
 assert.deepEqual(run(window(),{...policy(),ownerTeam:'private@example.com'}).reasons,['invalid_observability_policy']);
 assert.deepEqual(run(window(),{...policy(),retentionHours:169}).reasons,['invalid_observability_policy']);
 assert.deepEqual(run(window(),{...policy(),unexpected:'x'}).reasons,['invalid_observability_policy']);
});
test('BG-20.2 fault injections classify safety failures as critical',()=>{
 for(const [field,code] of [['privacyIncidents','privacy_incident'],['authBoundaryFailures','authorization_boundary_failure'],['moderationPolicyFailures','moderation_policy_failure'],['reorgConsistencyFailures','reorg_consistency_failure']]){
  const result=run({...window(),[field]:1});assert.equal(result.state,'critical');assert.deepEqual(result.alerts,[{code,severity:'critical',owner:'social-ops'}]);
 }
});
test('BG-20.2 fault injections classify index, finality, latency and error SLO breaches',()=>{
 const result=run({...window(),indexLagBlocks:4,finalityLagBlocks:4,p95LatencyMs:101,errors:6});
 assert.equal(result.state,'warning');assert.deepEqual(result.alerts.map(a=>a.code),['index_lag_exceeded','finality_lag_exceeded','latency_exceeded','error_rate_exceeded']);
});
test('BG-20.2 low traffic blocks release interpretation but retains critical incident alert',()=>{
 const result=run({...window(),requests:1,privacyIncidents:1});assert.equal(result.state,'blocked');assert.deepEqual(result.reasons,['insufficient_sample']);assert.equal(result.alerts[0].severity,'critical');
});
