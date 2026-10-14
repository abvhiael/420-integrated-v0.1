import test from 'node:test';import assert from 'node:assert/strict';
import {createDriverOnboardingReviewService} from '../src/driver-onboarding-review.mjs';
function fixture(){
 const records=new Map([['driver_a',{driverId:'driver_a',accountId:'account_a',vehicleId:'vehicle_a',revision:1,status:'REVIEW_REQUIRED',documents:[{kind:'licence',privateRef:'vault_a',expiresAt:3000}],remediation:[]}]]);
 let writes=0;let proof={driverId:'driver_a',vehicleId:'vehicle_a',revision:1,status:'REMEDIATION_REQUIRED',remediation:['document_invalid'],authorityRef:'independent_transport',expiresAt:3000};
 const svc=createDriverOnboardingReviewService({
  clock:()=>1000,
  authenticator:{authorize:async(token,{action,resource})=>{
   if(token!=='operator'||action!=='onboarding.review'||resource!=='account:driver_a')throw Error('denied');
   return {role:'operator',subject:'operator_a',accountId:'operator_account',expiresAt:3000};
  }},
  store:{read:async id=>records.get(id),writeCAS:async(id,rev,key,row)=>{
   if(records.get(id)?.revision!==rev)return false;
   records.set(id,row);writes++;return true;
  }},
  verifyIndependentDecision:async(attestation)=>attestation==='verified'?proof:null
 });
 return{svc,records,get writes(){return writes;},setProof:x=>{proof=x}};
}
test('verified independent reviewer may require remediation; private documents stay internal',async()=>{
 const f=fixture();
 const done=await f.svc.decide('operator',{driverId:'driver_a',commandId:'review_a',expectedRevision:1,attestation:'verified'});
 assert.equal(done.status,'REMEDIATION_REQUIRED');assert.deepEqual(done.remediation,['document_invalid']);
 assert.equal(f.writes,1);assert.equal(JSON.stringify(done).includes('vault_a'),false);
});
test('unauthorized driver, mismatched revision or forged review cannot set APPROVED',async()=>{
 const f=fixture();
 await assert.rejects(f.svc.decide('driver',{driverId:'driver_a',commandId:'c',expectedRevision:1,attestation:'verified'}));
 await assert.rejects(f.svc.decide('operator',{driverId:'driver_a',commandId:'c',expectedRevision:1,attestation:'forged'}),e=>e.code==='INVALID_REVIEW_PROOF');
 f.setProof({driverId:'driver_a',vehicleId:'other',revision:1,status:'APPROVED',remediation:[],authorityRef:'authority',expiresAt:3000});
 await assert.rejects(f.svc.decide('operator',{driverId:'driver_a',commandId:'c',expectedRevision:1,attestation:'verified'}),e=>e.code==='INVALID_REVIEW_PROOF');
 f.setProof({driverId:'driver_a',vehicleId:'vehicle_a',revision:1,status:'APPROVED',remediation:['document_invalid'],authorityRef:'authority',expiresAt:3000});
 await assert.rejects(f.svc.decide('operator',{driverId:'driver_a',commandId:'c',expectedRevision:1,attestation:'verified'}),e=>e.code==='INVALID_REVIEW_PROOF');
 assert.equal(f.writes,0);
});
