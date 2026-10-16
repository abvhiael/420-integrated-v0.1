import {createHash} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';

const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=409)=>{throw new AuthError(code,status)};
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const classes=new Set(['account_misuse','fabricated_trip','location_manipulation','coordinated_reviews','economic_replay']);
const view=r=>Object.freeze({caseId:r.case_id,tripId:r.trip_id,category:r.category,status:r.status,revision:Number(r.revision),decision:r.decision,holdUntil:r.hold_until===null?null:Number(r.hold_until),createdAt:Number(r.created_at)});
const activeHold=async(client,tripId,now)=> {
 const q=await client.query("SELECT 1 FROM liftd.fraud_cases WHERE trip_id=$1 AND status IN ('HELD','APPEALED') AND hold_until>$2 LIMIT 1",[tripId,now]);
 return q.rowCount>0;
};
export async function enforceFraudHold(client,tripId,now) {
 if(!opaque(tripId)||!Number.isSafeInteger(now)||now<0)fail('FRAUD_GUARD_INVALID',503);
 if(await activeHold(client,tripId,now))fail('FRAUD_REVIEW_HOLD',403);
}
export function createFraudService({pool,authenticator,clock=()=>Math.floor(Date.now()/1000),maxHoldSeconds=86400}) {
 if(typeof pool?.connect!=='function'||typeof authenticator?.authorize!=='function'||!Number.isSafeInteger(maxHoldSeconds)||maxHoldSeconds<60||maxHoldSeconds>86400)fail('FRAUD_UNAVAILABLE',503);
 const now=()=>{const v=clock();if(!Number.isSafeInteger(v)||v<0)fail('CLOCK_UNAVAILABLE',503);return v};
 async function permit(token,tripId,action,previous) {
  const p=await authenticator.authorize(token,{action,resource:'trip:'+tripId});
  if(!opaque(p?.subject)||!opaque(p.accountId)||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now()||!['rider','driver','operator'].includes(p.role))fail('FRAUD_SCOPE_DENIED',403);
  if(previous&&['subject','accountId','role','sessionId','deviceId','recoveryEpoch'].some(x=>previous[x]!==p[x]))fail('FRAUD_SESSION_CHANGED',403);
  return p;
 }
 async function trip(c,tripId,p){
  const t=(await c.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1',[tripId])).rows[0]?.snapshot;
  if(!t)fail('TRIP_UNAVAILABLE',404);
  if(p.role==='rider'&&t.riderId!==p.subject||p.role==='driver'&&t.driverId!==p.subject)fail('FRAUD_SCOPE_DENIED',403);
  return t;
 }
 async function transaction(fn){
  const c=await pool.connect();
  try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='10s'");await checkSchema(c);const result=await fn(c);await c.query('COMMIT');return result}
  catch(e){try{await c.query('ROLLBACK')}catch{}if(e instanceof AuthError)throw e;if(e?.code==='23505')fail('FRAUD_CONFLICT');fail('FRAUD_UNAVAILABLE',503)}
  finally{c.release()}
 }
 async function mutate(token,caseId,action,input){
  record(input,action==='report'?['tripId','commandId','category','evidenceDigest']:action==='hold'?['commandId','expectedRevision','holdSeconds']:['commandId','expectedRevision']);
  if(!opaque(caseId)||!opaque(input.commandId)|| (action==='report'?(!opaque(input.tripId)||!classes.has(input.category)||!/^[a-f0-9]{64}$/.test(input.evidenceDigest||'')):(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)))fail('INVALID_FRAUD_REQUEST',400);
  if(action==='hold'&&(!Number.isSafeInteger(input.holdSeconds)||input.holdSeconds<60||input.holdSeconds>maxHoldSeconds))fail('INVALID_HOLD',400);
  return transaction(async c=>{
   const tripId=action==='report'?input.tripId:(await c.query('SELECT trip_id FROM liftd.fraud_cases WHERE case_id=$1',[caseId])).rows[0]?.trip_id;
   if(!tripId)fail('FRAUD_CASE_UNAVAILABLE',404);
   const p=await permit(token,tripId,'fraud.'+action);await trip(c,tripId,p);
   if(['hold','clear','release','close'].includes(action)&&p.role!=='operator')fail('FRAUD_OPERATOR_REQUIRED',403);
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:fraud-command:'+p.subject+':'+input.commandId]);
   const requestHash=digest({caseId,action,input});
   const prior=(await c.query('SELECT case_id,request_hash,result FROM liftd.fraud_commands WHERE actor_id=$1 AND command_id=$2',[p.subject,input.commandId])).rows[0];
   if(prior){if(prior.case_id!==caseId||prior.request_hash!==requestHash)fail('FRAUD_REPLAY_CONFLICT');await permit(token,tripId,'fraud.'+action,p);return Object.freeze(prior.result)}
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:fraud-case:'+caseId]);
   let row=(await c.query('SELECT * FROM liftd.fraud_cases WHERE case_id=$1 FOR UPDATE',[caseId])).rows[0];
   const t=now();
   if(action==='report'){
    if(row)fail('FRAUD_CASE_EXISTS');
    row={case_id:caseId,trip_id:tripId,reporter_id:p.subject,reporter_role:p.role,category:input.category,evidence_digest:input.evidenceDigest,status:'OPEN',revision:0,decision:null,hold_until:null,appeal_count:0,created_at:t,updated_at:t};
    await c.query('INSERT INTO liftd.fraud_cases(case_id,trip_id,reporter_id,reporter_role,category,evidence_digest,status,revision,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$8)',[caseId,tripId,p.subject,p.role,input.category,input.evidenceDigest,'OPEN',t]);
   }else{
    if(!row||row.revision!==input.expectedRevision)fail('FRAUD_STALE_REVISION');
    const next={hold:'HELD',clear:'CLEARED',release:'CLEARED',appeal:'APPEALED',close:'CLOSED'}[action];
    if(!next)fail('INVALID_FRAUD_REQUEST',400);
    if(action==='hold'&&!['OPEN','APPEALED'].includes(row.status))fail('FRAUD_TRANSITION_DENIED');
    if(action==='clear'&&!['OPEN','APPEALED'].includes(row.status))fail('FRAUD_TRANSITION_DENIED');
    if(action==='release'&&row.status!=='HELD')fail('FRAUD_TRANSITION_DENIED');
    if(action==='appeal'&&(p.role==='operator'||!['HELD','CLEARED'].includes(row.status)||row.appeal_count!==0))fail('FRAUD_APPEAL_DENIED',403);
    if(action==='close'&&!['CLEARED','APPEALED'].includes(row.status))fail('FRAUD_TRANSITION_DENIED');
    const until=action==='hold'?t+input.holdSeconds:(action==='appeal'?row.hold_until:null);
    const appeals=Number(row.appeal_count)+(action==='appeal'?1:0);
    await c.query('UPDATE liftd.fraud_cases SET status=$1,revision=revision+1,decision=$2,hold_until=$3,appeal_count=$4,updated_at=$5 WHERE case_id=$6',[next,['appeal','close'].includes(action)?row.decision:action,until,appeals,t,caseId]);
    row={...row,status:next,revision:row.revision+1,decision:['appeal','close'].includes(action)?row.decision:action,hold_until:until,appeal_count:appeals,updated_at:t};
   }
   await permit(token,tripId,'fraud.'+action,p);
   await c.query('INSERT INTO liftd.fraud_events(case_id,revision,action,actor_id,event_digest,recorded_at) VALUES($1,$2,$3,$4,$5,$6)',[caseId,row.revision,action,p.subject,digest({caseId,action,actor:p.subject,input}),t]);
   const result=view(row);
   await c.query('INSERT INTO liftd.fraud_commands(actor_id,command_id,case_id,request_hash,result) VALUES($1,$2,$3,$4,$5)',[p.subject,input.commandId,caseId,requestHash,result]);
   return result;
  })
 }
 return Object.freeze({
  report:(token,id,input)=>mutate(token,id,'report',input),
  hold:(token,id,input)=>mutate(token,id,'hold',input),
  clear:(token,id,input)=>mutate(token,id,'clear',input),
  release:(token,id,input)=>mutate(token,id,'release',input),
  appeal:(token,id,input)=>mutate(token,id,'appeal',input),
  close:(token,id,input)=>mutate(token,id,'close',input),
  async read(token,caseId){
   if(!opaque(caseId))fail('INVALID_FRAUD_REQUEST',400);
   return transaction(async c=>{
    const row=(await c.query('SELECT * FROM liftd.fraud_cases WHERE case_id=$1',[caseId])).rows[0];
    if(!row)fail('FRAUD_CASE_UNAVAILABLE',404);
    const p=await permit(token,row.trip_id,'fraud.read');
    await trip(c,row.trip_id,p);
    // Both trip participants may inspect a redacted allegation for a meaningful appeal; no reporter identity or raw evidence escapes.
    await permit(token,row.trip_id,'fraud.read',p);
    return view(row)
   })
  }
 })
}
