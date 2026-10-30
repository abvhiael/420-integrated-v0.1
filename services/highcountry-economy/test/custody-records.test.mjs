import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryCustodyRegistry,custodyUnitId,auditCustody} from '../src/custody-records.js';
const receipt=(id='source-1',quantity=2)=>({receiptId:id,owner:'alice',asset:'canonical-chair',quantity});
function fixture(){
 let current={custodyUnits:new Map(),custodyReceipts:new Map(),custodyReservations:new Map(),assets:new Map(),assetSources:new Map(),importedAssets:new Set()};
 const store={async transact(fn){const s=structuredClone(current);const result=fn(s);if(result?.then)throw Error('async callback');current=s;return result;}};
 const authority={requireAssetIssuer:async session=>{if(session!=='issuer')throw Error('untrusted issuer')},verifyAssetReceipt:async x=>x.receiptId!=='forged',registeredPrincipal:async session=>session};
 return {registry:new HighCountryCustodyRegistry(store,authority),state:()=>current,mutate:f=>f(current)};
}
test('deterministic unique IDs across restarts and indices',()=>{assert.equal(custodyUnitId('issue',0),custodyUnitId('issue',0));assert.notEqual(custodyUnitId('issue',0),custodyUnitId('issue',1));assert.notEqual(custodyUnitId('issue',0),custodyUnitId('other',0));});
test('verified quantity is broken into exclusive immutable-source units',async()=>{const f=fixture();const out=await f.registry.admit('issuer',receipt());assert.equal(out.unitIds.length,2);assert.equal(f.state().custodyUnits.size,2);assert.deepEqual(f.state().assets.get(JSON.stringify(['alice','canonical-chair'])),{available:2,reserved:0});assert.equal(auditCustody(f.state(),{strictAggregate:true}).units,2);});
test('duplicate receipt fails with no inflation',async()=>{const f=fixture();await f.registry.admit('issuer',receipt());await assert.rejects(f.registry.admit('issuer',receipt()),/duplicate-receipt/);assert.equal(f.state().assets.values().next().value.available,2);});
test('forgery and non-issuer both fail without writes',async()=>{const f=fixture();await assert.rejects(f.registry.admit('issuer',receipt('forged')),/unverified-receipt/);await assert.rejects(f.registry.admit('stranger',receipt()),/untrusted issuer/);assert.equal(f.state().custodyUnits.size,0);});
test('partial or corrupt unit inventory fails audit',async()=>{const f=fixture();await f.registry.admit('issuer',receipt());f.state().custodyUnits.delete(custodyUnitId('source-1',1));assert.throws(()=>auditCustody(f.state()),/missing-unit/);});
test('orphan or duplicated exclusive reservation fails audit',async()=>{const f=fixture();await f.registry.admit('issuer',receipt());f.state().custodyReservations.set('ghost',{reservationId:'same'});assert.throws(()=>auditCustody(f.state()),/orphan-reservation/);});
test('aggregate divergence identified explicitly',async()=>{const f=fixture();await f.registry.admit('issuer',receipt());f.state().assets.get(JSON.stringify(['alice','canonical-chair'])).available=99;assert.throws(()=>auditCustody(f.state(),{strictAggregate:true}),/aggregate-divergence/);});
test('no automatic promotion of legacy unverified balances',async()=>{const f=fixture();f.state().assets.set(JSON.stringify(['alice','canonical-chair']),{available:5,reserved:0});await f.registry.admit('issuer',receipt());assert.equal(f.state().custodyUnits.size,2);assert.throws(()=>auditCustody(f.state(),{strictAggregate:true}),/aggregate-divergence/);});
test('owner reads are principal-scoped',async()=>{const f=fixture();await f.registry.admit('issuer',receipt());assert.equal((await f.registry.readOwned('alice','alice')).length,2);await assert.rejects(f.registry.readOwned('mallory','alice'),/unauthorized-read/);});
test('reject malicious/oversized quantities',async()=>{const f=fixture();for(const n of [-1,0,0.5,10001])await assert.rejects(f.registry.admit('issuer',receipt('oversize',n)),/malformed-receipt/);assert.equal(f.state().custodyUnits.size,0);});
