import {createHash} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(c,s=409)=>{throw new AuthError(c,s)};
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const types=new Set(['access','export','deletion']);
const view=x=>Object.freeze({requestId:x.request_id,tripId:x.trip_id,type:x.request_type,status:x.status,revision:Number(x.revision),requestedAt:Number(x.requested_at),dueAt:Number(x.due_at),reason:x.reason||null,outcomeDigest:x.outcome_digest||null});
export function redactedPrivacyTelemetry(event){
 record(event,['event','domain','status','count','elapsedMs']);
 if(!/^[a-z_]{1,48}$/.test(event.event)||!['privacy','retention'].includes(event.domain)||!['allowed','blocked','completed','failed'].includes(event.status)||!Number.isSafeInteger(event.count)||event.count<0||event.count>100000||!Number.isSafeInteger(event.elapsedMs)||event.elapsedMs<0||event.elapsedMs>3600000)fail('TELEMETRY_INVALID',400);
 return Object.freeze({...event});
}
export const privacyRetentionPolicy=Object.freeze({locationSeconds:2592000,privacyRequestSeconds:30*86400,supportMinimumSeconds:90*86400,incidentEvidence:'PRESERVE_PENDING_AUTHORIZED_RETENTION_REVIEW',financialLedger:'IMMUTABLE_NO_DIRECT_ERASURE',locationErasure:'TOMBSTONE_ONLY',telemetry:'AGGREGATED_ALLOWLIST_ONLY'});
export function createPrivacyService({pool,authenticator,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof pool?.connect!=='function'||typeof authenticator?.authorize!=='function')fail('PRIVACY_UNAVAILABLE',503);
 const now=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('CLOCK_UNAVAILABLE',503);return t};
 async function permit(token,tripId,action,prior){
  const p=await authenticator.authorize(token,{action,resource:'trip:'+tripId});
  if(!id(p?.subject)||!id(p.accountId)||!id(p.sessionId)||!id(p.deviceId)||
     !Number.isSafeInteger(p.recoveryEpoch)||p.recoveryEpoch<0||
     !Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now()||
     p.action!==action||p.resource!=='trip:'+tripId||
     !['rider','driver','operator'].includes(p.role))fail('PRIVACY_SCOPE_DENIED',403);
  if(prior&&['subject','accountId','role','sessionId','deviceId','recoveryEpoch'].some(k=>p[k]!==prior[k]))fail('PRIVACY_SESSION_CHANGED',403);
  return p;
 }
 async function run(fn){
  const c=await pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='10s'");await checkSchema(c);const res=await fn(c);await c.query('COMMIT');return res}
  catch(e){try{await c.query('ROLLBACK')}catch{}if(e instanceof AuthError)throw e;if(e?.code==='23505')fail('PRIVACY_CONFLICT');fail('PRIVACY_UNAVAILABLE',503)}finally{c.release()}
 }
 const trip=async(c,tripId,p)=>{
  const t=(await c.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1',[tripId])).rows[0]?.snapshot;
  if(!t)fail('TRIP_UNAVAILABLE',404);
  if(p.role==='rider'&&t.riderId!==p.subject||p.role==='driver'&&t.driverId!==p.subject)fail('PRIVACY_SCOPE_DENIED',403);
  return t;
 };
 async function mutate(token,requestId,action,input){
  record(input,action==='request'?['tripId','type','commandId']:['commandId','expectedRevision']);
  if(!id(requestId)||!id(input.commandId)||action==='request'&&(!id(input.tripId)||!types.has(input.type))||action!=='request'&&(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0))fail('INVALID_PRIVACY_REQUEST',400);
  return run(async c=>{
   const tripId=action==='request'?input.tripId:(await c.query('SELECT trip_id FROM liftd.privacy_requests WHERE request_id=$1',[requestId])).rows[0]?.trip_id;
   if(!tripId)fail('PRIVACY_REQUEST_UNAVAILABLE',404);
   const p=await permit(token,tripId,'privacy.'+action);const t=await trip(c,tripId,p);
   if(action!=='request'&&p.role!=='operator')fail('PRIVACY_OPERATOR_REQUIRED',403);
   if(action==='request'&&p.role==='operator')fail('PRIVACY_SUBJECT_REQUIRED',403);
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:privacy:'+p.subject+':'+input.commandId]);
   const digest=hash({requestId,action,input});
   const prior=(await c.query('SELECT request_hash,request_id,response FROM liftd.privacy_commands WHERE actor_id=$1 AND command_id=$2',[p.subject,input.commandId])).rows[0];
   if(prior){if(prior.request_hash!==digest||prior.request_id!==requestId)fail('PRIVACY_REPLAY_CONFLICT');await permit(token,tripId,'privacy.'+action,p);return prior.response}
   let row=(await c.query('SELECT * FROM liftd.privacy_requests WHERE request_id=$1 FOR UPDATE',[requestId])).rows[0];const time=now();
   if(action==='request'){
    if(row)fail('PRIVACY_REQUEST_EXISTS');
    const due=time+privacyRetentionPolicy.privacyRequestSeconds;
    row={request_id:requestId,trip_id:tripId,subject_id:p.subject,subject_role:p.role,request_type:input.type,status:'OPEN',revision:0,requested_at:time,due_at:due,reason:null,outcome_digest:null};
    await c.query('INSERT INTO liftd.privacy_requests(request_id,trip_id,subject_id,subject_role,request_type,status,requested_at,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[requestId,tripId,p.subject,p.role,input.type,'OPEN',time,due]);
   }else{
    if(!row||row.revision!==input.expectedRevision||!['OPEN','BLOCKED_HOLD'].includes(row.status))fail('PRIVACY_STALE_OR_TERMINAL');
    const evidence=(await c.query("SELECT 1 FROM liftd.safety_incidents WHERE trip_id=$1 UNION SELECT 1 FROM liftd.support_cases WHERE trip_id=$1 AND (category='incident' OR status<>'CLOSED') UNION SELECT 1 FROM liftd.fraud_cases WHERE trip_id=$1 LIMIT 1",[tripId])).rowCount>0;
    const financial=(await c.query('SELECT 1 FROM liftd.payment_intents WHERE trip_id=$1 LIMIT 1',[tripId])).rowCount>0;
    if(action==='fulfill'&&row.request_type==='deletion'&&(evidence||financial))fail('PRIVACY_PROTECTED_RECORD',403);
    if(action==='fulfill'&&row.request_type==='deletion'&&row.subject_role!=='rider')fail('PRIVACY_LOCATION_NOT_OWNED',403);
    if(action==='fulfill'&&row.request_type==='deletion'){
     const locations=(await c.query('SELECT rider_id FROM liftd.private_locations WHERE trip_id=$1 AND NOT tombstoned FOR UPDATE',[tripId])).rows;
     if(locations.some(location=>location.rider_id!==row.subject_id))fail('PRIVACY_LOCATION_NOT_OWNED',403);
    }
    const state=action==='hold'?'BLOCKED_HOLD':action==='deny'?'DENIED':'FULFILLED';
    const reason=action==='hold'?(evidence?'retained_incident':financial?'financial_record':'subject_mismatch'):action==='deny'?'subject_mismatch':'completed';
    if(action==='fulfill'&&row.request_type==='deletion'){
     // The original location store enforces one-way tombstones without discarding immutable accounting or evidence.
     if(p.role!=='operator')fail('PRIVACY_OPERATOR_REQUIRED',403);
     await c.query('UPDATE liftd.private_locations SET sealed=NULL,tombstoned=true WHERE trip_id=$1 AND tombstoned=false',[tripId]);
    }
    const digest=hash({requestId,action,state,reason,tripId,subject:row.subject_id});
    await c.query('UPDATE liftd.privacy_requests SET status=$1,revision=revision+1,resolved_at=$2,reason=$3,outcome_digest=$4 WHERE request_id=$5',[state,['FULFILLED','DENIED'].includes(state)?time:null,reason,digest,requestId]);
    row={...row,status:state,revision:Number(row.revision)+1,reason,outcome_digest:digest};
   }
   await permit(token,tripId,'privacy.'+action,p);
   await c.query('INSERT INTO liftd.privacy_events(request_id,revision,action,actor_id,event_digest,recorded_at) VALUES($1,$2,$3,$4,$5,$6)',[requestId,row.revision,action,p.subject,hash({action,requestId,input}),time]);
   const result=view(row);
   await c.query('INSERT INTO liftd.privacy_commands(actor_id,command_id,request_id,request_hash,response) VALUES($1,$2,$3,$4,$5)',[p.subject,input.commandId,requestId,digest,result]);
   return result;
  })
 }
 return Object.freeze({
  request:(token,requestId,input)=>mutate(token,requestId,'request',input),
  fulfill:(token,requestId,input)=>mutate(token,requestId,'fulfill',input),
  hold:(token,requestId,input)=>mutate(token,requestId,'hold',input),
  deny:(token,requestId,input)=>mutate(token,requestId,'deny',input),
  read:async(token,requestId)=>{
   if(!id(requestId))fail('INVALID_PRIVACY_REQUEST',400);
   return run(async c=>{const row=(await c.query('SELECT * FROM liftd.privacy_requests WHERE request_id=$1',[requestId])).rows[0];if(!row)fail('PRIVACY_REQUEST_UNAVAILABLE',404);
    const p=await permit(token,row.trip_id,'privacy.read');await trip(c,row.trip_id,p);
    if(p.role!=='operator'&&p.subject!==row.subject_id)fail('PRIVACY_SCOPE_DENIED',403);
    await permit(token,row.trip_id,'privacy.read',p);return view(row)
   })
  },
  export:async(token,requestId)=>{
   if(!id(requestId))fail('INVALID_PRIVACY_REQUEST',400);
   return run(async c=>{const row=(await c.query('SELECT * FROM liftd.privacy_requests WHERE request_id=$1',[requestId])).rows[0];if(!row||!['access','export'].includes(row.request_type)||row.status!=='FULFILLED')fail('PRIVACY_EXPORT_NOT_READY',403);
    const p=await permit(token,row.trip_id,'privacy.export');await trip(c,row.trip_id,p);
    if(p.role==='operator'||p.subject!==row.subject_id)fail('PRIVACY_EXPORT_DENIED',403);
    const incidents=(await c.query('SELECT count(*)::int AS count FROM liftd.safety_incidents WHERE trip_id=$1',[row.trip_id])).rows[0].count;
    const snapshot=(await c.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1',[row.trip_id])).rows[0]?.snapshot;
    if(!snapshot)fail('TRIP_UNAVAILABLE',404);
    const ownRequests=(await c.query('SELECT request_id,request_type,status,requested_at,due_at,resolved_at FROM liftd.privacy_requests WHERE trip_id=$1 AND subject_id=$2 ORDER BY requested_at,request_id',[row.trip_id,p.subject])).rows.map(r=>Object.freeze({requestId:r.request_id,type:r.request_type,status:r.status,requestedAt:Number(r.requested_at),dueAt:Number(r.due_at),resolvedAt:r.resolved_at===null?null:Number(r.resolved_at)}));
    await permit(token,row.trip_id,'privacy.export',p);
    return Object.freeze({requestId,subjectId:p.subject,tripId:row.trip_id,privacyRequest:view(row),subjectRecords:Object.freeze({role:p.role,tripState:snapshot.state,tripRevision:snapshot.revision,privacyRequests:Object.freeze(ownRequests)}),incidentEvidence:{restricted:true,count:incidents},financialRecords:{restricted:true},coordinates:'REDACTED',otherPartyIdentity:'REDACTED'});
   })
  }
 });
}

/**
 * Trusted server-side retention job entry point. Scheduler and deployment credentials
 * belong to operational acceptance; do not expose this method over HTTP.
 * A failed hold check fails closed; financial, incident, fraud and open support evidence
 * prevent automatic location erasure. Every mutation is atomic with its hold checks.
 */
export async function runPrivacyRetentionSweep({pool,clock=()=>Math.floor(Date.now()/1000)}) {
 if(typeof pool?.connect!=='function')fail('PRIVACY_UNAVAILABLE',503);
 const now=clock();
 if(!Number.isSafeInteger(now)||now<0)fail('CLOCK_UNAVAILABLE',503);
 const c=await pool.connect();
 try {
  await c.query('BEGIN');
  await c.query("SET LOCAL lock_timeout='3s'");
  await c.query("SET LOCAL statement_timeout='10s'");
  await checkSchema(c);
  const overdue=(await c.query("SELECT count(*)::int AS count FROM liftd.privacy_requests WHERE status IN ('OPEN','BLOCKED_HOLD') AND due_at<=$1",[now])).rows[0].count;
  const expired=(await c.query(`
   UPDATE liftd.private_locations AS l SET sealed=NULL,tombstoned=true
   WHERE NOT l.tombstoned AND l.expires_at<=$1
   AND (l.trip_id IS NULL OR (
     NOT EXISTS (SELECT 1 FROM liftd.safety_incidents i WHERE i.trip_id=l.trip_id)
     AND NOT EXISTS (SELECT 1 FROM liftd.fraud_cases f WHERE f.trip_id=l.trip_id)
     AND NOT EXISTS (SELECT 1 FROM liftd.support_cases s WHERE s.trip_id=l.trip_id AND (s.category='incident' OR s.status<>'CLOSED'))
     AND NOT EXISTS (SELECT 1 FROM liftd.payment_intents p WHERE p.trip_id=l.trip_id)
   ))
   RETURNING l.route_ref
  `,[now])).rowCount;
  await c.query('COMMIT');
  return Object.freeze({expiredLocations:expired,overdueRequests:overdue});
 } catch(e){
  try{await c.query('ROLLBACK')}catch{}
  if(e instanceof AuthError)throw e;
  fail('PRIVACY_UNAVAILABLE',503);
 }finally{c.release()}
}
