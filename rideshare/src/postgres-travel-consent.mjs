import {randomBytes,createHash} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(c,s=403)=>{throw new AuthError(c,s)};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function createPostgresTravelConsentStore(pool,{clock=()=>Math.floor(Date.now()/1000)}={}){
 if(typeof pool?.connect!=='function'||typeof pool?.query!=='function')fail('CONSENT_STORE_UNAVAILABLE',503);
 const time=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_UNAVAILABLE',503);return n};
 return Object.freeze({
  async consume(req){
   record(req,['commandId','tripId','tripRevision','actorId','accountId','sessionId','purpose','expiresAt','consent']);
   if(![req.commandId,req.tripId,req.actorId,req.accountId,req.sessionId].every(id)||req.purpose!=='travel_ground_connection'||req.consent!==true||
      !Number.isSafeInteger(req.tripRevision)||req.tripRevision<0||!Number.isSafeInteger(req.expiresAt)||req.expiresAt<=time())fail('INVALID_CONSENT',400);
   const digest=hash(req);let client;
   try{
    client=await pool.connect();await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='3s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:handoff:'+req.actorId+':'+req.commandId]);
    const old=(await client.query('SELECT * FROM liftd.travel_handoffs WHERE actor_id=$1 AND command_id=$2',[req.actorId,req.commandId])).rows[0];
    if(old){
     if(old.request_hash!==digest)fail('CONSENT_IDEMPOTENCY_CONFLICT',409);
     if(Number(old.expires_at)<=time())fail('CONSENT_EXPIRED');
     await client.query('COMMIT');
     return Object.freeze({commandId:old.command_id,handoffId:old.handoff_id,tripId:old.trip_id,
      actorId:old.actor_id,accountId:old.account_id,sessionId:old.session_id,tripRevision:Number(old.trip_revision),purpose:old.purpose,expiresAt:Number(old.expires_at)});
    }
    // Compare the canonical trip revision within the same PostgreSQL transaction.
    const trip=(await client.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1 FOR UPDATE',[req.tripId])).rows[0]?.snapshot;
    if(!trip||trip.riderId!==req.actorId||trip.revision!==req.tripRevision||!['REQUESTED','ASSIGNED','ARRIVED'].includes(trip.state))fail('TRIP_CHANGED',409);
    const t=time();if(req.expiresAt<=t)fail('CONSENT_EXPIRED');
    const handoffId=randomBytes(24).toString('base64url');
    await client.query(`INSERT INTO liftd.travel_handoffs(handoff_id,actor_id,account_id,session_id,command_id,trip_id,trip_revision,purpose,expires_at,request_hash,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[handoffId,req.actorId,req.accountId,req.sessionId,req.commandId,req.tripId,req.tripRevision,req.purpose,req.expiresAt,digest,t]);
    await client.query('COMMIT');
    return Object.freeze({commandId:req.commandId,handoffId,tripId:req.tripId,actorId:req.actorId,accountId:req.accountId,sessionId:req.sessionId,
     tripRevision:req.tripRevision,purpose:req.purpose,expiresAt:req.expiresAt});
   }catch(e){if(client)try{await client.query('ROLLBACK')}catch{}
    if(e instanceof AuthError)throw e;fail('CONSENT_STORE_UNAVAILABLE',503);
   }finally{client?.release()}
  },
  async read({handoffId,tripId,actorId,accountId,sessionId}){
   if(![handoffId,tripId,actorId,accountId,sessionId].every(id))fail('INVALID_HANDOFF',400);
   let q;try{q=await pool.query('SELECT * FROM liftd.travel_handoffs WHERE handoff_id=$1 AND trip_id=$2 AND actor_id=$3 AND account_id=$4 AND session_id=$5',[handoffId,tripId,actorId,accountId,sessionId]);}
   catch{fail('CONSENT_STORE_UNAVAILABLE',503)}
   const row=q.rows[0];if(!row||Number(row.expires_at)<=time())return null;
   return Object.freeze({handoffId:row.handoff_id,tripId:row.trip_id,actorId:row.actor_id,accountId:row.account_id,sessionId:row.session_id,
     tripRevision:Number(row.trip_revision),purpose:row.purpose,expiresAt:Number(row.expires_at)});
  }
 });
}
