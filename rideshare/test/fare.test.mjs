import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {fareAmount,quoteAmounts,money,driverEstimate,quoteHash,createFareRulesAdapter,createPickupViabilityAdapter,CANCELLATION_POLICY} from '../src/fare.mjs';
const rules={minimumFareCents:1000,minimumDriverCentsPerHour:2500,minimumAllowanceCentsPerKm:45,taxes:[],passThrough:[]};
test('adopted CAD tariff and half-up component rounding are exact integers',()=>{
  assert.deepEqual(fareAmount(10000,1200),{baseCents:400,distanceCents:1800,durationCents:900,transportationCents:3100});
  assert.equal(fareAmount(25,2).distanceCents,5);assert.equal(fareAmount(25,2).durationCents,2);assert.equal(fareAmount(0,0).transportationCents,1000);
  for(let m=0;m<1000;m++)assert.equal(fareAmount(m,20).distanceCents,Math.floor((180*m+500)/1000));
});
test('signed statutory fare floor, taxes and pass-through charges stay separate from commissionable fare',()=>{
  const quote=quoteAmounts({distanceMeters:1,durationSeconds:1},{...rules,minimumFareCents:1200,taxes:[{code:'tax',amountCents:60}],passThrough:[{code:'trip',amountCents:25}]});
  assert.equal(quote.transportationCents,1200);assert.equal(quote.totalCents,1285);assert.equal(quote.currency,'CAD');assert.equal(quote.bookingFeeCents,0);assert.equal(quote.surgeCents,0);
});
test('currency math rejects negative, float, string, overflow and duplicate charge codes',()=>{
  for(const value of [-1,1.1,'100',NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>money(value));
  assert.throws(()=>money(BigInt(Number.MAX_SAFE_INTEGER)+1n));
  assert.throws(()=>quoteAmounts({distanceMeters:0,durationSeconds:0},{...rules,taxes:[{code:'tax',amountCents:Number.MAX_SAFE_INTEGER}]}));
  assert.throws(()=>quoteAmounts({distanceMeters:0,durationSeconds:0},{...rules,taxes:[{code:'tax',amountCents:1},{code:'tax',amountCents:1}]}));
  for(const [m,s] of [[-1,1],[1,1.5],[100000001,1],[1,604801]])assert.throws(()=>fareAmount(m,s));
});
test('pickup estimate preserves allowance, excludes tips/taxes and requires platform funding for guarantee deficits',()=>{
  assert.deepEqual(driverEstimate(3100,10000,1200,2000,300,rules),{allowanceCents:540,guaranteedEarningsCents:1042,estimatedEarningsCents:2048,requiredSubsidyCents:0});
  const long=driverEstimate(1000,1000,60,50000,3600,rules);assert.equal(long.allowanceCents,2295);assert.equal(long.estimatedEarningsCents,0);assert.equal(long.guaranteedEarningsCents,2542);assert.equal(long.requiredSubsidyCents,3837);
  assert.ok(driverEstimate(1000,1000,60,0,0,{...rules,minimumDriverCentsPerHour:100000}).requiredSubsidyCents>0);
});
test('quote hash commits prices, expiry, currency, route/policy and free-pretrip cancellation terms',()=>{
  const original={fare:1000,currency:'CAD',expiresAt:130,routeRef:'route',policyVersion:'v1',cancellationPolicy:CANCELLATION_POLICY};
  const digest=quoteHash(original);for(const change of [{fare:1001},{currency:'USD'},{expiresAt:131},{routeRef:'other'},{policyVersion:'v2'},{cancellationPolicy:{version:'other'}}])assert.notEqual(quoteHash({...original,...change}),digest);
  assert.equal(CANCELLATION_POLICY.noShowFeeCents,0);assert.equal(CANCELLATION_POLICY.activeTrip,'safety-resolution-required');
});
const pair=()=>generateKeyPairSync('rsa',{modulusLength:2048});
const authority=(p,issuer)=>({issuer,audience:'liftd-api',keys:{v1:p.publicKey.export({type:'spki',format:'pem'})}});
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const jwt=(p,a,purpose,claims)=>{const d=`${b64({alg:'RS256',typ:'JWT',kid:'v1'})}.${b64({iss:a.issuer,aud:'liftd-api',purpose,iat:100,nbf:100,exp:130,jti:'proof',...claims})}`;return `${d}.${sign('RSA-SHA256',Buffer.from(d),p.privateKey).toString('base64url')}`;};
test('fare rules require independent signed current route, tariff, purpose and CAD/jurisdiction bindings',async()=>{
  const p=pair(),a=authority(p,'https://rules.example');let patch={};
  const adapter=createFareRulesAdapter({authority:a,clock:()=>100,resolveRules:async r=>jwt(p,a,'liftd_fare_rules',{...r,riderId:undefined,sub:r.riderId,
    country:'CA',region:'BC',municipality:'Vancouver',service:'liftd-passenger',currency:'CAD',rulesRef:'rules',revision:1,...rules,...patch})});
  const route={descriptor:{routeRef:'route',provenanceRef:'scope',distanceMeters:1000,durationSeconds:60},scope:{revision:1}};
  assert.equal((await adapter.resolve('rider',route)).minimumFareCents,1000);
  for(const change of [{nonce:'stale'},{sub:'other'},{routeRef:'other'},{provenanceRef:'other'},{routeRevision:2},{currency:'USD'},{municipality:'Richmond'},{policyVersion:'v2'},{tariffFareCents:1},{minimumFareCents:-1},{exp:100},{purpose:'liftd_driver_subsidy'}]){patch=change;await assert.rejects(()=>adapter.resolve('rider',route));}
});
test('long pickups require independently funded platform reservation bound to exact trip/driver/vehicle/quote/action',async()=>{
  const p=pair(),s=pair(),pa=authority(p,'https://pickup.example'),sa=authority(s,'https://funding.example');let patch={};
  const adapter=createPickupViabilityAdapter({pickupAuthority:pa,subsidyAuthority:sa,clock:()=>100,
    resolvePickup:async r=>jwt(p,pa,'liftd_pickup_route',{...r,sub:r.driverId,pickupMeters:50000,pickupSeconds:3600}),
    resolveSubsidy:async r=>jwt(s,sa,'liftd_driver_subsidy',{...r,requiredSubsidyCents:undefined,sub:r.driverId,amountCents:5000,fundingRef:'reservation',reserved:true,payer:'liftd-platform',...patch})});
  const trip={id:'trip',routeRef:'route'},command={action:'assign',driverId:'driver',vehicleId:'vehicle'},quote={quoteHash:'a'.repeat(64),amounts:{transportationCents:1000},route:{distanceMeters:1000,durationSeconds:60}};
  assert.equal((await adapter.approve(trip,command,quote,{...rules,expiresAt:130})).fundingRef,'reservation');
  for(const change of [{amountCents:1},{reserved:false},{payer:'driver'},{quoteHash:'b'.repeat(64)},{tripId:'other'},{driverId:'other'},{vehicleId:'other'},{action:'start'},{nonce:'stale'},{exp:100}]){patch=change;await assert.rejects(()=>adapter.approve(trip,command,quote,{...rules,expiresAt:130}));}
  assert.throws(()=>createPickupViabilityAdapter({pickupAuthority:pa,subsidyAuthority:pa,resolvePickup(){},resolveSubsidy(){}}));
});
