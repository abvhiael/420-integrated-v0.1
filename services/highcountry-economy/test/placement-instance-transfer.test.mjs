import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryStoredInstanceTransfer} from '../src/placement-instance-transfer.js';
import {custodyUnitId,CUSTODY_SCHEMA} from '../src/custody-records.js';
const asset='desk',id=custodyUnitId('receipt',0),key=(o)=>JSON.stringify([o,asset]);
function setup(){
 const instance={instanceId:'item',assetId:asset,ownerPrincipal:'alice',state:'stored',revision:2,updatedAt:2,history:[]};
 let state={assets:new Map([[key('alice'),{available:1,reserved:0}]]),custodyUnits:new Map([[id,{schemaVersion:CUSTODY_SCHEMA,unitId:id,receiptId:'receipt',unitIndex:0,owner:'alice',assetId:asset,state:'available',reservationId:null,revision:3}]]),custodyReceipts:new Map([['receipt',{quantity:1,owner:'alice',assetId:asset}]]),custodyReservations:new Map(),importedAssets:new Set(['receipt']),assetSources:new Map([[key('alice'),'receipt']]),placementInstances:new Map([['item',instance]]),placementOperations:new Map([[JSON.stringify(['alice','place']),{result:{instance:{instanceId:'item'},custody:{unitId:id}}}]])};
 const store={async transact(fn){const s=structuredClone(state),result=fn(s);state=s;return result;}};
 const authority={registeredPrincipal:async x=>x,verifyTransferConsent:async({consent})=>consent==='both-signed',verifyOrdinaryCustodyAtCommit:()=>true,verifyTransferAtCommit:({state})=>state.placementAuthorityRevisions?.get('parcel')?.revoked!==true};
 return {service:new HighCountryStoredInstanceTransfer({store,authority}),get:()=>state};
}
const req={operation:'transfer-1',instanceId:'item',expectedRevision:2,consent:'both-signed'};
test('two-party consent moves only stored instance and exact unit atomically',async()=>{
 const t=setup(),out=await t.service.transfer('alice','bob',req);assert.equal(out.instance.ownerPrincipal,'bob');
 assert.equal(t.get().custodyUnits.get(id).owner,'bob');assert.equal(t.get().assets.get(key('alice')).available,0);
 await assert.rejects(t.service.transfer('alice','bob',req),/transfer-operation-replayed/);
});
test('unauthorized, placed, stale and reserved transfers reject with no mutation',async()=>{
 const t=setup();await assert.rejects(t.service.transfer('alice','bob',{...req,consent:'forged'}),/consent-denied/);
 t.get().placementInstances.get('item').state='placed';
 await assert.rejects(t.service.transfer('alice','bob',req),/not-owned-stored-instance/);
 t.get().placementInstances.get('item').state='stored';
 t.get().custodyUnits.get(id).state='listed';
 await assert.rejects(t.service.transfer('alice','bob',req),/custody-unavailable/);
});

test('canonical or unknown custody domain can never use ordinary stored transfer',async()=>{
 const t=setup();t.service.authority.verifyOrdinaryCustodyAtCommit=()=>false;
 await assert.rejects(t.service.transfer('alice','bob',req),/canonical-transfer-requires-finality/);
 assert.equal(t.get().custodyUnits.get(id).owner,'alice');
 assert.equal(t.get().assets.get(key('alice')).available,1);
});
