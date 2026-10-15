import {createHash,randomBytes} from 'node:crypto';
import {AuthError,record,createAuthorityVerifier,validateSessionGrants} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fail=(code,status=409)=>{throw new AuthError(code,status);};
export function validateAvailability(input) {
  record(input,['driverId','vehicleId','online','expectedRevision','commandId']);
  if(![input.driverId,input.vehicleId,input.commandId].every(id)||typeof input.online!=='boolean'||!integer(input.expectedRevision))fail('INVALID_REQUEST',400);
  return input;
}
// Candidate order is a total binary identifier order, independent of provider/GPS.
export function rankCandidates(rows) {
  return [...rows].sort((a,b)=>a.driver_id<b.driver_id?-1:a.driver_id>b.driver_id?1:a.vehicle_id<b.vehicle_id?-1:a.vehicle_id>b.vehicle_id?1:0);
}
// Independently signed fresh Session authority lookup; persisted digests are never credentials.
export function createAvailabilityVerifier({sessionAuthority,resolveSession,clock=()=>Math.floor(Date.now()/1000)}) {
  const verify=createAuthorityVerifier(sessionAuthority,{purpose:'liftd_session_status',fields:['nonce','tokenDigest','accountId','sessionId','deviceId','recoveryEpoch','active','deviceActive','tokenActive','grants']});
  if(typeof resolveSession!=='function')fail('DISPATCH_CONFIGURATION_REQUIRED',503);
  return async row=>{
    const context=row.session_context,nonce=randomBytes(24).toString('base64url'),before=clock();
    if(!integer(before))fail('CLOCK_UNAVAILABLE',503);
    let signed;try{signed=await resolveSession({nonce,...context});}catch{fail('SESSION_AUTHORITY_UNAVAILABLE',503);}
    const now=clock();if(!integer(now)||now<before)fail('CLOCK_UNAVAILABLE',503);
    const proof=verify(signed,now);
    if(proof.sub!==row.driver_id||proof.accountId!==row.account_id||proof.nonce!==nonce||proof.tokenDigest!==context.tokenDigest||
      proof.sessionId!==context.sessionId||proof.deviceId!==context.deviceId||proof.recoveryEpoch!==context.recoveryEpoch||
      proof.active!==true||proof.deviceActive!==true||proof.tokenActive!==true)fail('DRIVER_SESSION_REVOKED',403);
    validateSessionGrants(proof.grants);
    const matching=proof.grants.filter(g=>g.role==='driver'&&g.resource===`account:${row.driver_id}`&&g.revoked===false&&integer(g.expiresAt)&&g.expiresAt>now&&Array.isArray(g.actions)&&g.actions.includes('availability.set'));
    if(matching.length!==1)fail('DRIVER_AVAILABILITY_REVOKED',403);
    return Math.min(proof.exp,matching[0].expiresAt);
  };
}
export function createDispatchAdapter({pool,authenticator,eligibilityAdapter,availabilitySeconds,assignmentSeconds,verifyAvailability,
  clock=()=>Math.floor(Date.now()/1000),isPaused=()=>true}) {
  if(!pool||!authenticator||typeof eligibilityAdapter?.project!=='function'||typeof verifyAvailability!=='function'||
    !integer(availabilitySeconds)||availabilitySeconds<1||availabilitySeconds>300||
    !integer(assignmentSeconds)||assignmentSeconds<1||assignmentSeconds>300)fail('DISPATCH_CONFIGURATION_REQUIRED',503);
  const time=()=>{const now=clock();if(!integer(now)||now>Number.MAX_SAFE_INTEGER-300)fail('CLOCK_UNAVAILABLE',503);return now;};
  const lock=client=>client.query("SELECT pg_advisory_xact_lock(hashtextextended('liftd:dispatch:CA:BC:Vancouver',0))");
  const fresh=async(token,driverId,previous)=>{
    const p=await authenticator.authorize(token,{action:'availability.set',resource:`account:${driverId}`});
    if(p.role!=='driver'||p.subject!==driverId||(previous&&p.accountId!==previous.accountId)||time()>=p.expiresAt)fail('AVAILABILITY_SCOPE_DENIED',403);
    return p;
  };
  return Object.freeze({
    async setAvailability(token,input) {
      validateAvailability(input);const principal=await fresh(token,input.driverId);let client;
      try {
        client=await pool.connect();await client.query('BEGIN');await checkSchema(client);
        await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL statement_timeout='10s'");
        await lock(client);await fresh(token,input.driverId,principal);
        const prior=(await client.query('SELECT request,result FROM liftd.availability_commands WHERE driver_id=$1 AND command_id=$2',[input.driverId,input.commandId])).rows[0];
        if(prior){if(canonical(prior.request)!==canonical({...input,accountId:principal.accountId}))fail('IDEMPOTENCY_CONFLICT');await client.query('COMMIT');return Object.freeze(prior.result);}
        const old=(await client.query('SELECT * FROM liftd.driver_availability WHERE driver_id=$1 FOR UPDATE',[input.driverId])).rows[0];
        if((old?Number(old.revision):0)!==input.expectedRevision)fail('STALE_REVISION');
        if(old&&old.account_id!==principal.accountId)fail('AVAILABILITY_SCOPE_DENIED',403);
        if(old&&old.vehicle_id!==input.vehicleId&&(await client.query("SELECT 1 FROM liftd.trips WHERE driver_id=$1 AND state IN ('ASSIGNED','ARRIVED','IN_PROGRESS')",[input.driverId])).rowCount)fail('DRIVER_BUSY');
        if(input.expectedRevision===Number.MAX_SAFE_INTEGER)fail('REVISION_EXHAUSTED');
        if(input.online&&isPaused())fail('SERVICE_PAUSED');
        await fresh(token,input.driverId,principal);
        if(input.online&&isPaused())fail('SERVICE_PAUSED');
        const now=time(),result={driverId:input.driverId,vehicleId:input.vehicleId,online:input.online,revision:input.expectedRevision+1,expiresAt:now+availabilitySeconds};
        await client.query(`INSERT INTO liftd.driver_availability(driver_id,account_id,vehicle_id,online,revision,expires_at,session_context) VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(driver_id) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,online=EXCLUDED.online,revision=EXCLUDED.revision,expires_at=EXCLUDED.expires_at,session_context=EXCLUDED.session_context`,
          [input.driverId,principal.accountId,input.vehicleId,input.online,result.revision,result.expiresAt,{subject:principal.subject,accountId:principal.accountId,sessionId:principal.sessionId,deviceId:principal.deviceId,recoveryEpoch:principal.recoveryEpoch,tokenDigest:createHash('sha256').update(token).digest('hex')}]);
        await client.query('INSERT INTO liftd.availability_commands(driver_id,command_id,request,result) VALUES($1,$2,$3,$4)',[input.driverId,input.commandId,{...input,accountId:principal.accountId},result]);
        await client.query('COMMIT');return Object.freeze(result);
      }catch(error){if(client){try{await client.query('ROLLBACK');}catch{}}if(error instanceof AuthError)throw error;fail('DISPATCH_UNAVAILABLE',503);}
      finally{client?.release();}
    },
    async select(client,trip,command,candidateCheck) {
      if(trip.state!=='REQUESTED')fail('INVALID_TRANSITION');
      if(command.expectedRevision!==trip.revision)fail('STALE_REVISION');
      if(isPaused())fail('SERVICE_PAUSED');await lock(client);
      const rows=(await client.query(`SELECT a.* FROM liftd.driver_availability a WHERE online AND expires_at>$1
        AND NOT EXISTS(SELECT 1 FROM liftd.trips t WHERE t.state IN ('ASSIGNED','ARRIVED','IN_PROGRESS') AND (t.driver_id=a.driver_id OR t.vehicle_id=a.vehicle_id))`,[time()])).rows;
      for(const row of rankCandidates(rows)) {
        if(row.driver_id===trip.riderId)continue;
        const selected={action:'assign',expectedRevision:trip.revision,driverId:row.driver_id,vehicleId:row.vehicle_id};
        let projection;
        try{await verifyAvailability(row);projection=await eligibilityAdapter.project(trip,selected);}
        catch(error){if(error instanceof AuthError&&error.status===403)continue;throw error;}
        if(projection.driver.accountId!==row.account_id)continue;
        if(candidateCheck){try{await candidateCheck(selected);}catch(error){if(error?.code==='PICKUP_NOT_VIABLE')continue;throw error;}}
        const now=time();if(Number(row.expires_at)<=now||projection.admission.expiresAt<=now)continue;
        return {command:selected,admission:projection.admission,accountId:row.account_id,
          availabilityRevision:Number(row.revision),expiresAt:now+assignmentSeconds};
      }
      fail('NO_ELIGIBLE_DRIVER');
    },
    async leaseFor(client,trip,action) {
      await lock(client);
      const lease=(await client.query('SELECT * FROM liftd.assignment_leases WHERE trip_id=$1 FOR UPDATE',[trip.id])).rows[0];
      if(!lease||lease.driver_id!==trip.driverId||lease.vehicle_id!==trip.vehicleId)fail('ASSIGNMENT_REQUIRED');
      if(action==='arrive'&&(!['PENDING','ACCEPTED'].includes(lease.state)||Number(lease.expires_at)<=time()))fail('ASSIGNMENT_EXPIRED');
      if(action==='offer_reject'&&(lease.state!=='PENDING'||Number(lease.expires_at)<=time()))fail('OFFER_NOT_PENDING');
      if(action==='start'&&lease.state!=='ACCEPTED')fail('ASSIGNMENT_REQUIRED');
      if(action==='expire'&&(trip.state!=='ASSIGNED'||lease.state!=='PENDING'||Number(lease.expires_at)>time()))fail('ASSIGNMENT_NOT_EXPIRED');
      return lease;
    },
    async check(client,trip,action,selection,lease) {
      if(selection) {
        const row=(await client.query('SELECT * FROM liftd.driver_availability WHERE driver_id=$1 FOR UPDATE',[selection.command.driverId])).rows[0];
        if(!row||!row.online||Number(row.expires_at)<=time()||Number(row.revision)!==selection.availabilityRevision||row.account_id!==selection.accountId||row.vehicle_id!==selection.command.vehicleId||selection.expiresAt<=time())fail('AVAILABILITY_EXPIRED');
        if(await verifyAvailability(row)<=time())fail('DRIVER_AVAILABILITY_REVOKED',403);
        const projection=await eligibilityAdapter.project(trip,selection.command);
        if(projection.driver.accountId!==row.account_id||projection.admission.expiresAt<=time())fail('DRIVER_ACCOUNT_MISMATCH',403);
        if(Number(row.expires_at)<=time()||selection.expiresAt<=time())fail('AVAILABILITY_EXPIRED');
      }else if(lease&&['arrive','offer_reject'].includes(action)&&Number(lease.expires_at)<=time())fail('ASSIGNMENT_EXPIRED');
      else if(lease&&action==='expire'&&Number(lease.expires_at)>time())fail('ASSIGNMENT_NOT_EXPIRED');
    },
    async apply(client,next,action,selection) {
      if(action==='assign') {
        await client.query('INSERT INTO liftd.assignment_leases(trip_id,driver_id,vehicle_id,expires_at,state) VALUES($1,$2,$3,$4,$5)',
          [next.id,next.driverId,next.vehicleId,selection.expiresAt,'PENDING']);
      }else if(['arrive','complete','cancel','expire','offer_reject'].includes(action)&&next.driverId) {
        await client.query('UPDATE liftd.assignment_leases SET state=$1 WHERE trip_id=$2',[action==='arrive'?'ACCEPTED':'CLOSED',next.id]);
      }
    },
  });
}
