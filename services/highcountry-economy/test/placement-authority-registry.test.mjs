import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryPlacementAuthorityRegistry} from '../src/placement-authority-registry.js';
function setup(){
 let state={placementAuthorityRevisions:new Map()};
 let tail=Promise.resolve();
 const store={transact(fn){const job=tail.then(()=>{const next=structuredClone(state),value=fn(next);state=next;return value});tail=job.then(()=>{},()=>{});return job}};
 const authority={requireWorldAuthorityOperator:async actor=>{if(actor!=='operator')throw Error('operator-denied')},verifyWorldEvidence:async e=>e.signed===true};
 return {registry:new HighCountryPlacementAuthorityRegistry({store,authority}),get:()=>state};
}
const evidence=(revision)=>({parcelId:'parcel',revision,evidenceId:'world-'+revision,geometryQualificationId:'geometry',signed:true});
test('03-C signed operator provision, monotonic update and revocation persist',async()=>{
 const s=setup();await s.registry.provision('operator','parcel',evidence(1));
 await assert.rejects(s.registry.provision('guest','parcel',evidence(2),1),/operator-denied/);
 await assert.rejects(s.registry.provision('operator','parcel',{...evidence(2),signed:false},1),/unverified-world-evidence/);
 await assert.rejects(s.registry.provision('operator','parcel',evidence(2),0),/stale-authority-revision/);
 await s.registry.revoke('operator','parcel',1);
 assert.equal(s.get().placementAuthorityRevisions.get('parcel').revoked,true);
 await assert.rejects(s.registry.revoke('operator','parcel',1),/stale-or-revoked-authority/);
 await s.registry.provision('operator','parcel',evidence(3),2);
 assert.equal(s.get().placementAuthorityRevisions.get('parcel').revoked,false);
});
test('03-C concurrent provisioning admits one winner and never rewinds revision',async()=>{
 const s=setup();await s.registry.provision('operator','parcel',evidence(1));
 const outcomes=await Promise.allSettled([s.registry.provision('operator','parcel',evidence(2),1),s.registry.provision('operator','parcel',{...evidence(2),evidenceId:'other'},1)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(s.get().placementAuthorityRevisions.get('parcel').revision,2);
});
