import {createHash} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';

const ident=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const fail=(code,status=409)=>{throw new AuthError(code,status)};
const categories=new Set(['cancellation','no_show','fare','lost_property','incident']);
const decisions=new Set(['upheld','denied','needs_action']);
const classes=new Set(['receipt','statement','property','incident']);
const moves={OPEN:new Set(['evidence','escalate','decide','close']),ESCALATED:new Set(['evidence','decide']),DECIDED:new Set(['appeal','close']),APPEALED:new Set(['evidence','escalate','decide']),CLOSED:new Set()};
const scope=(principal,trip)=>principal.role==='operator'||(principal.role==='rider'&&trip.riderId===principal.subject)||(principal.role==='driver'&&trip.driverId===principal.subject);
const view=row=>Object.freeze({caseId:row.case_id,tripId:row.trip_id,category:row.category,status:row.status,revision:Number(row.revision),createdAt:Number(row.created_at),retentionUntil:Number(row.retention_until),appealUntil:row.appeal_until===null?null:Number(row.appeal_until),decision:row.decision});
export function createSupportCaseService({pool,authenticator,clock=()=>Math.floor(Date.now()/1000),retentionSeconds=90*86400,appealSeconds=14*86400}) {
 if(typeof pool?.connect!=='function'||typeof authenticator?.authorize!=='function'||!Number.isSafeInteger(retentionSeconds)||retentionSeconds<86400||!Number.isSafeInteger(appealSeconds)||appealSeconds<86400)fail('SUPPORT_UNAVAILABLE',503);
 const now=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('CLOCK_UNAVAILABLE',503);return t};
 async function authorized(token,tripId,action,prior) {
  const p=await authenticator.authorize(token,{action,resource:'trip:'+tripId});
  if(!ident(p?.subject)||!ident(p?.accountId)||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now()||!['rider','driver','operator'].includes(p.role))fail('SUPPORT_DENIED',403);
  if(prior&&['subject','accountId','role','sessionId','recoveryEpoch','deviceId'].some(k=>p[k]!==prior[k]))fail('SUPPORT_SESSION_CHANGED',403);
  return p;
 }
 async function trip(client,tripId,p) {
  const row=(await client.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1',[tripId])).rows[0]?.snapshot;
  if(!row)fail('TRIP_UNAVAILABLE',404);
  if(!scope(p,row))fail('SUPPORT_SCOPE_DENIED',403);
  return row;
 }
 async function transact(fn) {
  const client=await pool.connect();
  try {await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL statement_timeout='10s'");await checkSchema(client);const result=await fn(client);await client.query('COMMIT');return result}
  catch(e){try{await client.query('ROLLBACK')}catch{}if(e instanceof AuthError)throw e;fail('SUPPORT_UNAVAILABLE',503)}
  finally{client.release()}
 }
 async function execute(token,caseId,input,action) {
  record(input,action==='open'?['tripId','category','commandId']:action==='evidence'?['commandId','expectedRevision','evidenceDigest','evidenceClass']:action==='decide'?['commandId','expectedRevision','decision']:['commandId','expectedRevision']);
  if(!ident(caseId)||!ident(input.commandId)|| (action!=='open'&&(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)))fail('INVALID_REQUEST',400);
  if(action==='open'&&(!ident(input.tripId)||!categories.has(input.category)))fail('INVALID_REQUEST',400);
  if(action==='evidence'&&(!/^[a-f0-9]{64}$/.test(input.evidenceDigest||'')||!classes.has(input.evidenceClass)))fail('INVALID_REQUEST',400);
  if(action==='decide'&&!decisions.has(input.decision))fail('INVALID_REQUEST',400);
  const result=await transact(async client=>{
   const claimedTrip=action==='open'?input.tripId:(await client.query('SELECT trip_id FROM liftd.support_cases WHERE case_id=$1',[caseId])).rows[0]?.trip_id;
   if(!claimedTrip)fail('CASE_UNAVAILABLE',404);
   const p=await authorized(token,claimedTrip,action==='open'?'support.open':'support.'+action);
   await trip(client,claimedTrip,p);
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:support-command:'+p.subject+':'+input.commandId]);
   const requestHash=digest({caseId,action,input});
   const previous=(await client.query('SELECT case_id,request_hash,result FROM liftd.support_commands WHERE actor_id=$1 AND command_id=$2',[p.subject,input.commandId])).rows[0];
   if(previous){if(previous.case_id!==caseId||previous.request_hash!==requestHash)fail('SUPPORT_IDEMPOTENCY_CONFLICT');await authorized(token,claimedTrip,action==='open'?'support.open':'support.'+action,p);return previous.result}
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:support-case:'+caseId]);
   const t=now();let row=(await client.query('SELECT * FROM liftd.support_cases WHERE case_id=$1 FOR UPDATE',[caseId])).rows[0];
   if(action==='open'){
    if(row)fail('CASE_ALREADY_EXISTS');
    if(p.role==='operator')fail('SUPPORT_SCOPE_DENIED',403);
    const bound=await trip(client,claimedTrip,p);if(!['CANCELLED','COMPLETED','ASSIGNED','ARRIVED','IN_PROGRESS'].includes(bound.state))fail('CASE_TRIP_NOT_ELIGIBLE');
    row={case_id:caseId,trip_id:claimedTrip,category:input.category,status:'OPEN',revision:0,created_at:t,retention_until:t+retentionSeconds,appeal_until:null,decision:null,appeal_count:0};
    await client.query('INSERT INTO liftd.support_cases(case_id,trip_id,opener_id,opener_account,category,status,revision,created_at,retention_until) VALUES($1,$2,$3,$4,$5,$6,0,$7,$8)',[caseId,claimedTrip,p.subject,p.accountId,input.category,'OPEN',t,t+retentionSeconds]);
   }else{
    if(!row)fail('CASE_UNAVAILABLE',404);
    if(row.retention_until<=t)fail('CASE_RETENTION_EXPIRED',410);
    if(!moves[row.status]?.has(action))fail('CASE_TRANSITION_DENIED');
    if(row.revision!==input.expectedRevision)fail('CASE_STALE_REVISION');
    if(action==='appeal'){
     if(p.role==='operator'||!(p.subject===row.opener_id)||row.appeal_count!==0||row.appeal_until===null||t>Number(row.appeal_until))fail('APPEAL_DENIED',403);
    }else if(['escalate','decide','close'].includes(action)&&p.role!=='operator')fail('SUPPORT_SCOPE_DENIED',403);
    else if(action==='evidence'&&p.role!=='operator'&&p.subject!==row.opener_id)fail('EVIDENCE_DENIED',403);
    const state={evidence:row.status,escalate:'ESCALATED',decide:'DECIDED',appeal:'APPEALED',close:'CLOSED'}[action];
    const count=row.appeal_count+(action==='appeal'?1:0);
    const decision=action==='decide'?input.decision:row.decision;
    const appealUntil=action==='decide'?t+appealSeconds:(action==='appeal'?null:row.appeal_until);
    await client.query('UPDATE liftd.support_cases SET status=$1,revision=revision+1,appeal_count=$2,decision=$3,appeal_until=$4 WHERE case_id=$5',[state,count,action==='appeal'?null:decision,action==='appeal'?null:appealUntil,caseId]);
    row={...row,status:state,revision:row.revision+1,appeal_count:count,decision:action==='appeal'?null:decision,appeal_until:appealUntil};
   }
   await authorized(token,claimedTrip,action==='open'?'support.open':'support.'+action,p);
   await client.query('INSERT INTO liftd.support_events(case_id,revision,action,actor_id,evidence_digest,evidence_class,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[caseId,row.revision,action,p.subject,action==='evidence'?input.evidenceDigest:null,action==='evidence'?input.evidenceClass:null,t]);
   const result=view(row);
   await client.query('INSERT INTO liftd.support_commands(actor_id,command_id,case_id,request_hash,result) VALUES($1,$2,$3,$4,$5)',[p.subject,input.commandId,caseId,requestHash,result]);
   return result;
  });
  return Object.freeze(result);
 }
 return Object.freeze({
  open:(token,caseId,input)=>execute(token,caseId,input,'open'),
  evidence:(token,caseId,input)=>execute(token,caseId,input,'evidence'),
  escalate:(token,caseId,input)=>execute(token,caseId,input,'escalate'),
  decide:(token,caseId,input)=>execute(token,caseId,input,'decide'),
  appeal:(token,caseId,input)=>execute(token,caseId,input,'appeal'),
  close:(token,caseId,input)=>execute(token,caseId,input,'close'),
  async read(token,caseId) {
   if(!ident(caseId))fail('INVALID_REQUEST',400);
   return transact(async client=>{
    const row=(await client.query('SELECT * FROM liftd.support_cases WHERE case_id=$1',[caseId])).rows[0];
    if(!row)fail('CASE_UNAVAILABLE',404);
    const p=await authorized(token,row.trip_id,'support.read');
    await trip(client,row.trip_id,p);
    if(row.retention_until<=now())fail('CASE_RETENTION_EXPIRED',410);
    if(p.role!=='operator'&&p.subject!==row.opener_id)fail('SUPPORT_SCOPE_DENIED',403);
    const evidence=await client.query("SELECT revision,evidence_class,evidence_digest,recorded_at FROM liftd.support_events WHERE case_id=$1 AND action='evidence' ORDER BY revision LIMIT 101",[caseId]);
    if(evidence.rows.length>100)fail('EVIDENCE_LIMIT_EXCEEDED',409);
    await authorized(token,row.trip_id,'support.read',p);
    return Object.freeze({...view(row),evidence:evidence.rows.map(e=>Object.freeze({revision:Number(e.revision),evidenceClass:e.evidence_class,evidenceDigest:e.evidence_digest,recordedAt:Number(e.recorded_at)}))});
   })
  }
 });
}
