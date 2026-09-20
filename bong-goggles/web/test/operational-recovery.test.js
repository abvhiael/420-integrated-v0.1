import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRecoveryReadiness,REQUIRED_RECOVERY_SCENARIOS} from '../core/operational-recovery.js';
const digest='sha256:'+'a'.repeat(64), url='https://evidence.example.org/qualified';
function fixture(){
 const deployment={environment:'staging',releaseId:'bg-20.3-rc',commit:'a'.repeat(40),artifactDigest:digest,configDigest:digest,policyDigest:digest,manifestUrl:url};
 const controls={releaseId:deployment.releaseId,environment:deployment.environment,privateIngressDisabled:true,unqualifiedFeaturesDisabled:true,rollbackTargetPinned:true,rollbackTargetReleaseId:'prior-qualified',rollbackArtifactDigest:digest,flagsEvidenceUrl:url,rollbackRunbookUrl:url,rollbackArtifactUrl:url,operator:'operator-a'};
 const backup={releaseId:deployment.releaseId,environment:deployment.environment,encrypted:true,restoreVerified:true,accessReviewed:true,snapshotDigest:digest,inventoryEvidenceUrl:url,restoreEvidenceUrl:url,operator:'operator-a'};
 const objectives={maxRtoMs:1000,maxRpoMs:500};
 const drills=REQUIRED_RECOVERY_SCENARIOS.map(scenario=>({scenario,releaseId:deployment.releaseId,environment:deployment.environment,result:'passed',measuredRtoMs:900,measuredRpoMs:400,evidenceUrl:url,operator:'operator-a',approver:'reviewer-b',policyAccessRechecked:true,privateIngressRemainsDisabled:true,unqualifiedFeaturesRemainDisabled:true}));
 return {deployment,controls,backup,objectives,drills};
}
const assess=f=>evaluateRecoveryReadiness(f);
test('no evidence means blocked, never ready',()=>{const r=assess();assert.equal(r.state,'blocked');assert.equal(r.ready,false);assert.equal(r.operatorActionRequired,true);});
test('complete supplied records only hold for independent operator review',()=>{const r=assess(fixture());assert.equal(r.state,'hold_for_operator');assert.equal(r.ready,false);assert.equal(r.operatorActionRequired,true);assert.ok(r.reasons.includes('independent_provenance_and_live_restore_review_required'));});
test('rejects mismatched immutable release and unsafe ingress or flags',()=>{for(const mutate of [f=>{f.deployment.artifactDigest='not-a-digest';},f=>{f.controls.releaseId='another-release';},f=>{f.controls.privateIngressDisabled=false;},f=>{f.controls.unqualifiedFeaturesDisabled=false;},f=>{f.controls.rollbackTargetReleaseId=f.deployment.releaseId;},f=>{f.controls.rollbackTargetPinned=false;}]){const f=fixture();mutate(f);assert.equal(assess(f).state,'blocked');}});
test('rejects unverified backups, missing scenarios and duplicate scenarios',()=>{for(const mutate of [f=>{f.backup.encrypted=false;},f=>{f.backup.restoreVerified=false;},f=>{f.backup.accessReviewed=false;},f=>{f.drills.pop();},f=>{f.drills[1].scenario=f.drills[0].scenario;}]){const f=fixture();mutate(f);assert.equal(assess(f).state,'blocked');}});
test('each scenario must match release, preserve access controls and have distinct operator and reviewer',()=>{for(const mutate of [f=>{f.drills[0].releaseId='other';},f=>{f.drills[0].result='failed';},f=>{f.drills[0].operator=f.drills[0].approver;},f=>{f.drills[0].policyAccessRechecked=false;},f=>{f.drills[0].privateIngressRemainsDisabled=false;},f=>{f.drills[0].unqualifiedFeaturesRemainDisabled=false;},f=>{f.drills[0].evidenceUrl='http://unsafe.test';}]){const f=fixture();mutate(f);assert.equal(assess(f).state,'blocked');}});
test('measured RTO and RPO must meet objectives, cannot be missing or fabricated negatives',()=>{for(const mutate of [f=>{f.drills[0].measuredRtoMs=1001;},f=>{f.drills[0].measuredRpoMs=501;},f=>{f.drills[0].measuredRtoMs=-1;},f=>{f.objectives.maxRtoMs=0;}]){const f=fixture();mutate(f);assert.equal(assess(f).state,'blocked');}});
