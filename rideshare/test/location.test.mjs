import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {normalizePoint,locationPayload,createLocationRoutingAdapter,createPrivateLocationStore} from '../src/location.mjs';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const authority={issuer:'https://location.example',audience:'liftd-api',keys:{v1:keys.publicKey.export({type:'spki',format:'pem'})}};
const point={latitude:49.282731,longitude:-123.120739,precision:'exact'};
const payload={pickup:point,dropoff:{...point,latitude:49.29},passengerCount:2};
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function proof(r,patch={}) {
  const claims={iss:authority.issuer,aud:'liftd-api',sub:r.riderId,iat:100,nbf:100,exp:130,jti:'route_proof',purpose:'liftd_location_route',
    nonce:r.nonce,routeRef:r.routeRef,pointsDigest:r.pointsDigest,provider:'provider_1',provenanceRef:'scope_1',revision:1,
    distanceMeters:1800,durationSeconds:500,country:'CA',region:'BC',municipality:'Vancouver',service:'liftd-passenger',airport:false,crossBoundary:false,available:true,ambiguous:false,...patch};
  const content=`${b64({alg:'RS256',typ:'JWT',kid:'v1'})}.${b64(claims)}`;
  return `${content}.${sign('RSA-SHA256',Buffer.from(content),keys.privateKey).toString('base64url')}`;
}
const adapter=patch=>createLocationRoutingAdapter({authority,clock:()=>100,resolveRoute:async r=>proof(r,patch)});
test('exact private coordinates stay exact; approximate coordinates are reduced before routing/storage',()=>{
  assert.deepEqual(normalizePoint(point),point);
  assert.deepEqual(normalizePoint({...point,precision:'approximate'}),{latitude:49.28,longitude:-123.12,precision:'approximate'});
  for(const patch of [{latitude:NaN},{latitude:91},{longitude:181},{precision:'public'},{address:'private address'}])assert.throws(()=>normalizePoint({...point,...patch}),{name:'AuthError'});
  assert.throws(()=>locationPayload({riderId:'rider_1',commandId:'c1',pickup:point,dropoff:point,passengerCount:0}),{name:'AuthError'});
});
test('provider-neutral route returns only municipality precision, metrics and provenance',async()=>{
  const result=await adapter().resolve('route_1','rider_1',payload);
  assert.equal(result.descriptor.precision,'municipality');assert.equal(result.scope.passengerCount,2);
  for(const field of ['pickup','dropoff','latitude','longitude','points'])assert.equal(field in result.descriptor,false);
});
test('signed routing rejects forged/mismatched/stale/ambiguous/unavailable/out-of-scope evidence',async()=>{
  for(const patch of [{nonce:'old'},{pointsDigest:'other'},{routeRef:'other'},{sub:'other'},{aud:'doobr-api'},{exp:100},{ambiguous:true},
    {available:false},{municipality:'Richmond'},{airport:true},{crossBoundary:true},{distanceMeters:-1},{durationSeconds:1.5},{points:[point]}]) {
    await assert.rejects(()=>adapter(patch).resolve('route_1','rider_1',payload));
  }
  await assert.rejects(()=>createLocationRoutingAdapter({authority,clock:()=>100,resolveRoute:async()=>{throw Error('provider down');}}).resolve('route_1','rider_1',payload));
});
test('private storage requires explicit valid encryption and retention configuration',()=>{
  for(const config of [{},{keys:{v1:Buffer.alloc(31)},activeKey:'v1',retentionSeconds:10},{keys:{v1:Buffer.alloc(32)},activeKey:'v1',retentionSeconds:0}]) {
    assert.throws(()=>createPrivateLocationStore({},config),e=>e.code==='PRIVACY_CONFIGURATION_REQUIRED');
  }
});
