import {createHash} from 'node:crypto';
import {validateDutyCoverage,assessEscalation,authorizeEmergencyOperation,safetyGates} from './operational-safety.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=code=>{throw Object.assign(new Error(code),{code})};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const cases=new Set(['cancellation','no_show','fare','lost_property','incident']);
function capability(object,method){if(typeof object?.[method]!=='function')fail('SAFE_ADAPTER_UNAVAILABLE')}
function reason(e){return id(e?.code)?e.code:'SAFE_DEPENDENCY_UNAVAILABLE'}
/**
 * Nonpublic execution coordinator. All adapters are separately authenticated,
 * durable services. This code does not mint credentials or approve live traffic.
 */
export function createSafeGateCoordinator({safety,support,identity,escalation,audit,recovery,roster,clock=()=>Math.floor(Date.now()/1000)}){
 for(const [obj,methods] of [[safety,['report','read']],[support,['open','read']],[identity,['verify','verifySecondApprover']],[escalation,['deliver','receipt']],[audit,['append']],[recovery,['pause','drill','verifyRestore']],[roster,['current']]])
 for(const method of methods)capability(obj,method);
 const now=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('SAFE_CLOCK_INVALID');return t};
 async function actor(token,action,subjectId){
  if(!id(subjectId)||typeof token!=='string'||!token)fail('SAFE_AUTH_DENIED');
  const principal=await identity.verify({token,action,subjectId});
  if(!principal||!id(principal.subject)||principal.action!==action||principal.subjectId!==subjectId||
    !Number.isSafeInteger(principal.expiresAt)||principal.expiresAt<=now())fail('SAFE_AUTH_DENIED');
  return principal;
 }
 async function record(gate,action,principal,subjectId,result){
  // Audit must be an independently authorized durable append, not console logging.
  await audit.append({gate,action,actor:principal.subject,subjectId,resultDigest:digest(result),at:now()});
 }
 return Object.freeze({
  async incident({token,tripId,category,commandId}){
   if(!id(tripId)||!id(commandId)||!['medical','collision','threat','vehicle','other'].includes(category))fail('SAFE_INPUT_INVALID');
   const p=await actor(token,'safety.report',tripId);
   const result=await safety.report(token,tripId,{category,commandId});
   if(!id(result?.incidentId))fail('SAFE_INCIDENT_UNCONFIRMED');
   await record('SAFE-INCIDENT','report',p,tripId,{incidentId:result.incidentId});
   return Object.freeze({incidentId:result.incidentId,accepted:true});
  },
  async supportCase({token,tripId,category,request}){
   if(!id(tripId)||!cases.has(category)||!request||typeof request!=='object')fail('SAFE_INPUT_INVALID');
   const p=await actor(token,'support.open',tripId);
   // Forbid remote caller selection of operator owner or privileged case status.
   if('owner' in request||'status' in request||'role' in request)fail('SAFE_INPUT_INVALID');
   const result=await support.open(token,tripId,{...request,category});
   if(!id(result?.caseId))fail('SAFE_CASE_UNCONFIRMED');
   await record('SAFE-SUPPORT','open',p,tripId,{caseId:result.caseId});
   return Object.freeze({caseId:result.caseId,accepted:true});
  },
  async routeEscalation({token,caseId,createdAt,acknowledgedAt=null,acknowledgedBy=null}){
   if(!id(caseId))fail('SAFE_INPUT_INVALID');
   const p=await actor(token,'safety.escalate',caseId);
   const duty=validateDutyCoverage(await roster.current(),now());
   const decision=assessEscalation({...duty,createdAt,acknowledgedAt,acknowledgedBy},now());
   if(decision.state==='ACKNOWLEDGED')return Object.freeze({state:'ACKNOWLEDGED'});
   const target=decision.route;
   if(!id(target))fail('SAFE_ESCALATION_UNSTAFFED');
   const dispatch=await escalation.deliver({caseId,target,kind:'safety'});
   if(!id(dispatch?.receiptId))fail('SAFE_DELIVERY_UNCONFIRMED');
   await record('SAFE-ESCALATION','deliver',p,caseId,{receiptId:dispatch.receiptId,target});
   return Object.freeze({state:decision.state,receiptId:dispatch.receiptId});
  },
  async emergencyAction({token,approvalToken,incidentId,action}){
   if(!id(incidentId))fail('SAFE_INPUT_INVALID');
   const p=await actor(token,'safety.emergency',incidentId);
   const second=await identity.verifySecondApprover({approvalToken,incidentId,action,actor:p.subject});
   const approved=authorizeEmergencyOperation({actor:p.subject,approver:second?.subject,role:p.role,action,
     expiresAt:Math.min(p.expiresAt,second?.expiresAt??0),revoked:p.revoked===false&&second?.revoked===false?false:true,incidentId},now());
   // No privileged dispatch/pay route; any emergency action must be independently audited.
   await record('SAFE-OPERATOR','emergency-authorized',p,incidentId,{approver:approved.approver,action});
   if(action==='pause')await recovery.pause({incidentId,authority:approved});
   return Object.freeze({authorized:true,action});
  },
  async runDrill({token,approvalToken,drillId,plan}){
   if(!id(drillId)||!plan||plan.environment!=='isolated_testnet'||plan.livePassengers!==false||
     plan.emergencyServicesContact!==false||!id(plan.releaseId))fail('SAFE_DRILL_UNAUTHORIZED');
   const p=await actor(token,'safety.drill',drillId);
   const second=await identity.verifySecondApprover({approvalToken,incidentId:drillId,action:'pause',actor:p.subject});
   authorizeEmergencyOperation({actor:p.subject,approver:second?.subject,role:p.role,action:'pause',
     expiresAt:Math.min(p.expiresAt,second?.expiresAt??0),revoked:p.revoked===false&&second?.revoked===false?false:true,incidentId:drillId},now());
   await recovery.pause({incidentId:drillId,reason:'exercise'});
   await record('SAFE-DRILL','paused',p,drillId,{releaseId:plan.releaseId});
   let result;
   try {result=await recovery.drill({drillId,releaseId:plan.releaseId,failures:['provider','worker','database'],dryRun:true});}
   catch(e){await record('SAFE-DRILL','fault',p,drillId,{error:reason(e)});throw e}
   const restored=await recovery.verifyRestore({drillId,releaseId:plan.releaseId});
   if(restored?.dataIntact!==true||restored?.holdsIntact!==true||restored?.imageVerified!==true)fail('SAFE_RECOVERY_UNVERIFIED');
   await record('SAFE-DRILL','verified',p,drillId,{result,restored});
   // Explicitly no resume operation; independently signed live acceptance remains separate.
   return Object.freeze({tested:true,remainsPaused:true});
  }
 });
}
