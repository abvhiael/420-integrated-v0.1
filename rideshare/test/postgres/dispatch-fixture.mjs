// Qualification-only signed independent authority stack; never a deployment issuer.
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {createAuthenticator} from '../../src/auth.mjs';
import {createSessionClient} from '../../src/session-client.mjs';
import {createEligibilityAdapter} from '../../src/eligibility.mjs';
import {createLocationRoutingAdapter,createPrivateLocationStore,createLocationService} from '../../src/location.mjs';
import {createDispatchAdapter,createAvailabilityVerifier} from '../../src/dispatch.mjs';
import {createDriverOfferService} from '../../src/driver-offers.mjs';
import {createPostgresTripStore} from '../../src/postgres-store.mjs';
import {createTripService} from '../../src/service.mjs';
import {createHttpHandler} from '../../src/http.mjs';
export const generateRoots=()=>Array.from({length:6},()=>{
  const pair=generateKeyPairSync('rsa',{modulusLength:2048});return {privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),publicKey:pair.publicKey.export({type:'spki',format:'pem'})};
});
export function fixture(pool,pairs,controls={now:100}) {
  let sequence=0;const cid=()=>`dispatch_${process.pid}_${++sequence}`;
  const clock=()=>controls.now;
  const roots=pairs.map((p,i)=>({issuer:`https://dispatch-authority-${i}.example`,audience:'liftd-api',keys:{v1:p.publicKey}}));
  const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const jwt=(i,claims)=>{const data=`${b64({alg:'RS256',typ:'JWT',kid:'v1'})}.${b64({iss:roots[i].issuer,aud:'liftd-api',iat:clock(),nbf:clock(),exp:clock()+30,jti:cid(),...claims})}`;
    return `${data}.${sign('RSA-SHA256',Buffer.from(data),pairs[i].privateKey).toString('base64url')}`;};
  const token=(role,subject,trip='dispatch_account')=>jwt(0,{sub:subject,purpose:'liftd_access',accountId:`${subject}_account`,sessionId:trip,deviceId:'dispatch_device',recoveryEpoch:0,exp:clock()+300});
  const transport=(i,purpose,fn)=>createSessionClient({endpoint:`https://dispatch-authority-${i}.example/verify`,credential:'test-only',transport:async(_,options)=>{
    if(controls.outage===i)throw Error('authority unavailable');
    const r=JSON.parse(options.body);if(i===5)controls.afterTransport?.(r);if(i===6)controls.afterFareRules?.(r);return new Response(jwt(i,{purpose,...fn(r)}),{headers:{'content-type':'application/jwt'}});
  }});
  const session=transport(1,'liftd_session_status',r=>{
    const role=r.subject.startsWith('driver_')?'driver':r.subject.startsWith('operator_')?'operator':'rider';
    return {sub:r.subject,nonce:r.nonce,tokenDigest:r.tokenDigest,accountId:r.accountId,sessionId:r.sessionId,deviceId:r.deviceId,recoveryEpoch:0,
      active:!controls.revokedSessions?.includes(r.subject),deviceActive:true,tokenActive:true,
      grants:role==='driver'?[
        {role,resource:`account:${r.subject}`,actions:['availability.set','offer.read','offer.respond',...(controls.pay?['pay.statement']:[])],expiresAt:clock()+30,revoked:false},
        {role,resource:`trip:${r.sessionId}`,actions:['trip.read','offer.respond','trip.arrive','trip.start','trip.complete','trip.cancel',...(controls.pay?['pay.read']:[])],expiresAt:clock()+30,revoked:false}]:role==='operator'?[
        {role,resource:`trip:${r.sessionId}`,actions:['trip.assign','trip.expire',...(controls.pay?['pay.reconcile','pay.read']:[])],expiresAt:clock()+30,revoked:false}]:[
        {role,resource:`account:${r.subject}`,actions:['trip.create','route.prepare',...(controls.quotes?['quote.create','quote.accept','quote.read']:[])],expiresAt:clock()+30,revoked:false},
        {role,resource:`trip:${r.sessionId}`,actions:['trip.read','trip.cancel',...(controls.pay?['pay.prepare','pay.consent','pay.reconcile','pay.read']:[])],expiresAt:clock()+30,revoked:false}]};
  });
  const authenticator=createAuthenticator({identity:roots[0],sessionAuthority:roots[1],resolveSession:session,clock});
  const tripStore=createPostgresTripStore(pool);
  const privateStore=createPrivateLocationStore(pool,{keys:{v1:Buffer.from(controls.encryptionKey??randomBytes(32).toString('base64'),'base64')},activeKey:'v1',retentionSeconds:1000,clock});
  const routingAdapter=createLocationRoutingAdapter({authority:roots[2],clock,resolveRoute:transport(2,'liftd_location_route',r=>({sub:r.riderId,nonce:r.nonce,routeRef:r.routeRef,pointsDigest:r.pointsDigest,
    provider:'dispatch_provider',provenanceRef:'dispatch_scope',revision:1,distanceMeters:controls.routeDistanceMeters??1800,durationSeconds:controls.routeDurationSeconds??500,country:'CA',region:'BC',municipality:'Vancouver',service:'liftd-passenger',airport:false,crossBoundary:false,available:true,ambiguous:false}))});
  const locationService=createLocationService({authenticator,tripStore,privateStore,routingAdapter,clock});
  const eligibilityAdapter=createEligibilityAdapter({driverRegistry:roots[3],vehicleRegistry:roots[4],transportAuthority:roots[5],clock,routeScopeFor:locationService.routeScopeFor,
    resolveDriver:transport(3,'liftd_driver_registry',r=>({...r,sub:r.driverId,accountId:`${r.driverId}_account`,recordRef:'dispatch_driver_record',revision:1,active:true,suspended:controls.suspendedDrivers?.includes(r.driverId)??false})),
    resolveVehicle:transport(4,'liftd_vehicle_registry',r=>({...r,sub:r.vehicleId,recordRef:'dispatch_vehicle_record',revision:1,active:true,suspended:false,authorizedDriverId:r.driverId,capacity:controls.capacities?.[r.vehicleId]??4})),
    resolveTransport:transport(5,'liftd_transport_eligibility',r=>({...r,sub:r.driverId,operatorRef:'dispatch_operator',approved:true,revoked:controls.revokedDrivers?.includes(r.driverId)??false,validUntil:clock()+30}))});
  const verifyAvailability=createAvailabilityVerifier({sessionAuthority:roots[1],resolveSession:session,clock});
  const dispatchAdapter=createDispatchAdapter({pool,authenticator,eligibilityAdapter,verifyAvailability,clock,isPaused:()=>controls.paused??false,availabilitySeconds:120,assignmentSeconds:30});
  const service=createTripService({authenticator,store:tripStore,privateLocationStore:privateStore,eligibilityAdapter,dispatchAdapter,isPaused:()=>controls.paused??false,clock});
  const driverOfferService=createDriverOfferService({pool,authenticator,tripService:service,eligibilityAdapter,verifyAvailability,clock,isPaused:()=>controls.paused??false});
  const handler=createHttpHandler(service,locationService,dispatchAdapter,undefined,undefined,undefined,undefined,undefined,undefined,driverOfferService);
  const rider='rider_dispatch';
  const create=async(trip,passengerCount=2)=>{
    const credential=token('rider',rider,trip);
    const route=await locationService.prepare(credential,{riderId:rider,commandId:cid(),passengerCount,pickup:{latitude:49.282731,longitude:-123.120739,precision:'exact'},dropoff:{latitude:49.29,longitude:-123.13,precision:'exact'}});
    await service.create(credential,{id:trip,routeRef:route.routeRef,riderId:rider,commandId:cid()});return trip;
  };
  const online=async(driver,vehicle,online=true)=>{
    const row=(await pool.query('SELECT revision FROM liftd.driver_availability WHERE driver_id=$1',[driver])).rows[0];
    return dispatchAdapter.setAvailability(token('driver',driver),{driverId:driver,vehicleId:vehicle,online,expectedRevision:row?Number(row.revision):0,commandId:cid()});
  };
  const transition=(role,subject,trip,action,revision,commandId=cid(),extra={})=>service.transition(token(role,subject,trip),trip,{action,expectedRevision:revision,commandId,...extra});
  return {authenticator,eligibilityAdapter,roots,jwt,transport,clock,cid,token,tripStore,privateStore,locationService,dispatchAdapter,driverOfferService,service,handler,create,online,transition};
}
