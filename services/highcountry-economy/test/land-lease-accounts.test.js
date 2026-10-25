import test from 'node:test';
import assert from 'node:assert/strict';
import {LandLeaseAccounts} from '../src/land-lease-accounts.js';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
function setup(){
 const store=new MemoryTransactionFixture(),parcel={exists:true,id:8,owner:'owner',occupant:'tenant',occupancyKind:'LEASE',occupancyRef:'lease8',growCapacity:8};
 const lease={id:'lease8',parcelId:8,lessor:'owner',tenant:'tenant',starts:100,ends:400,scopes:1,state:'Active',exitPending:false};
 let active=2,valid=true,time=200;
 const identity={registeredPrincipal:async token=>token};
 const canonical={parcel:async()=>({...parcel}),lease:async()=>({...lease}),plantCount:async()=>active,
  rentReceipt:async()=>valid};
 const service=new LandLeaseAccounts({store,identity,canonical,clock:()=>time});
 return {store,parcel,lease,service,setActive:n=>active=n,setVerified:v=>valid=v,setTime:v=>time=v};
}
test('tenant cultivation only under actual owner and occupancy tuple',async()=>{
 const f=setup();
 assert.equal((await f.service.rights('tenant',8)).canCultivate,true);
 f.parcel.owner='newowner';
 assert.equal((await f.service.rights('tenant',8)).canCultivate,false);
 f.parcel.owner='owner';f.lease.state='Revoked';
 const r=await f.service.rights('tenant',8);
 assert.equal(r.canCultivate,false);assert.equal(r.canTerminatePlants,true);
 assert.equal(r.canReassign,false);assert.equal(r.exitPending,true);
 await assert.rejects(f.service.rights('outsider',8),/not available/);
});
test('expiration prevents new cultivation without orphaning plants',async()=>{
 const f=setup();f.setTime(400);
 const r=await f.service.rights('tenant',8);
 assert.equal(r.canCultivate,false);assert.equal(r.canTerminatePlants,true);
 f.setActive(0);assert.equal((await f.service.rights('owner',8)).exitPending,false);
 f.parcel.occupancyKind='NONE';f.parcel.occupant=null;
 assert.equal((await f.service.rights('owner',8)).canReassign,true);
});
test('rent receipts require independently verified settlement, exactly once and durable audit',async()=>{
 const f=setup();const input={operation:'op1',parcelId:8,leaseId:'lease8',period:'month1',amount:42,sourceReceipt:'receipt1'};
 f.setVerified(false);await assert.rejects(f.service.recordRent('owner',input),/independently/);
 assert.equal(f.store.state.landRentEvents.size,0);
 f.setVerified(true);const recorded=await f.service.recordRent('owner',input);
 assert.equal(recorded.amount,42);
 assert.equal((await f.service.rentHistory('tenant','lease8')).length,1);
 await assert.rejects(f.service.recordRent('owner',{...input,operation:'op2'}),/replayed/);
 await assert.rejects(f.service.recordRent('owner',{...input,operation:'op3',sourceReceipt:'receipt2'}),/already recorded/);
 await assert.rejects(f.service.recordRent('tenant',{...input,operation:'op4',sourceReceipt:'receipt4'}),/unauthorized/);
 assert.equal(f.store.state.landRentAudit.get('lease8').length,1);
 assert.equal(f.store.state.issued,0);assert.equal(f.store.state.burned,0);
});
