import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryTransactionFixture,BudsLedger} from '../src/buds-ledger.js';
import {HighCountryMarket} from '../src/market.js';
import {auditCustody,reservePlacementUnit,releasePlacementUnit} from '../src/custody-records.js';

const inventoryKey=(owner,asset)=>JSON.stringify([owner,asset]);
function setup(){
 const store=new MemoryTransactionFixture();
 const authority={registeredPrincipal:async who=>({seller:'alice',buyer:'bob',other:'charlie'}[who]??Promise.reject(Error('unregistered'))),
  requireAssetIssuer:async who=>{if(who!=='issuer')throw Error('untrusted issuer')},
  verifyAssetReceipt:async r=>r.receiptId==='receipt:invariant',
  requireMarketOpen:async()=>true};
 const market=new HighCountryMarket(store,authority,()=>100);
 const ledger=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>1000});
 return {store,market,ledger};
}
async function init(t){
 await t.market.importAsset('issuer','import',{receiptId:'receipt:invariant',owner:'alice',asset:'bench',quantity:4});
 await t.ledger.earn('earn','bob','reward','earned',100);
}
function invariant(t){
 const s=t.store.state;
 const a=auditCustody(s,{strictAggregate:true});
 assert.equal(a.units,4);
 assert.equal([...s.custodyUnits.values()].filter(u=>u.state!=='exited').length,4);
 const value=[...s.balances.values()].reduce((sum,b)=>sum+b.available+b.reserved,0);
 assert.equal(value,s.issued-s.burned,'BUDS conservation');
 assert.equal([...s.custodyUnits.values()].filter(u=>u.state==='available').length
  +[...s.custodyUnits.values()].filter(u=>u.state==='placed'||u.state==='listed').length,4);
 return a;
}
test('conservation across place, list, buy, cancellation and release',async()=>{
 const t=setup();await init(t);
 const p=await t.store.transact(s=>reservePlacementUnit(s,{owner:'alice',assetId:'bench',instanceId:'installed'}));
 await t.market.list('seller','list','list:1','bench',2,30,1000);
 invariant(t);
 await t.market.buy('buyer','purchase','list:1');
 invariant(t);
 assert.equal(t.store.state.assets.get(inventoryKey('bob','bench')).available,2);
 await t.market.list('seller','list2','list:2','bench',1,20,1000);
 await t.market.cancel('seller','cancel','list:2');
 await t.store.transact(s=>releasePlacementUnit(s,{owner:'alice',assetId:'bench',instanceId:'installed'}));
 assert.equal(invariant(t).reservations,0);
 assert.equal(t.store.state.custodyUnits.get(p.unitId).state,'available');
 assert.equal(t.store.state.balances.get('bob').available,70);
 assert.equal(t.store.state.balances.get('alice').available,30);
});
test('forged aggregate available balance is never accepted as custody',async()=>{
 const t=setup();await init(t);
 t.store.state.assets.get(inventoryKey('alice','bench')).available++;
 assert.throws(()=>invariant(t),/aggregate-divergence/);
 const before=structuredClone(t.store.state);
 await assert.rejects(t.market.list('seller','forged-list','forged','bench',5,30,1000),/verified-units-unavailable/);
 assert.deepEqual(t.store.state,before);
});
test('phantom unrelated inventory fails closed in comprehensive economic audit',async()=>{
 const t=setup();await init(t);invariant(t);
 t.store.state.assets.set(inventoryKey('attacker','bench'),{available:1,reserved:0});
 assert.throws(()=>invariant(t),/aggregate-divergence/);
});
test('orphaned listing binding is identified even with apparently conserved quantities',async()=>{
 const t=setup();await init(t);await t.market.list('seller','list','list:1','bench',2,30,1000);
 invariant(t);
 t.store.state.listings.get('list:1').unitIds.pop();
 assert.throws(()=>invariant(t),/listing-reservation-divergence/);
});
test('double-spend race and replay do not create additional inventory or BUDS',async()=>{
 const t=setup();await init(t);await t.market.list('seller','list','list:1','bench',4,30,1000);
 const results=await Promise.allSettled([t.market.buy('buyer','buy1','list:1'),t.market.buy('other','buy2','list:1')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const after=structuredClone(t.store.state);
 await assert.rejects(t.market.buy('buyer','buy1','list:1'),/replayed operation/);
 assert.deepEqual(t.store.state,after);
 invariant(t);
});
