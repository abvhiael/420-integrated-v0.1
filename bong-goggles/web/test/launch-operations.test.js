import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLaunchOperations,REQUIRED_LAUNCH_CHECKS} from '../core/launch-operations.js';
const digest='sha256:'+'a'.repeat(64),commit='b'.repeat(40),url='https://ops.example.org/evidence';
const DAY_MS=86_400_000;
// Use a clock older than the entire freshness interval; timestamp 1 is genuinely stale.
const nowMs=2*DAY_MS+200_000;
function fixture(){
 const release={releaseId:'bg-release-20-5',environment:'staging',commit,artifactDigest:digest,configDigest:digest,policyDigest:digest,manifestUrl:url};
 return {release,bg19Approval:{launchApproved:true,environment:'staging',releaseId:release.releaseId,commit,approvalUrl:url},
  canary:{environment:'staging',releaseId:release.releaseId,commit,artifactDigest:digest,configDigest:digest,policyDigest:digest,state:'hold_for_operator',evidenceUrl:url,operator:'operator',approver:'reviewer'},
  operations:{environment:'staging',releaseId:release.releaseId,onCallTeam:'sre',primaryOperator:'operator',independentApprover:'reviewer',incidentRunbookUrl:url,rollbackRunbookUrl:url,onCallScheduleUrl:url,retentionPolicyUrl:url,retentionHours:24,reviewedAtMs:nowMs-1000,privateIngressDisabled:true,unqualifiedFeaturesDisabled:true,rollbackReady:true,incidentOwnerAcknowledged:true},
  checks:REQUIRED_LAUNCH_CHECKS.map(name=>({name,releaseId:release.releaseId,environment:'staging',result:'passed',evidenceUrl:url,operator:'operator',approver:'reviewer',reviewedAtMs:nowMs-1000,privateIngressRemainsDisabled:true})),nowMs};
}
test('complete recorded packet remains operator hold, never launch or traffic permission',()=>{const result=evaluateLaunchOperations(fixture());assert.equal(result.state,'hold_for_operator');assert.equal(result.launchApproved,false);assert.equal(result.trafficChangeAllowed,false);assert.equal(result.operatorActionRequired,true);});
test('missing independent BG-19 signoff, rollback or owner blocks',()=>{for(const change of [v=>v.bg19Approval.launchApproved=false,v=>v.operations.rollbackReady=false,v=>v.operations.incidentOwnerAcknowledged=false,v=>v.operations.independentApprover='operator']){const v=fixture();change(v);assert.equal(evaluateLaunchOperations(v).state,'blocked');}});
test('rejects cross-release, cross-environment and altered artifact, config or policy',()=>{for(const key of ['releaseId','environment','commit','artifactDigest','configDigest','policyDigest']){const v=fixture();v.canary[key]='mismatch';assert.equal(evaluateLaunchOperations(v).state,'blocked',key);}});
test('stale records, missing checks and unreviewed browsers block',()=>{let v=fixture();v.operations.reviewedAtMs=1;assert.equal(evaluateLaunchOperations(v).state,'blocked');v=fixture();v.checks.pop();assert.equal(evaluateLaunchOperations(v).state,'blocked');v=fixture();v.checks.find(c=>c.name==='mobile_accessibility').result='failed';assert.equal(evaluateLaunchOperations(v).state,'blocked');});
test('24-hour freshness boundary applies to operations and each individual check',()=>{
 for(const target of ['operations','checks']){
  const atBoundary=fixture();
  if(target==='operations')atBoundary.operations.reviewedAtMs=nowMs-DAY_MS;
  else atBoundary.checks[0].reviewedAtMs=nowMs-DAY_MS;
  assert.equal(evaluateLaunchOperations(atBoundary).state,'hold_for_operator',`${target}: exactly 24 hours old`);
  const stale=fixture();
  if(target==='operations')stale.operations.reviewedAtMs=nowMs-DAY_MS-1;
  else stale.checks[0].reviewedAtMs=nowMs-DAY_MS-1;
  assert.equal(evaluateLaunchOperations(stale).state,'blocked',`${target}: older than 24 hours`);
  const future=fixture();
  if(target==='operations')future.operations.reviewedAtMs=nowMs+1;
  else future.checks[0].reviewedAtMs=nowMs+1;
  assert.equal(evaluateLaunchOperations(future).state,'blocked',`${target}: future timestamp`);
 }
});
test('private ingress, independent check reviewer and correct environment are mandatory',()=>{let v=fixture();v.checks[0].privateIngressRemainsDisabled=false;assert.equal(evaluateLaunchOperations(v).state,'blocked');v=fixture();v.checks[0].approver='operator';assert.equal(evaluateLaunchOperations(v).state,'blocked');v=fixture();v.release.environment='production';assert.equal(evaluateLaunchOperations(v).state,'blocked');});
