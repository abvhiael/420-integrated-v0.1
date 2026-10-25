import test from 'node:test';
import assert from 'node:assert/strict';
import {GameplayLicensing,GAME_LICENSE_NAMESPACE,EXTERNAL_LICENSE_NAMESPACE} from '../src/gameplay-licensing.js';
import {LandLeaseAccounts} from '../src/land-lease-accounts.js';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
function setup(){
 const parcel={exists:true,id:11,owner:'owner',occupant:'tenant',occupancyKind:'LEASE',occupancyRef:'lease11',growCapacity:5};
 const lease={id:'lease11',parcelId:11,lessor:'owner',tenant:'tenant',starts:10,ends:100,scopes:1,state:'Active',exitPending:false};
 let now=20,plants=2;
 const identity={registeredPrincipal:async token=>token};
 const canonical={parcel:async()=>({...parcel}),lease:async()=>({...lease}),plantCount:async()=>plants};
 const landRights=new LandLeaseAccounts({store:new MemoryTransactionFixture(),identity,canonical,clock:()=>now});
 const licensing=new GameplayLicensing({landRights,identity,canonical});
 return {parcel,lease,licensing,now:n=>now=n,plants:n=>plants=n};
}
const check=(s,p,c,n)=>s.licensing.evaluate(p,{parcelId:11,capability:c,namespace:n});
test('active canonical lease permits game cultivation but never external rights',async()=>{
 const s=setup();
 assert.equal((await check(s,'tenant','cultivate')).allowed,true);
 assert.equal((await check(s,'owner','cultivate')).allowed,false);
 const external=await check(s,'owner','real-property',EXTERNAL_LICENSE_NAMESPACE);
 assert.equal(external.allowed,false);assert.equal(external.externalLicenceVerified,false);
 assert.equal((await check(s,'tenant','commercial-brand',EXTERNAL_LICENSE_NAMESPACE)).allowed,false);
});
test('no arbitrary scope, namespace or external right may be smuggled into game permissions',async()=>{
 const s=setup();
 for(const capability of ['commercial-brand','ecosystem-app','copyright','constructor','__proto__'])
  await assert.rejects(check(s,'tenant',capability,GAME_LICENSE_NAMESPACE),/unsupported game capability/);
 await assert.rejects(check(s,'tenant','cultivate','external.unverified'),/unsupported licensing namespace/);
 await assert.rejects(check(s,'tenant','cultivate','other-game'),/unsupported licensing namespace/);
 await assert.rejects(check(s,'outsider','cultivate'),/not available/);
});
test('expiry, revoked or disputed lease and ownership change prevent fresh cultivation',async()=>{
 const s=setup();s.now(100);
 assert.equal((await check(s,'tenant','cultivate')).allowed,false);
 assert.equal((await check(s,'tenant','terminate-plants')).allowed,true);
 s.now(20);s.lease.state='Revoked';
 assert.equal((await check(s,'tenant','cultivate')).allowed,false);
 s.lease.state='Disputed';
 assert.equal((await check(s,'tenant','cultivate')).allowed,false);
 s.lease.state='Active';s.parcel.owner='successor';
 assert.equal((await check(s,'tenant','cultivate')).allowed,false);
 assert.equal((await check(s,'tenant','terminate-plants')).allowed,true);
});
test('owner-only occupancy delegation requires cleared occupancy and zero plants',async()=>{
 const s=setup();
 assert.equal((await check(s,'owner','assign-occupancy')).allowed,false);
 s.plants(0);s.parcel.occupancyKind='NONE';s.parcel.occupant=null;
 assert.equal((await check(s,'owner','assign-occupancy')).allowed,true);
 await assert.rejects(check(s,'tenant','assign-occupancy'),/not available/);
});
test('misconfigured canonical state fails closed and does not create value',async()=>{
 const s=setup();
 s.parcel.id=12;
 await assert.rejects(check(s,'tenant','cultivate'),/unknown parcel|canonical rights changed/);
 await assert.rejects(s.licensing.evaluate('owner',{parcelId:0,capability:'cultivate'}),/invalid licensing request/);
});
