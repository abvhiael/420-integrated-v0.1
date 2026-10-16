import {createHash} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';

const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=409)=>{throw new AuthError(code,status)};
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const subject=(trip,role)=>role==='rider'?trip.riderId:trip.driverId;
const projection=row=>Object.freeze({reviewId:row.review_id,tripId:row.trip_id,subjectRole:row.subject_role,subjectId:row.subject_id,rating:row.rating,moderation:row.moderation,revision:Number(row.revision),createdAt:Number(row.created_at)});

export function createReviewService({pool,authenticator,clock=()=>Math.floor(Date.now()/1000)}) {
 if(typeof pool?.connect!=='function'||typeof authenticator?.authorize!=='function')fail('REVIEWS_UNAVAILABLE',503);
 const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_UNAVAILABLE',503);return n};
 async function permit(token,tripId,action,prior){
  const p=await authenticator.authorize(token,{action,resource:'trip:'+tripId});
  if(!p||!id(p.subject)||!id(p.accountId)||!['rider','driver','operator'].includes(p.role)||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=now())fail('REVIEW_SCOPE_DENIED',403);
  if(prior&&['subject','accountId','role','sessionId','deviceId','recoveryEpoch'].some(k=>p[k]!==prior[k]))fail('REVIEW_SESSION_CHANGED',403);
  return p;
 }
 async function transaction(fn){
  const c=await pool.connect();
  try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='10s'");await checkSchema(c);const out=await fn(c);await c.query('COMMIT');return out}
  catch(e){try{await c.query('ROLLBACK')}catch{}if(e instanceof AuthError)throw e;fail('REVIEWS_UNAVAILABLE',503)}
  finally{c.release()}
 }
 async function tripRow(c,tripId,p){
  const row=(await c.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1',[tripId])).rows[0]?.snapshot;
  if(!row)fail('TRIP_UNAVAILABLE',404);
  if(p.role!=='operator'&&subject(row,p.role)!==p.subject)fail('REVIEW_SCOPE_DENIED',403);
  return row;
 }
 async function execute(token,reviewId,input,action){
  record(input,action==='submit'?['tripId','commandId','rating']:['commandId','expectedRevision']);
  if(!id(reviewId)||!id(input.commandId)||(action==='submit'?(!id(input.tripId)||!Number.isInteger(input.rating)||input.rating<1||input.rating>5):(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)))fail('INVALID_REVIEW',400);
  return transaction(async c=>{
   const tripId=action==='submit'?input.tripId:(await c.query('SELECT trip_id FROM liftd.trip_reviews WHERE review_id=$1',[reviewId])).rows[0]?.trip_id;
   if(!tripId)fail('REVIEW_UNAVAILABLE',404);
   const act='review.'+action,p=await permit(token,tripId,act);
   const trip=await tripRow(c,tripId,p);
   if(action==='submit'&&(p.role==='operator'||trip.state!=='COMPLETED'||!id(trip.driverId)||!id(trip.riderId)))fail('REVIEW_TRIP_UNQUALIFIED',403);
   if(action!=='submit'&&p.role!=='operator')fail('REVIEW_MODERATION_DENIED',403);
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:review-command:'+p.subject+':'+input.commandId]);
   const requestHash=hash({reviewId,action,input});
   const prev=(await c.query('SELECT review_id,request_hash,result FROM liftd.review_commands WHERE actor_id=$1 AND command_id=$2',[p.subject,input.commandId])).rows[0];
   if(prev){if(prev.review_id!==reviewId||prev.request_hash!==requestHash)fail('REVIEW_REPLAY_CONFLICT');await permit(token,tripId,act,p);return Object.freeze(prev.result)}
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:review:'+reviewId]);
   let row=(await c.query('SELECT * FROM liftd.trip_reviews WHERE review_id=$1 FOR UPDATE',[reviewId])).rows[0];
   if(action==='submit'){
    if(row)fail('REVIEW_ALREADY_EXISTS');
    const other=p.role==='rider'?'driver':'rider';
    const target=subject(trip,other);
    if(!id(target)||target===p.subject)fail('REVIEW_TRIP_UNQUALIFIED',403);
    // Database UNIQUE(trip_id,author_role) additionally guards cross-command repeated reviews.
    row={review_id:reviewId,trip_id:tripId,author_id:p.subject,author_account:p.accountId,author_role:p.role,subject_id:target,subject_role:other,rating:input.rating,moderation:'PENDING',revision:0,created_at:now()};
    await c.query('INSERT INTO liftd.trip_reviews(review_id,trip_id,author_id,author_account,author_role,subject_id,subject_role,rating,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[reviewId,tripId,p.subject,p.accountId,p.role,target,other,input.rating,row.created_at]);
   }else{
    if(!row)fail('REVIEW_UNAVAILABLE',404);
    if(row.revision!==input.expectedRevision)fail('REVIEW_STALE_REVISION');
    if(row.moderation===action.toUpperCase()||row.moderation==='REJECTED')fail('REVIEW_MODERATION_FINAL');
    if(!['PENDING','APPROVED','HIDDEN'].includes(row.moderation))fail('REVIEW_MODERATION_FINAL');
    if(action==='approve'&&row.moderation==='APPROVED'||action==='hide'&&row.moderation==='HIDDEN')fail('REVIEW_MODERATION_FINAL');
    const state={approve:'APPROVED',hide:'HIDDEN',reject:'REJECTED'}[action];
    if(!state)fail('INVALID_REVIEW',400);
    await c.query('UPDATE liftd.trip_reviews SET moderation=$1,revision=revision+1 WHERE review_id=$2',[state,reviewId]);
    row={...row,moderation:state,revision:row.revision+1};
   }
   await permit(token,tripId,act,p);
   await c.query('INSERT INTO liftd.review_events(review_id,revision,action,actor_id,recorded_at) VALUES($1,$2,$3,$4,$5)',[reviewId,row.revision,action,p.subject,now()]);
   const result=projection(row);
   await c.query('INSERT INTO liftd.review_commands(actor_id,command_id,review_id,request_hash,result) VALUES($1,$2,$3,$4,$5)',[p.subject,input.commandId,reviewId,requestHash,result]);
   return result;
  });
 }
 return Object.freeze({
  submit:(token,id,input)=>execute(token,id,input,'submit'),
  approve:(token,id,input)=>execute(token,id,input,'approve'),
  hide:(token,id,input)=>execute(token,id,input,'hide'),
  reject:(token,id,input)=>execute(token,id,input,'reject'),
  async read(token,reviewId){
   if(!id(reviewId))fail('INVALID_REVIEW',400);
   return transaction(async c=>{
    const row=(await c.query('SELECT * FROM liftd.trip_reviews WHERE review_id=$1',[reviewId])).rows[0];
    if(!row)fail('REVIEW_UNAVAILABLE',404);
    const p=await permit(token,row.trip_id,'review.read');
    const trip=await tripRow(c,row.trip_id,p);
    if(p.role!=='operator'&&p.subject!==row.author_id&&p.subject!==row.subject_id)fail('REVIEW_SCOPE_DENIED',403);
    if(p.role!=='operator'&&row.moderation!=='APPROVED'&&p.subject!==row.author_id)fail('REVIEW_NOT_PUBLISHED',403);
    await permit(token,row.trip_id,'review.read',p);
    return projection(row);
   })
  },
  async reputation(token,tripId,role,targetId){
   if(!id(tripId)||!id(targetId)||!['driver','rider'].includes(role))fail('INVALID_REVIEW',400);
   return transaction(async c=>{
    const p=await permit(token,tripId,'review.reputation');
    const trip=await tripRow(c,tripId,p);
    if(trip.state!=='COMPLETED'||subject(trip,role)!==targetId)fail('REVIEW_SCOPE_DENIED',403);
    const q=await c.query("SELECT count(*)::integer AS count,coalesce(sum(rating),0)::integer AS total FROM liftd.trip_reviews WHERE subject_role=$1 AND subject_id=$2 AND moderation='APPROVED'",[role,targetId]);
    await permit(token,tripId,'review.reputation',p);
    return Object.freeze({subjectRole:role,subjectId:targetId,approvedCount:q.rows[0].count,approvedRatingTotal:q.rows[0].total,transportEligible:null,eligibilityAuthority:'independent'});
   })
  }
 });
}
