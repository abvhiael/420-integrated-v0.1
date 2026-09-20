// BG-20.3: Offline, operator-facing evidence gate. Never performs deployments,
// restores databases, enables ingress, or grants launch approval.
const SHA=/^[0-9a-f]{40}$/i;
const DIGEST=/^sha256:[a-f0-9]{64}$/i;
const URL=/^https:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;
const ENV=new Set(['staging','production']);
const SCENARIOS=Object.freeze(['policy_outage','chain_reorg','access_revocation','database_restore','media_unavailable']);
const nonempty=s=>typeof s==='string'&&s.trim().length>0&&s.length<=160;
const evidence=s=>typeof s==='string'&&s.length<=2048&&URL.test(s);
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const result=(state,reasons)=>Object.freeze({state,ready:false,operatorActionRequired:true,reasons:Object.freeze(reasons)});
export const REQUIRED_RECOVERY_SCENARIOS=SCENARIOS;

/** Validate independently attested recovery evidence for one exact deployment.
 * This checks shapes and recorded measurements, NOT signatures, artifact bytes,
 * backup existence, live service state, or provenance of supplied evidence.
 * A passing record remains `hold_for_operator`, never automatic approval.
 */
export function evaluateRecoveryReadiness({deployment,controls,backup,objectives,drills}={}){
 const reasons=[];
 if(!deployment||!ENV.has(deployment.environment)||!nonempty(deployment.releaseId)||
   !SHA.test(deployment.commit??'')||!DIGEST.test(deployment.artifactDigest??'')||
   !DIGEST.test(deployment.configDigest??'')||!DIGEST.test(deployment.policyDigest??'')||
   !evidence(deployment.manifestUrl))reasons.push('deployment_identity_missing');
 if(!controls||controls.releaseId!==deployment?.releaseId||controls.environment!==deployment?.environment||
   controls.privateIngressDisabled!==true||controls.unqualifiedFeaturesDisabled!==true||
   controls.rollbackTargetPinned!==true||controls.rollbackTargetReleaseId===deployment?.releaseId||
   !nonempty(controls.rollbackTargetReleaseId)||!DIGEST.test(controls.rollbackArtifactDigest??'')||
   !evidence(controls.flagsEvidenceUrl)||!evidence(controls.rollbackRunbookUrl)||
   !evidence(controls.rollbackArtifactUrl)||!nonempty(controls.operator))reasons.push('rollback_controls_unqualified');
 if(!objectives||!integer(objectives.maxRtoMs,1)||!integer(objectives.maxRpoMs))reasons.push('recovery_objectives_missing');
 if(!backup||backup.releaseId!==deployment?.releaseId||backup.environment!==deployment?.environment||
   backup.encrypted!==true||backup.restoreVerified!==true||backup.accessReviewed!==true||
   !DIGEST.test(backup.snapshotDigest??'')||!evidence(backup.inventoryEvidenceUrl)||
   !evidence(backup.restoreEvidenceUrl)||!nonempty(backup.operator))reasons.push('backup_unqualified');
 if(!Array.isArray(drills)||drills.length!==SCENARIOS.length||
   new Set(drills.map(d=>d?.scenario)).size!==SCENARIOS.length||
   SCENARIOS.some(s=>!drills.some(d=>d?.scenario===s)))reasons.push('recovery_drill_coverage_missing');
 if(reasons.length)return result('blocked',reasons);
 for(const scenario of SCENARIOS){
   const d=drills.find(item=>item.scenario===scenario);
   if(d.releaseId!==deployment.releaseId||d.environment!==deployment.environment||
     d.result!=='passed'||!integer(d.measuredRtoMs)||!integer(d.measuredRpoMs)||
     !evidence(d.evidenceUrl)||!nonempty(d.operator)||!nonempty(d.approver)||
     d.operator===d.approver||d.policyAccessRechecked!==true||
     d.privateIngressRemainsDisabled!==true||d.unqualifiedFeaturesRemainDisabled!==true){
     reasons.push(`${scenario}_drill_invalid`);continue;
   }
   if(d.measuredRtoMs>objectives.maxRtoMs||d.measuredRpoMs>objectives.maxRpoMs){
     reasons.push(`${scenario}_recovery_objective_breach`);
   }
 }
 if(reasons.length)return result('blocked',reasons);
 return Object.freeze({state:'hold_for_operator',ready:false,operatorActionRequired:true,
   reasons:Object.freeze(['recorded_recovery_evidence_within_declared_objectives','independent_provenance_and_live_restore_review_required'])});
}
