import {randomBytes,createHash} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';
import {transitionTrip} from './trip.mjs';
const id=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const fail=(c,status=409)=>{throw new AuthError(c,status);};
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export function createSafetyService({pool,store,authenticator,clock=()=>Math.floor(Date.now()/1000),paymentService}) {
  if(!pool||!store?.execute||!authenticator?.authorize)fail('SAFETY_UNAVAILABLE',503);
  const time=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_UNAVAILABLE',503);return n;};
  async function permit(token,action,tripId) {
    const p=await authenticator.authorize(token,{action,resource:`trip:${tripId}`});
    if(time()>=p.expiresAt)fail('AUTHORIZATION_EXPIRED',401);
    return p;
  }
  async function tripRow(client,tripId) {
    const row=(await client.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1 FOR UPDATE',[tripId])).rows[0];
    if(!row)fail('TRIP_UNAVAILABLE',404);return row.snapshot;
  }
  const scoped=(p,trip)=>p.role==='rider'&&p.subject===trip.riderId||p.role==='driver'&&p.subject===trip.driverId;
  return Object.freeze({
    async report(token,tripId,input) {
      record(input,['commandId','category']);if(!id(tripId)||!id(input.commandId)||!['medical','collision','threat','vehicle','other'].includes(input.category))fail('INVALID_REQUEST',400);
      const p=await permit(token,'safety.report',tripId);
      let client;
      try {
        client=await pool.connect();await client.query('BEGIN');await checkSchema(client);
        await client.query("SET LOCAL lock_timeout='3s'");
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`liftd:safety:${tripId}`]);
        const trip=await tripRow(client,tripId);const fresh=await permit(token,'safety.report',tripId);
        if(!scoped(p,trip)||!scoped(fresh,trip)||p.subject!==fresh.subject||p.accountId!==fresh.accountId||p.role!==fresh.role)fail('SAFETY_SCOPE_DENIED',403);
        const digest=hash({tripId,category:input.category,accountId:p.accountId});
        const previous=(await client.query('SELECT request_hash,result FROM liftd.safety_commands WHERE actor_id=$1 AND command_id=$2',[p.subject,input.commandId])).rows[0];
        if(previous){if(previous.request_hash!==digest)fail('IDEMPOTENCY_CONFLICT');await client.query('COMMIT');return previous.result;}
        if(!['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(trip.state))fail('SAFETY_TRIP_NOT_ACTIVE');
        const incidentId=randomBytes(24).toString('base64url'),now=time();
        await client.query('INSERT INTO liftd.safety_incidents(incident_id,trip_id,reporter_id,reporter_role,category,created_at,trip_revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[incidentId,tripId,p.subject,p.role,input.category,now,trip.revision]);
        await permit(token,'safety.report',tripId);
        const result={incidentId,tripId,status:'REPORTED',category:input.category,createdAt:now};
        await client.query('INSERT INTO liftd.safety_commands(actor_id,command_id,action,trip_id,request_hash,result) VALUES($1,$2,$3,$4,$5,$6)',[p.subject,input.commandId,'report',tripId,digest,result]);
        await client.query('COMMIT');return result;
      } catch(e){if(client)try{await client.query('ROLLBACK');}catch{}if(e instanceof AuthError)throw e;fail('SAFETY_UNAVAILABLE',503);}
      finally{client?.release();}
    },
    async resolve(token,tripId,input) {
      record(input,['commandId','incidentId','expectedRevision','resolution']);if(!id(tripId)||!id(input.commandId)||!id(input.incidentId)||!Number.isSafeInteger(input.expectedRevision)||!['safe_exit','interrupted'].includes(input.resolution))fail('INVALID_REQUEST',400);
      const p=await permit(token,'safety.resolve',tripId);
      if(p.role!=='operator')fail('SAFETY_SCOPE_DENIED',403);
      const guard=async()=>{const fresh=await permit(token,'safety.resolve',tripId);if(fresh.role!=='operator'||fresh.subject!==p.subject||fresh.accountId!==p.accountId||fresh.recoveryEpoch!==p.recoveryEpoch)fail('SAFETY_SCOPE_DENIED',403);};
      const result=await store.execute({actorId:p.subject,commandId:input.commandId,tripId,action:'safety_resolve',request:input,guard,beforeLock:paymentService?.lock,
        afterWrite:async(client,trip)=>{if(paymentService)await paymentService.recordLifecycle(client,trip,'safety_resolve',time());}},async(trip,client)=>{
          if(trip.state!=='IN_PROGRESS')fail('ACTIVE_TRIP_REQUIRED');
          const incident=(await client.query('SELECT * FROM liftd.safety_incidents WHERE incident_id=$1 AND trip_id=$2',[input.incidentId,tripId])).rows[0];
          if(!incident)fail('INCIDENT_REQUIRED',403);
          const next=transitionTrip(trip,{action:'safety_resolve',expectedRevision:input.expectedRevision},{subject:p.subject,role:'dispatcher'},{now:time(),paused:true});
          await guard();
          await client.query('INSERT INTO liftd.safety_resolutions(trip_id,incident_id,resolver_id,resolved_at,resolution,outcome_revision) VALUES($1,$2,$3,$4,$5,$6)',[tripId,input.incidentId,p.subject,time(),input.resolution,next.revision]);
          return next;
        });
      return {tripId,state:result.state,revision:result.revision,resolution:input.resolution,incidentId:input.incidentId};
    },
    async read(token,tripId) {
      if(!id(tripId))fail('INVALID_REQUEST',400);
      const p=await permit(token,'safety.read',tripId);if(p.role!=='operator')fail('SAFETY_SCOPE_DENIED',403);
      const trip=await store.get(tripId);if(!trip)fail('TRIP_UNAVAILABLE',404);
      const incidents=await pool.query('SELECT incident_id,category,created_at FROM liftd.safety_incidents WHERE trip_id=$1 ORDER BY created_at,incident_id',[tripId]);
      const resolution=await pool.query('SELECT incident_id,resolution,resolved_at FROM liftd.safety_resolutions WHERE trip_id=$1',[tripId]);
      await permit(token,'safety.read',tripId);
      return {tripId,incidents:incidents.rows.map(r=>({incidentId:r.incident_id,category:r.category,createdAt:Number(r.created_at)})),resolution:resolution.rows[0]?{incidentId:resolution.rows[0].incident_id,resolution:resolution.rows[0].resolution,resolvedAt:Number(resolution.rows[0].resolved_at)}:null};
    }
  });
}
