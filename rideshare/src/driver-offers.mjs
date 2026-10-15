import {AuthError,record} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(code,status=409)=>{throw new AuthError(code,status);};
// Offer id is canonical trip id: one active pending lease per trip, no synthetic offer authority.
export function createDriverOfferService({pool,authenticator,tripService,eligibilityAdapter,verifyAvailability,clock=()=>Math.floor(Date.now()/1000),isPaused=()=>true}){
 if(!pool?.connect||!pool?.query||typeof authenticator?.authorize!=='function'||!tripService?.transition||!eligibilityAdapter?.project||typeof verifyAvailability!=='function')fail('OFFERS_UNAVAILABLE',503);
 const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_UNAVAILABLE',503);return n;};
 const actor=async(token,driverId,action='offer.read')=>{
  if(!id(driverId))fail('INVALID_DRIVER',400);
  const p=await authenticator.authorize(token,{action,resource:'account:'+driverId});
  if(p.role!=='driver'||p.subject!==driverId||p.expiresAt<=now())fail('OFFER_SCOPE_DENIED',403);
  return p;
 };
 const format=(lease,trip)=>Object.freeze({offerId:trip.id,tripId:trip.id,driverId:lease.driver_id,vehicleId:lease.vehicle_id,
  revision:trip.revision,expiresAt:Number(lease.expires_at),status:lease.state==='PENDING'?'PENDING':lease.state==='ACCEPTED'?'ACCEPTED':'EXPIRED'});
 const availability=async(token,driverId)=>{
  const principal=await actor(token,driverId,'availability.set');
  const result=await pool.query('SELECT * FROM liftd.driver_availability WHERE driver_id=$1',[driverId]);
  const row=result.rows[0];if(!row)return {driverId,vehicleId:null,revision:0,online:false,expiresAt:0};
  if(row.account_id!==principal.accountId)fail('OFFER_SCOPE_DENIED',403);
  const active=!!row.online&&Number(row.expires_at)>now();
  if(active&&await verifyAvailability(row)<=now())fail('DRIVER_SESSION_REVOKED',403);
  return Object.freeze({driverId,vehicleId:row.vehicle_id,revision:Number(row.revision),online:active,expiresAt:Number(row.expires_at)});
 };
 const offers=async(token,driverId)=>{
  const principal=await actor(token,driverId);
  const rows=await pool.query(`SELECT l.*,t.snapshot FROM liftd.assignment_leases l
    JOIN liftd.trips t ON t.trip_id=l.trip_id
    WHERE l.driver_id=$1 AND l.state IN ('PENDING','ACCEPTED')
      AND t.snapshot->>'state'='ASSIGNED' ORDER BY l.expires_at,l.trip_id LIMIT 21`,[driverId]);
  if(rows.rows.length>20)fail('OFFER_LIMIT_REACHED',503);
  const a=await availability(token,driverId);
  if(!a.vehicleId)return [];
  return Object.freeze(rows.rows.filter(r=>r.vehicle_id===a.vehicleId&&r.snapshot.driverId===driverId&&
      (r.account_id===undefined||r.account_id===principal.accountId)).map(r=>format(r,r.snapshot)));
 };
 const respond=async(token,driverId,offerId,body)=>{
  record(body,['tripId','offerId','expectedRevision','decision','commandId']);
  if(![driverId,offerId,body.tripId,body.offerId,body.commandId].every(id)||offerId!==body.offerId||offerId!==body.tripId||
    !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!['accept','reject'].includes(body.decision))fail('INVALID_REQUEST',400);
  const principal=await actor(token,driverId,'offer.respond');
  if(body.decision==='reject'){
    const existing=(await pool.query('SELECT request FROM liftd.offer_commands WHERE driver_id=$1 AND command_id=$2',[driverId,body.commandId])).rows[0];
    if(existing)fail('IDEMPOTENCY_CONFLICT');
    // Canonical audited trip/Pay cancellation, never a hidden rematch or arrival.
    const result=await tripService.transition(token,offerId,{action:'offer_reject',expectedRevision:body.expectedRevision,commandId:body.commandId});
    return Object.freeze({offerId,tripId:offerId,status:'REJECTED',tripState:result.state,revision:result.revision});
  }
  let client;try{
    client=await pool.connect();await client.query('BEGIN');await checkSchema(client);
    await client.query("SET LOCAL lock_timeout='3s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:trip:'+offerId]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('liftd:dispatch:CA:BC:Vancouver',0))");
    await actor(token,driverId,'offer.respond');
    const prior=(await client.query('SELECT request,result FROM liftd.offer_commands WHERE driver_id=$1 AND command_id=$2',[driverId,body.commandId])).rows[0];
    if(prior){
      if(canonical(prior.request)!==canonical(body))fail('IDEMPOTENCY_CONFLICT');
      await client.query('COMMIT');return Object.freeze(prior.result);
    }
    const trip=(await client.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1 FOR UPDATE',[offerId])).rows[0]?.snapshot;
    const lease=(await client.query('SELECT * FROM liftd.assignment_leases WHERE trip_id=$1 FOR UPDATE',[offerId])).rows[0];
    if(!trip||!lease||trip.state!=='ASSIGNED'||trip.revision!==body.expectedRevision||trip.driverId!==driverId||
      lease.driver_id!==driverId||lease.vehicle_id!==trip.vehicleId||lease.state!=='PENDING'||Number(lease.expires_at)<=now())fail('OFFER_EXPIRED');
    if(isPaused())fail('SERVICE_PAUSED');
    const available=(await client.query('SELECT * FROM liftd.driver_availability WHERE driver_id=$1 FOR UPDATE',[driverId])).rows[0];
    if(!available||!available.online||available.vehicle_id!==trip.vehicleId||available.account_id!==principal.accountId||
      Number(available.expires_at)<=now()||await verifyAvailability(available)<=now())fail('AVAILABILITY_EXPIRED',403);
    const projected=await eligibilityAdapter.project(trip,{action:'assign',expectedRevision:trip.revision,driverId,vehicleId:trip.vehicleId});
    if(projected.driver.accountId!==principal.accountId||projected.admission.expiresAt<=now())fail('DRIVER_INELIGIBLE',403);
    await actor(token,driverId,'offer.respond');
    if(isPaused()||Number(lease.expires_at)<=now())fail('OFFER_EXPIRED');
    await client.query("UPDATE liftd.assignment_leases SET state='ACCEPTED' WHERE trip_id=$1 AND state='PENDING'",[offerId]);
    const result={offerId,tripId:offerId,status:'ACCEPTED',tripState:'ASSIGNED',revision:trip.revision};
    await client.query('INSERT INTO liftd.offer_commands(driver_id,command_id,offer_id,request,result) VALUES($1,$2,$3,$4,$5)',
      [driverId,body.commandId,offerId,body,result]);
    await client.query('COMMIT');return Object.freeze(result);
  }catch(e){try{await client?.query('ROLLBACK');}catch{}if(e instanceof AuthError)throw e;fail('OFFERS_UNAVAILABLE',503);}
  finally{client?.release();}
 };
 return Object.freeze({readAvailability:availability,readOffers:offers,respondOffer:respond});
}
