// BG-20.4: offline control-plane gate. It cannot deploy, alter traffic,
// enable features, send alerts, or certify the authenticity of evidence URLs.
import {evaluateCanary} from './operational-rollout.js';
import {evaluateObservability,validateAggregateWindow} from './operational-observability.js';
import {evaluateRecoveryReadiness} from './operational-recovery.js';

const SHA=/^[a-f0-9]{40}$/i;
const DIGEST=/^sha256:[a-f0-9]{64}$/i;
const HTTPS=/^https:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;
const safeInt=n=>Number.isSafeInteger(n)&&n>=0;
const evidence=s=>typeof s==='string'&&s.length<=2048&&HTTPS.test(s);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const outcome=(state,reasons)=>Object.freeze({state,reasons:Object.freeze(reasons),trafficChangeAllowed:false,launchApproved:false,operatorActionRequired:true});
const RELEASE_FIELDS=['releaseId','environment','commit','artifactDigest','configDigest','policyDigest','manifestUrl'];
const ATTESTATION_FIELDS=['releaseId','environment','commit','artifactDigest','configDigest','policyDigest','windowStartMs','windowEndMs','collectorId','collectorEvidenceUrl','operator','approver'];

/** Evaluate a controlled, already-deployed staging observation, never a launch.
 * Providers must independently verify attestation signatures, trusted collector
 * identity and URL contents BEFORE supplying these records. An approval from
 * BG-19 is a separate release authority record, not the result of CI.
 */
export function evaluateControlledCanary({release,bg19Approval,recovery,rollback,thresholds,observabilityPolicy,observations,nowMs}={}){
 const reasons=[];
 if(!exact(release,RELEASE_FIELDS)||release.environment!=='staging'||
   typeof release.releaseId!=='string'||!/^[-a-zA-Z0-9_.]{1,80}$/.test(release.releaseId)||
   !SHA.test(release.commit??'')||!DIGEST.test(release.artifactDigest??'')||
   !DIGEST.test(release.configDigest??'')||!DIGEST.test(release.policyDigest??'')||!evidence(release.manifestUrl))reasons.push('staging_release_identity_invalid');
 if(!safeInt(nowMs))reasons.push('evaluation_clock_invalid');
 if(!Array.isArray(observations)||observations.length<2||observations.length>24)reasons.push('observation_coverage_invalid');
 if(reasons.length)return outcome('blocked',reasons);
 if(!bg19Approval||bg19Approval.launchApproved!==true||bg19Approval.releaseId!==release.releaseId||
   bg19Approval.environment!=='staging'||bg19Approval.commit!==release.commit||
   bg19Approval.artifactDigest!==release.artifactDigest||!evidence(bg19Approval.approvalUrl)||
   !evidence(bg19Approval.journeyEvidenceUrl))reasons.push('bg19_release_gate_unqualified');
 const recoveryResult=evaluateRecoveryReadiness(recovery);
 if(recoveryResult.state!=='hold_for_operator'||recovery?.deployment?.releaseId!==release.releaseId||
   recovery?.deployment?.environment!=='staging'||recovery?.deployment?.commit!==release.commit||
   recovery?.deployment?.artifactDigest!==release.artifactDigest||
   recovery?.deployment?.configDigest!==release.configDigest||recovery?.deployment?.policyDigest!==release.policyDigest)
   reasons.push('recovery_release_gate_unqualified');
 if(!exact(observabilityPolicy,['environment','releaseId','ownerTeam','retentionHours','maxWindowAgeMs','minRequests','maxErrorRate','maxP95LatencyMs','maxIndexLagBlocks','maxFinalityLagBlocks'])||
   observabilityPolicy.environment!=='staging'||observabilityPolicy.releaseId!==release.releaseId)reasons.push('observability_policy_mismatch');
 if(!thresholds||thresholds.minWindows!==observations.length)reasons.push('window_count_mismatch');
 if(reasons.length)return outcome('blocked',reasons);
 const canaryWindows=[];let previousEnd=-1;let safetyBreach=false;
 for(let i=0;i<observations.length;i++){
   const item=observations[i];const a=item?.attestation,w=item?.window;
   if(!exact(item,['window','attestation'])||!validateAggregateWindow(w)||
     !exact(a,ATTESTATION_FIELDS)||a.releaseId!==release.releaseId||a.environment!=='staging'||
     a.commit!==release.commit||a.artifactDigest!==release.artifactDigest||
     a.configDigest!==release.configDigest||a.policyDigest!==release.policyDigest||
     a.windowStartMs!==w.windowStartMs||a.windowEndMs!==w.windowEndMs||
     w.releaseId!==release.releaseId||w.environment!=='staging'||
     typeof a.collectorId!=='string'||!/^[-a-zA-Z0-9_.]{1,80}$/.test(a.collectorId)||
     !evidence(a.collectorEvidenceUrl)||typeof a.operator!=='string'||!a.operator.trim()||
     typeof a.approver!=='string'||!a.approver.trim()||a.operator===a.approver||
     w.windowStartMs<previousEnd||w.windowEndMs>nowMs){reasons.push(`observation_${i}_invalid`);continue;}
   previousEnd=w.windowEndMs;
   const monitor=evaluateObservability({window:w,policy:observabilityPolicy,nowMs:w.windowEndMs});
   if(monitor.state==='critical'||monitor.state==='warning')safetyBreach=true;
   if(monitor.state==='blocked')reasons.push(`observation_${i}_unqualified`);
   canaryWindows.push({releaseId:release.releaseId,requests:w.requests,errors:w.errors,
     p95LatencyMs:w.p95LatencyMs,indexLagBlocks:w.indexLagBlocks,privacyIncidents:w.privacyIncidents,
     moderationPolicyFailures:w.moderationPolicyFailures,authBoundaryFailures:w.authBoundaryFailures,
     reorgConsistencyFailures:w.reorgConsistencyFailures,evidenceUrl:a.collectorEvidenceUrl});
 }
 if(safetyBreach)return outcome('rollback_required',['observability_safety_or_slo_breach',...reasons]);
 if(reasons.length)return outcome('blocked',reasons);
 const canary=evaluateCanary({deployment:{environment:'staging',releaseId:release.releaseId,commit:release.commit,
   manifestUrl:release.manifestUrl,configUrl:recovery.deployment.manifestUrl},
   bg19Approval,rollback,thresholds,windows:canaryWindows});
 if(canary.state==='rollback_required')return outcome('rollback_required',canary.reasons);
 if(canary.state!=='hold_for_operator')return outcome('blocked',canary.reasons);
 return outcome('hold_for_operator',['staging_measurements_within_declared_limits','independent_evidence_review_and_human_release_decision_required']);
}
