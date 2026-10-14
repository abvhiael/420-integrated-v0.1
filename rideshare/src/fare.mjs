import {createHash,randomBytes,createPublicKey} from 'node:crypto';
import {AuthError,record,createAuthorityVerifier} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {VANCOUVER_SCOPE} from './eligibility.mjs';
const fail=(code,status=409)=>{throw new AuthError(code,status);};
const integer=v=>Number.isSafeInteger(v)&&v>=0;
export const money=v=>{if(typeof v==='bigint'){if(v<0n||v>BigInt(Number.MAX_SAFE_INTEGER))fail('INVALID_MONEY',400);return Number(v);}if(!integer(v))fail('INVALID_MONEY',400);return v;};
const halfUp=(n,d)=>(n+d/2n)/d;
const ceiling=(n,d)=>(n+d-1n)/d;
export const CANCELLATION_POLICY=Object.freeze({version:'v1-free-pretrip',preTripRiderFeeCents:0,driverCancellationFeeCents:0,assignmentExpiryFeeCents:0,noShowFeeCents:0,waitingFeeCents:0,
  activeTrip:'safety-resolution-required',driverEarnedObligations:'preserved'});
export function fareAmount(distanceMeters,durationSeconds) {
  if(!integer(distanceMeters)||distanceMeters>100000000||!integer(durationSeconds)||durationSeconds>604800)fail('INVALID_ROUTE',400);
  const distanceCents=money(halfUp(180n*BigInt(distanceMeters),1000n)),durationCents=money(halfUp(45n*BigInt(durationSeconds),60n));
  return Object.freeze({baseCents:400,distanceCents,durationCents,transportationCents:Math.max(1000,400+distanceCents+durationCents)});
}
export function lines(value) {
  if(!Array.isArray(value)||value.length>8)fail('INVALID_FARE_RULES',403);
  const seen=new Set();return value.map(line=>{
    record(line,['code','amountCents']);if(typeof line.code!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(line.code)||seen.has(line.code))fail('INVALID_FARE_RULES',403);
    seen.add(line.code);return Object.freeze({code:line.code,amountCents:money(line.amountCents)});
  });
}
export function quoteAmounts(route,rules) {
  const tariff=fareAmount(route.distanceMeters,route.durationSeconds),taxes=lines(rules.taxes),passThrough=lines(rules.passThrough);
  const transportationCents=Math.max(tariff.transportationCents,money(rules.minimumFareCents));
  const totalCents=money([...taxes,...passThrough].reduce((sum,line)=>sum+BigInt(line.amountCents),BigInt(transportationCents)));
  return Object.freeze({...tariff,transportationCents,minimumAdjustmentCents:transportationCents-(tariff.baseCents+tariff.distanceCents+tariff.durationCents),
    bookingFeeCents:0,surgeCents:0,taxes,passThrough,totalCents,currency:'CAD'});
}
export const quoteHash=payload=>createHash('sha256').update(canonical(payload)).digest('hex');
export function createFareRulesAdapter({authority,resolveRules,clock=()=>Math.floor(Date.now()/1000)}) {
  const verify=createAuthorityVerifier(authority,{purpose:'liftd_fare_rules',fields:['nonce','routeRef','provenanceRef','routeRevision','country','region','municipality','service','currency',
    'tariffFareCents','policyVersion','rulesRef','revision','minimumFareCents','minimumDriverCentsPerHour','minimumAllowanceCentsPerKm','taxes','passThrough']});
  if(typeof resolveRules!=='function')fail('FARE_RULES_UNAVAILABLE',503);
  return Object.freeze({async resolve(riderId,route,acceptedFareCents) {
    const request={nonce:randomBytes(24).toString('base64url'),riderId,routeRef:route.descriptor.routeRef,provenanceRef:route.descriptor.provenanceRef,routeRevision:route.scope.revision,tariffFareCents:acceptedFareCents===undefined?fareAmount(route.descriptor.distanceMeters,route.descriptor.durationSeconds).transportationCents:money(acceptedFareCents),policyVersion:'v1'};
    const before=clock();let signed;try{signed=await resolveRules(request);}catch{fail('FARE_RULES_UNAVAILABLE',503);}
    const now=clock();if(!integer(before)||!integer(now)||now<before)fail('FARE_RULES_UNAVAILABLE',503);
    const p=verify(signed,now);
    if(p.sub!==riderId||p.nonce!==request.nonce||p.routeRef!==request.routeRef||p.provenanceRef!==request.provenanceRef||p.routeRevision!==request.routeRevision||
      Object.entries(VANCOUVER_SCOPE).some(([k,v])=>p[k]!==v)||p.currency!=='CAD'||p.tariffFareCents!==request.tariffFareCents||p.policyVersion!==request.policyVersion||typeof p.rulesRef!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(p.rulesRef)||!integer(p.revision))fail('INVALID_FARE_RULES',403);
    return Object.freeze({rulesRef:p.rulesRef,revision:p.revision,minimumFareCents:money(p.minimumFareCents),minimumDriverCentsPerHour:money(p.minimumDriverCentsPerHour),
      minimumAllowanceCentsPerKm:money(p.minimumAllowanceCentsPerKm),taxes:lines(p.taxes),passThrough:lines(p.passThrough),expiresAt:p.exp});
  }});
}
export function driverEstimate(fareCents,passengerMeters,passengerSeconds,pickupMeters,pickupSeconds,rules) {
  money(fareCents);fareAmount(passengerMeters,passengerSeconds);fareAmount(pickupMeters,pickupSeconds);
  const meters=BigInt(passengerMeters)+BigInt(pickupMeters),seconds=BigInt(passengerSeconds)+BigInt(pickupSeconds);
  const allowance=ceiling(BigInt(Math.max(45,money(rules.minimumAllowanceCentsPerKm)))*meters,1000n);
  const guarantee=ceiling(BigInt(Math.max(2500,money(rules.minimumDriverCentsPerHour)))*seconds,3600n);
  const remainder=BigInt(fareCents)>allowance?BigInt(fareCents)-allowance:0n;
  const earnings=ceiling(80n*remainder,100n),owed=allowance+(earnings>guarantee?earnings:guarantee);
  return Object.freeze({allowanceCents:money(allowance),guaranteedEarningsCents:money(guarantee),estimatedEarningsCents:money(earnings),
    requiredSubsidyCents:money(owed>BigInt(fareCents)?owed-BigInt(fareCents):0n)});
}
export function createPickupViabilityAdapter({pickupAuthority,subsidyAuthority,resolvePickup,resolveSubsidy,clock=()=>Math.floor(Date.now()/1000)}) {
  const common=['nonce','tripId','driverId','vehicleId','routeRef','quoteHash','action','passengerMeters','passengerSeconds'];
  const pickupVerify=createAuthorityVerifier(pickupAuthority,{purpose:'liftd_pickup_route',fields:[...common,'pickupMeters','pickupSeconds']});
  const subsidyVerify=createAuthorityVerifier(subsidyAuthority,{purpose:'liftd_driver_subsidy',fields:[...common,'amountCents','fundingRef','reserved','payer']});
  const der=key=>createPublicKey(key).export({type:'spki',format:'der'});
  if(Object.values(pickupAuthority.keys).some(a=>Object.values(subsidyAuthority.keys).some(b=>der(a).equals(der(b)))))fail('SEPARATE_SUBSIDY_AUTHORITY_REQUIRED',503);
  if(typeof resolvePickup!=='function'||typeof resolveSubsidy!=='function')fail('VIABILITY_UNAVAILABLE',503);
  return Object.freeze({async approve(trip,command,quote,rules) {
    const request={nonce:randomBytes(24).toString('base64url'),tripId:trip.id,driverId:command.driverId??trip.driverId,vehicleId:command.vehicleId??trip.vehicleId,routeRef:trip.routeRef,quoteHash:quote.quoteHash,action:command.action,passengerMeters:quote.route.distanceMeters,passengerSeconds:quote.route.durationSeconds};
    let signed;try{signed=await resolvePickup(request);}catch{fail('PICKUP_UNAVAILABLE',503);}
    const p=pickupVerify(signed,clock());
    const bound=proof=>{if(proof.sub!==request.driverId||common.some(k=>proof[k]!==request[k]))fail('VIABILITY_BINDING_MISMATCH',403);};bound(p);
    const estimate=driverEstimate(quote.amounts.transportationCents,quote.route.distanceMeters,quote.route.durationSeconds,p.pickupMeters,p.pickupSeconds,rules);
    let fundingRef=null,expiresAt=Math.min(p.exp,rules.expiresAt),subsidyCents=0;
    if(estimate.requiredSubsidyCents>0) {
      let funded;try{funded=await resolveSubsidy({...request,requiredSubsidyCents:estimate.requiredSubsidyCents});}catch{fail('SUBSIDY_UNAVAILABLE',503);}
      pickupVerify(signed,clock());const s=subsidyVerify(funded,clock());bound(s);
      subsidyCents=money(s.amountCents);if(s.reserved!==true||s.payer!=='liftd-platform'||subsidyCents<estimate.requiredSubsidyCents||typeof s.fundingRef!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(s.fundingRef))fail('PICKUP_NOT_VIABLE',403);
      fundingRef=s.fundingRef;expiresAt=Math.min(expiresAt,s.exp);
    }
    if(!integer(clock())||expiresAt<=clock())fail('VIABILITY_EXPIRED',403);
    return Object.freeze({...estimate,pickupMeters:p.pickupMeters,pickupSeconds:p.pickupSeconds,passengerMeters:quote.route.distanceMeters,passengerSeconds:quote.route.durationSeconds,rulesRef:rules.rulesRef,rulesRevision:rules.revision,subsidyCents,fundingRef,expiresAt,driverId:request.driverId,vehicleId:request.vehicleId,quoteHash:quote.quoteHash});
  }});
}
