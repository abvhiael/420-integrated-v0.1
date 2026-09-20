// BG-20.1: A pure, operator-facing canary assessment. Nothing here deploys,
// increases traffic, grants access, or substitutes for BG-19 release approval.
// Metrics and evidence are supplied by independently reviewed operators.
const URL=/^https:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;
const SHA=/^[0-9a-f]{40}$/i;
const ENV=new Set(['staging','production']);
const finite=(n,min=0)=>typeof n==='number'&&Number.isFinite(n)&&n>=min;
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const evidence=(v)=>typeof v==='string'&&v.length<=2048&&URL.test(v);
const result=(state,reasons)=>Object.freeze({state,eligibleForPromotion:false,operatorActionRequired:true,reasons:Object.freeze(reasons)});

/**
 * Evaluate a named deployment against independently measured windows. Missing
 * or malformed inputs STOP the canary; measurable breaches request rollback.
 * A clean result is only `hold_for_operator`: no automatic promotion or launch.
 * `bg19Approval` is an externally attested release record, not a CI result.
 */
export function evaluateCanary({deployment,bg19Approval,thresholds,windows,rollback}={}){
 const reasons=[];
 if(!deployment||!ENV.has(deployment.environment)||!SHA.test(deployment.commit??'')||
   typeof deployment.releaseId!=='string'||!deployment.releaseId.trim()||
   !evidence(deployment.manifestUrl)||!evidence(deployment.configUrl)) reasons.push('deployment_identity_missing');
 if(!bg19Approval||bg19Approval.launchApproved!==true||bg19Approval.environment!==deployment?.environment||
   bg19Approval.releaseId!==deployment?.releaseId||!evidence(bg19Approval.approvalUrl)||
   !evidence(bg19Approval.journeyEvidenceUrl)) reasons.push('bg19_release_not_approved');
 if(!rollback||rollback.ready!==true||rollback.releaseId!==deployment?.releaseId||
   !evidence(rollback.runbookUrl)||!evidence(rollback.drillEvidenceUrl)||
   typeof rollback.owner!=='string'||!rollback.owner.trim()) reasons.push('rollback_not_ready');
 if(!thresholds||!integer(thresholds.minRequests,1)||!finite(thresholds.maxErrorRate)||
   thresholds.maxErrorRate>1||!finite(thresholds.maxP95LatencyMs,1)||
   !integer(thresholds.minWindows,1)||!integer(thresholds.maxIndexLagBlocks)) reasons.push('thresholds_not_qualified');
 if(!Array.isArray(windows)||!windows.length||!thresholds||
   !integer(thresholds.minWindows,1)||windows.length<thresholds.minWindows) reasons.push('observation_window_missing');
 if(reasons.length)return result('blocked',reasons);
 let breach=false;
 for(const [i,w] of windows.entries()){
   if(!w||w.releaseId!==deployment.releaseId||!integer(w.requests)||
     !integer(w.errors)||w.errors>w.requests||!finite(w.p95LatencyMs)||
     !integer(w.indexLagBlocks)||!integer(w.privacyIncidents)||
     !integer(w.moderationPolicyFailures)||!integer(w.authBoundaryFailures)||
     !integer(w.reorgConsistencyFailures)||!evidence(w.evidenceUrl)){
     reasons.push(`window_${i}_invalid`);continue;
   }
   if(w.requests<thresholds.minRequests){reasons.push(`window_${i}_insufficient_traffic`);continue;}
   if(w.errors/w.requests>thresholds.maxErrorRate||w.p95LatencyMs>thresholds.maxP95LatencyMs||
     w.indexLagBlocks>thresholds.maxIndexLagBlocks||w.privacyIncidents>0||
     w.moderationPolicyFailures>0||w.authBoundaryFailures>0||w.reorgConsistencyFailures>0){
     breach=true;reasons.push(`window_${i}_safety_or_slo_breach`);
   }
 }
 if(breach)return result('rollback_required',reasons);
 if(reasons.length)return result('blocked',reasons);
 return result('hold_for_operator',['measurements_within_declared_limits','human_release_decision_required']);
}
