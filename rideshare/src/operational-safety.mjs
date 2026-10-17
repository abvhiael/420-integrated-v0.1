import {createHash,verify as verifySignature} from 'node:crypto';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const denied=code=>{throw Object.assign(new Error(code),{code})};
export const safetyGates=Object.freeze(['SAFE-INCIDENT','SAFE-SUPPORT','SAFE-ESCALATION','SAFE-OPERATOR','SAFE-DRILL']);
export function validateDutyCoverage({primary,backup,supervisor,coverageStart,coverageEnd},now){
 if(![primary,backup,supervisor].every(id)||new Set([primary,backup,supervisor]).size!==3||
 !Number.isSafeInteger(coverageStart)||!Number.isSafeInteger(coverageEnd)||
 coverageStart>now||coverageEnd<=now)denied('SAFETY_DUTY_UNSTAFFED');
 return Object.freeze({primary,backup,supervisor,coverageEnd});
}
export function assessEscalation({createdAt,acknowledgedAt,acknowledgedBy,primary,backup,supervisor,ackLimitSeconds=120},now){
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(createdAt)||createdAt>now||
 !Number.isInteger(ackLimitSeconds)||ackLimitSeconds<1||ackLimitSeconds>3600||
 ![primary,backup,supervisor].every(id))denied('SAFETY_ESCALATION_INVALID');
 if(acknowledgedAt!==null&&acknowledgedAt!==undefined){
  if(!Number.isSafeInteger(acknowledgedAt)||acknowledgedAt<createdAt||acknowledgedAt>now||
    ![primary,backup,supervisor].includes(acknowledgedBy))denied('SAFETY_ACK_INVALID');
  return Object.freeze({state:acknowledgedAt-createdAt<=ackLimitSeconds?'ACKNOWLEDGED':'LATE_ACKNOWLEDGMENT',acknowledgedBy});
 }
 return Object.freeze({state:now-createdAt>=ackLimitSeconds?'ESCALATE_BACKUP':'AWAIT_PRIMARY',route:now-createdAt>=2*ackLimitSeconds?supervisor:now-createdAt>=ackLimitSeconds?backup:primary});
}
export function authorizeEmergencyOperation({actor,approver,role,action,expiresAt,revoked,incidentId},now){
 if(!id(actor)||!id(approver)||actor===approver||!id(incidentId)||role!=='emergency_operator'||
 !['pause','contain','read_incident_evidence'].includes(action)||revoked!==false||
 !Number.isSafeInteger(expiresAt)||expiresAt<=now||expiresAt>now+900)denied('SAFETY_EMERGENCY_DENIED');
 return Object.freeze({actor,approver,incidentId,action,expiresAt});
}
export function verifyIndependentSafetyDecisions({records,environment,imageDigest,implementationSha,configDigest,approvedReviewers,publicKeys,now}){
 if(!Array.isArray(records)||records.length!==safetyGates.length||
 !id(environment)||!sha(imageDigest)||!(/^[a-f0-9]{40}$/.test(implementationSha))||!sha(configDigest)||
 !Number.isSafeInteger(now)||!approvedReviewers||!publicKeys)denied('SAFETY_ACCEPTANCE_INCOMPLETE');
 const results=new Set();
 for(const record of records){
  if(!record||!safetyGates.includes(record.gate_id)||results.has(record.gate_id)||
   record.environment!==environment||record.image_digest!==imageDigest||
   record.implementation_sha!==implementationSha||record.configuration_digest!==configDigest||
   record.disposition!=='PASS'||!id(record.reviewer_id)||!id(record.approver_id)||
   record.reviewer_id===record.approver_id||record.reviewer_independence!==true||
   approvedReviewers[record.reviewer_id]!==true||!Array.isArray(record.scenario_ids)||record.scenario_ids.length===0||
   !record.scenario_ids.every(id)||!Array.isArray(record.redacted_evidence_uris)||record.redacted_evidence_uris.length===0||
   !record.redacted_evidence_uris.every(x=>typeof x==='string'&&x.startsWith('https://'))||
   !Number.isSafeInteger(record.reviewer_signed_at)||record.reviewer_signed_at>now||
   !Number.isSafeInteger(record.approved_expiry)||record.approved_expiry<=now||
   record.critical_open_findings!==0||!sha(record.evidence_sha256)||
   !id(record.approval_signature))denied('SAFETY_ACCEPTANCE_INCOMPLETE');
  const key=publicKeys[record.approver_id];if(!key)denied('SAFETY_APPROVER_UNTRUSTED');
  const signedFields=['gate_id','environment','image_digest','implementation_sha','configuration_digest','disposition','reviewer_id','approver_id','reviewer_signed_at','approved_expiry','evidence_sha256'];
  const bytes=Buffer.from(JSON.stringify(signedFields.map(k=>record[k])));
  let valid=false;
  try{valid=verifySignature(null,bytes,key,Buffer.from(record.approval_signature,'base64url'))}catch{}
  if(!valid)denied('SAFETY_SIGNATURE_INVALID');
  results.add(record.gate_id);
 }
 if(results.size!==safetyGates.length)denied('SAFETY_ACCEPTANCE_INCOMPLETE');
 return Object.freeze({accepted:true,gates:safetyGates.length});
}
export function assertSafetyRelease({accepted,operationalCoverage,trafficEnabled},now){
 if(trafficEnabled!==false||accepted?.accepted!==true)denied('SAFETY_RELEASE_DENIED');
 validateDutyCoverage(operationalCoverage,now);
 return Object.freeze({accepted:true,publicTrafficEnabled:false});
}
