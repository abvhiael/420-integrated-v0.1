import test from 'node:test';
import assert from 'node:assert/strict';
import {createLaunchGateService} from '../src/launch-gate-service.mjs';
import {jurisdictionGates} from '../src/jurisdiction-acceptance.mjs';
const req={operatorRef:'op_1',driverId:'d_1',vehicleId:'v_1',routeScopeRef:'vancouver',deploymentDigest:'a'.repeat(64)};
const receipts=[];
const issuers=Object.fromEntries(jurisdictionGates.map(g=>[g,{
 resolve:async()=>({gate:g,evidenceDigest:'b'.repeat(64)}),
 checkRevocation:async()=>({revoked:false,current:true,evidenceDigest:'b'.repeat(64)})
}]));
const create=(opts={})=>createLaunchGateService({issuers,authorities:{},verifyJurisdiction:()=>({technicallyVerified:true,productionAuthorized:false}),audit:{append:async x=>receipts.push(x)},clock:()=>100,...opts});
test('checks five independent issuers and writes mandatory receipt, never production approval',async()=>{
 const result=await create().verify({request:req,operatorCredential:'credential'});
 assert.deepEqual(result,{technicallyVerified:true,productionAuthorized:false,gates:5});
 assert.equal(receipts.at(-1).gates.length,5);
});
test('fails closed on missing issuer or operator credential',async()=>{
 assert.throws(()=>create({issuers:{...issuers,insurance:undefined}}),e=>e.code==='LAUNCH_GATE_CONFIGURATION_INVALID');
 await assert.rejects(()=>create().verify({request:req,operatorCredential:''}),e=>e.code==='LAUNCH_GATE_ACCESS_DENIED');
});
test('fails shut for each independently unreachable issuer',async()=>{
 for(const gate of jurisdictionGates){
  const bad={...issuers,[gate]:{...issuers[gate],resolve:async()=>{throw Error('offline')}}};
  await assert.rejects(()=>create({issuers:bad}).verify({request:req,operatorCredential:'key'}),e=>e.code==='LAUNCH_GATE_PROVIDER_UNAVAILABLE');
 }
});
test('reject revoked, stale or mismatched evidence independently for each gate',async()=>{
 for(const gate of jurisdictionGates){
  const bad={...issuers,[gate]:{...issuers[gate],checkRevocation:async()=>({revoked:true,current:false,evidenceDigest:'x'})}};
  await assert.rejects(()=>create({issuers:bad}).verify({request:req,operatorCredential:'key'}),e=>e.code==='LAUNCH_GATE_REVOKED_OR_STALE');
 }
});
test('audit outage or false verifier proof cannot be admitted',async()=>{
 await assert.rejects(()=>create({audit:{append:async()=>{throw Error('offline')}}}).verify({request:req,operatorCredential:'key'}));
 await assert.rejects(()=>create({verifyJurisdiction:()=>({technicallyVerified:true,productionAuthorized:true})}).verify({request:req,operatorCredential:'key'}),e=>e.code==='LAUNCH_GATE_VERIFIER_INVALID');
});
