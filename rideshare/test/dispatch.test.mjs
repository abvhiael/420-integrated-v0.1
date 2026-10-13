import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {rankCandidates,validateAvailability,createDispatchAdapter,createAvailabilityVerifier} from '../src/dispatch.mjs';
import {createTrip,transitionTrip} from '../src/trip.mjs';
const input={driverId:'driver_1',vehicleId:'vehicle_1',online:true,expectedRevision:0,commandId:'command_1'};
test('availability schema rejects role/capacity/geography/TTL forgery and unsafe revisions',()=>{
  assert.equal(validateAvailability(input),input);
  for(const change of [{capacity:99},{latitude:49},{expiresAt:999},{role:'operator'},{online:1},{expectedRevision:-1},{expectedRevision:1.5},{driverId:'../other'},{commandId:undefined}])assert.throws(()=>validateAvailability({...input,...change}));
});
test('candidate ranking is deterministic total binary identifier order without mutating input',()=>{
  const rows=[{driver_id:'z',vehicle_id:'a'},{driver_id:'A',vehicle_id:'z'},{driver_id:'A',vehicle_id:'a'}];
  assert.deepEqual(rankCandidates(rows),[rows[2],rows[1],rows[0]]);assert.equal(rows[0].driver_id,'z');
});
test('bounded explicit availability and assignment configuration fails closed',()=>{
  for(const seconds of [undefined,0,-1,301,1.1])assert.throws(()=>createDispatchAdapter({pool:{},authenticator:{},eligibilityAdapter:{project(){}},verifyAvailability(){},availabilitySeconds:seconds,assignmentSeconds:30}));
  assert.throws(()=>createDispatchAdapter({pool:{},authenticator:{},eligibilityAdapter:{project(){}},availabilitySeconds:30,assignmentSeconds:30}));
});
test('expiry cancels only an unaccepted assignment at the exact deadline and preserves terminal invariants',()=>{
  const trip=transitionTrip(createTrip({id:'trip',routeRef:'route'},{subject:'rider',role:'rider'}),{action:'assign',expectedRevision:0,driverId:'driver',vehicleId:'vehicle'},
    {subject:'operator',role:'dispatcher'},{now:100,paused:false,admission:{tripId:'trip',routeRef:'route',driverId:'driver',vehicleId:'vehicle',allowed:true,expiresAt:130}});
  const expire={action:'expire',expectedRevision:1};
  assert.throws(()=>transitionTrip(trip,expire,{subject:'operator',role:'dispatcher'},{now:129,paused:false,assignmentExpiresAt:130}));
  for(const role of ['rider','driver'])assert.throws(()=>transitionTrip(trip,expire,{subject:role,role},{now:130,paused:false,assignmentExpiresAt:130}));
  const ended=transitionTrip(trip,expire,{subject:'operator',role:'dispatcher'},{now:130,paused:true,assignmentExpiresAt:130});
  assert.equal(ended.state,'CANCELLED');assert.equal(ended.revision,2);
  assert.throws(()=>transitionTrip(ended,{action:'expire',expectedRevision:2},{subject:'operator',role:'dispatcher'},{now:130,paused:false,assignmentExpiresAt:130}));
  assert.throws(()=>transitionTrip({...trip,state:'ARRIVED'},expire,{subject:'operator',role:'dispatcher'},{now:130,paused:false,assignmentExpiresAt:130}));
});
test('availability verifier pins session signatures and current subject/account/device/token/grant bindings',async()=>{
  const pair=generateKeyPairSync('rsa',{modulusLength:2048}),authority={issuer:'https://sessions.example',audience:'liftd-api',keys:{v1:pair.publicKey.export({type:'spki',format:'pem'})}};
  const context={subject:'driver',accountId:'account',sessionId:'session',deviceId:'device',recoveryEpoch:1,tokenDigest:'a'.repeat(64)};
  let change={};const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const verifier=createAvailabilityVerifier({sessionAuthority:authority,clock:()=>100,resolveSession:async request=>{
    const data=`${b64({alg:'RS256',typ:'JWT',kid:'v1'})}.${b64({iss:authority.issuer,aud:'liftd-api',purpose:'liftd_session_status',sub:'driver',iat:100,nbf:100,exp:130,jti:'proof',...context,subject:undefined,nonce:request.nonce,active:true,deviceActive:true,tokenActive:true,
      grants:[{role:'driver',resource:'account:driver',actions:['availability.set'],expiresAt:130,revoked:false}],...change})}`;
    return `${data}.${sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url')}`;
  }});
  const row={driver_id:'driver',account_id:'account',session_context:context};assert.equal(await verifier(row),130);
  for(const patch of [{active:false},{deviceActive:false},{tokenActive:false},{recoveryEpoch:0},{nonce:'stale'},{accountId:'other'},{tokenDigest:'wrong'},{sessionId:'other'},{deviceId:'other'},{sub:'other'},{exp:100},{grants:[]}]){change=patch;await assert.rejects(()=>verifier(row));}
});
