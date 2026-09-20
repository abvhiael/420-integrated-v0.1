// BG-20.5: offline release-operations evidence review, NOT launch approval.
// No network, Cloudflare, wallet, routing, paging or feature-flag side effects.
const SHA=/^[a-f0-9]{40}$/i;
const DIGEST=/^sha256:[a-f0-9]{64}$/i;
const HTTPS=/^https:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;
const ENV=new Set(['staging','production']);
const TESTS=Object.freeze(['desktop_accessibility','mobile_accessibility','privacy_and_abuse','incident_escalation','on_call_page_delivery','backup_retention','dependency_security','service_degradation','rollback_rehearsal']);
const safeString=v=>typeof v==='string'&&v.trim().length>0&&v.length<=160;
const url=v=>typeof v==='string'&&v.length<=2048&&HTTPS.test(v);
const integer=(v,min=0)=>Number.isSafeInteger(v)&&v>=min;
const response=(state,reasons)=>Object.freeze({state,launchApproved:false,trafficChangeAllowed:false,operatorActionRequired:true,reasons:Object.freeze(reasons)});
export const REQUIRED_LAUNCH_CHECKS=TESTS;

/** Validate the *shape* of an independently reviewed operational evidence packet.
 * The caller must independently authenticate authors, evidence, deployment state
 * and signatures. This gate is intentionally incapable of approving a release.
 */
export function evaluateLaunchOperations({release,bg19Approval,canary,operations,checks,nowMs}={}){
 const reasons=[];
 if(!release||!ENV.has(release.environment)||!safeString(release.releaseId)||!SHA.test(release.commit??'')||
   !DIGEST.test(release.artifactDigest??'')||!DIGEST.test(release.configDigest??'')||
   !DIGEST.test(release.policyDigest??'')||!url(release.manifestUrl))reasons.push('release_identity_missing');
 if(!bg19Approval||bg19Approval.launchApproved!==true||bg19Approval.environment!==release?.environment||
   bg19Approval.releaseId!==release?.releaseId||bg19Approval.commit!==release?.commit||
   !url(bg19Approval.approvalUrl))reasons.push('bg19_approval_unqualified');
 // A staging result does not authorize a production release. This packet is
 // environment-specific, and canary evidence must name the exact same release.
 if(!canary||canary.environment!==release?.environment||canary.releaseId!==release?.releaseId||
   canary.commit!==release?.commit||canary.artifactDigest!==release?.artifactDigest||
   canary.configDigest!==release?.configDigest||canary.policyDigest!==release?.policyDigest||
   canary.state!=='hold_for_operator'||!url(canary.evidenceUrl)||
   !safeString(canary.operator)||!safeString(canary.approver)||canary.operator===canary.approver)
   reasons.push('canary_evidence_unqualified');
 if(!operations||operations.releaseId!==release?.releaseId||operations.environment!==release?.environment||
   !safeString(operations.onCallTeam)||!safeString(operations.primaryOperator)||
   !safeString(operations.independentApprover)||operations.primaryOperator===operations.independentApprover||
   !url(operations.incidentRunbookUrl)||!url(operations.rollbackRunbookUrl)||
   !url(operations.onCallScheduleUrl)||!url(operations.retentionPolicyUrl)||
   !integer(operations.retentionHours,1)||operations.retentionHours>168||
   !integer(operations.reviewedAtMs,1)||!integer(nowMs,1)||operations.reviewedAtMs>nowMs||
   nowMs-operations.reviewedAtMs>86_400_000||
   operations.privateIngressDisabled!==true||operations.unqualifiedFeaturesDisabled!==true||
   operations.rollbackReady!==true||operations.incidentOwnerAcknowledged!==true)
   reasons.push('operational_controls_unqualified');
 if(!Array.isArray(checks)||checks.length!==TESTS.length||
   new Set(checks.map(item=>item?.name)).size!==TESTS.length||
   TESTS.some(name=>!checks.some(item=>item?.name===name)))reasons.push('launch_check_coverage_missing');
 if(reasons.length)return response('blocked',reasons);
 for(const name of TESTS){
   const check=checks.find(item=>item.name===name);
   if(check.releaseId!==release.releaseId||check.environment!==release.environment||
     check.result!=='passed'||!url(check.evidenceUrl)||!safeString(check.operator)||
     !safeString(check.approver)||check.operator===check.approver||
     !integer(check.reviewedAtMs,1)||check.reviewedAtMs>nowMs||
     nowMs-check.reviewedAtMs>86_400_000||check.privateIngressRemainsDisabled!==true){
     reasons.push(`${name}_unqualified`);
   }
 }
 return reasons.length?response('blocked',reasons):response('hold_for_operator',[
   'operational_evidence_recorded','verify_provenance_and_live_state_independently',
   'separate_authorized_release_decision_required'
 ]);
}
