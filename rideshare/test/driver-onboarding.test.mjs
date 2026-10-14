import test from 'node:test';import assert from 'node:assert/strict';
import {createDriverOnboardingService,validateOnboarding} from '../src/driver-onboarding.mjs';
const now=2000;const input={driverId:'driver_a',vehicleId:'vehicle_a',commandId:'cmd_a',expectedRevision:0,documents:[{kind:'licence',privateRef:'private_secret_ref',expiresAt:3000}]};
function fixture(){
 const data=new Map(),commands=new Set();let mutations=0;
 const service=createDriverOnboardingService({clock:()=>now,authenticator:{authorize:async(t,{action,resource})=>{
  if(t!=='good'||action!=='onboarding.manage'||resource!=='account:driver_a')throw Error('unauthorized');
  return {role:'driver',subject:'driver_a',accountId:'account_a',expiresAt:3000};
 }},store:{read:async id=>data.get(id),writeCAS:async(id,rev,key,row)=>{
  if(commands.has(key)||(data.get(id)?.revision??0)!==rev)return false;
  data.set(id,row);commands.add(key);mutations++;return true;
 }}});
 return {service,data,get mutations(){return mutations;}};
}
test('submissions require bound signed session; private references cannot appear in reads',async()=>{
 const f=fixture();
 await assert.rejects(f.service.submit('bad',input));
 const r=await f.service.submit('good',input);assert.equal(r.status,'REVIEW_REQUIRED');
 const status=await f.service.read('good','driver_a');assert.equal(status.documents[0].kind,'licence');
 assert.equal(JSON.stringify(status).includes('private_secret_ref'),false);
 await assert.rejects(f.service.submit('good',input),e=>e.code==='STALE_OR_DUPLICATE');
 assert.equal(f.mutations,1);
});
test('expired, unknown, accessor-backed or duplicated documents rejected',()=>{
 for(const documents of [[{kind:'licence',privateRef:'p',expiresAt:1}],[{kind:'other',privateRef:'p',expiresAt:3000}],[
 {kind:'licence',privateRef:'p',expiresAt:3000},{kind:'licence',privateRef:'q',expiresAt:3000}]])
 assert.throws(()=>validateOnboarding({...input,documents:documents.map(d=>({...d}))}));
 assert.throws(()=>validateOnboarding({...input,documents:[Object.defineProperty({},'kind',{get(){throw Error('getter')},enumerable:true})]}));
});
test('approval remains external: driver submissions cannot self-approve or revoke',async()=>{
 const f=fixture();f.data.set('driver_a',{status:'APPROVED',revision:1,documents:[],vehicleId:'vehicle_a'});
 await assert.rejects(f.service.submit('good',{...input,expectedRevision:1}),e=>e.code==='EXTERNAL_REVIEW_REQUIRED');
 await assert.rejects(f.service.submit('good',{...input,status:'APPROVED'}));
});
