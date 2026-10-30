import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryPlacementAuthorityRegistry} from '../src/placement-authority-registry.js';
function setup(){
 let state={placementAuthorityRevisions:new Map(),placementAuthorityEventIds:new Map()};
 let tail=Promise.resolve();
 const store={transact(fn){const job=tail.then(()=>{const next=structuredClone(state),value=fn(next);state=next;return value});tail=job.then(()=>{},()=>{});return job}};
 const authority={requireWorldAuthorityOperator:async actor=>{if(actor!=='operator')throw Error('operator-denied')},verifyWorldEvidence:async e=>e.signed===true,verifyOperatorAtCommit:({session})=>session==='operator'};
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

test('03-C independently signed event sequence, replay and privilege revocation',async()=>{
 const s=setup();s.registry.authority.verifyWorldAuthorityEvent=async event=>event.signature==='valid';
 const event=(revision,action)=>({parcelId:'parcel',revision,action,eventId:'event-'+revision,evidenceId:'world-'+revision,geometryQualificationId:'geometry',signature:'valid'});
 await assert.rejects(s.registry.synchronize({...event(1,'grant'),signature:'forged'}),/unverified-authority-event/);
 await s.registry.synchronize(event(1,'grant'));
 await assert.rejects(s.registry.synchronize(event(1,'grant')),/authority-event-replayed/);
 await assert.rejects(s.registry.synchronize(event(3,'revoke')),/authority-event-order/);
 await s.registry.synchronize(event(2,'revoke'));
 assert.equal(s.get().placementAuthorityRevisions.get('parcel').revoked,true);
 await s.registry.synchronize(event(3,'grant'));
 assert.equal(s.get().placementAuthorityRevisions.get('parcel').revoked,false);
});

test('global event IDs cannot be reused across parcels or newer revisions',async()=>{
 const s=setup();s.registry.authority.verifyWorldAuthorityEvent=async e=>e.signature==='valid';
 const ev=(parcelId,revision)=>({parcelId,revision,action:'grant',eventId:'same-signed-event',evidenceId:'evidence',geometryQualificationId:'geometry',signature:'valid'});
 await s.registry.synchronize(ev('parcel',1));
 await assert.rejects(s.registry.synchronize(ev('other',1)),/authority-event-replayed/);
 await assert.rejects(s.registry.synchronize(ev('parcel',2)),/authority-event-replayed/);
 assert.equal(s.get().placementAuthorityEventIds.size,1);assert.equal(s.get().placementAuthorityRevisions.has('other'),false);
});
test('revoked operator during transaction cannot provision or revoke',async()=>{
 const s=setup();s.registry.authority.verifyOperatorAtCommit=()=>false;
 await assert.rejects(s.registry.provision('operator','parcel',evidence(1)),/operator-revoked-at-commit/);
 assert.equal(s.get().placementAuthorityRevisions.size,0);
 s.registry.authority.verifyOperatorAtCommit=()=>true;await s.registry.provision('operator','parcel',evidence(1));
 s.registry.authority.verifyOperatorAtCommit=()=>false;
 await assert.rejects(s.registry.revoke('operator','parcel',1),/operator-revoked-at-commit/);
 assert.equal(s.get().placementAuthorityRevisions.get('parcel').revoked,false);
});
