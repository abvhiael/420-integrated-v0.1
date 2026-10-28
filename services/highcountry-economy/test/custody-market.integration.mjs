import test from 'node:test';
import assert from 'node:assert/strict';
import {HighCountryMarket} from '../src/market.js';
import {CanonicalMarketSettlement} from '../src/canonical-settlement.js';
import {MemoryTransactionFixture,BudsLedger} from '../src/buds-ledger.js';
import {auditCustody,settleListedUnits} from '../src/custody-records.js';
const key=(owner,asset='desk')=>JSON.stringify([owner,asset]);
function setup(){
 const store=new MemoryTransactionFixture(),state={finalized:false,cancelled:false};
 const authority={
  registeredPrincipal:async s=>({seller:'alice',buyer:'bob',other:'charlie'}[s]??Promise.reject(Error('unauthorized'))),
  requireAssetIssuer:async s=>{if(s!=='issuer')throw Error('invalid issuer')},
  verifyAssetReceipt:async r=>r.receiptId==='verified:desk',
  expectedTransferOperation:async()=> 'transfer:desk',
  confirmedReservedTransfer:async()=>state.finalized?{finalized:true,operationId:'transfer:desk',sourceReceiptId:'verified:desk',asset:'desk',from:'alice',to:'bob',quantity:2}:null,
  proveUnexecutedAndCancelled:async()=>state.cancelled,
  confirmedListingClosure:async()=>state.cancelled
 };
 const market=new HighCountryMarket(store,authority,()=>100);
 const canonical=new CanonicalMarketSettlement(store,authority,()=>100);
 const buds=new BudsLedger(store,{authorize:()=>true,sourceLimit:()=>1000});
 return {store,state,market,canonical,buds,authority};
}
async function imported(t){await t.market.importAsset('issuer','import',{receiptId:'verified:desk',owner:'alice',asset:'desk',quantity:3});}
test('market custody quantities conserved from issuance through purchase and resale',async()=>{
 const t=setup();await imported(t);
 await t.buds.earn('fund-bob','bob','reward','proof',100);
 await t.market.list('seller','list-1','listing-1','desk',2,30,999);
 const ids=t.store.state.listings.get('listing-1').unitIds;
 assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
 assert.equal(auditCustody(t.store.state,{strictAggregate:true}).reservations,2);
 await t.market.buy('buyer','buy-1','listing-1');
 assert.deepEqual(ids.map(id=>t.store.state.custodyUnits.get(id).owner),['bob','bob']);
 assert.equal(auditCustody(t.store.state,{strictAggregate:true}).reservations,0);
 await t.market.list('buyer','resale','listing-2','desk',2,40,999);
 await t.buds.earn('fund-charlie','charlie','reward','proof-2',100);
 await t.market.buy('other','resale-buy','listing-2');
 assert.equal(auditCustody(t.store.state,{strictAggregate:true}).units,3);
 assert.deepEqual(ids.map(id=>t.store.state.custodyUnits.get(id).owner),['charlie','charlie']);
});
test('double list, attempted purchase of placed/escrowed unit and cancel race fail closed',async()=>{
 const t=setup();await imported(t);
 await t.market.list('seller','list-1','listing-1','desk',2,30,999);
 await assert.rejects(t.market.list('seller','other-list','listing-2','desk',2,30,999));
 const winners=await Promise.allSettled([t.market.cancel('seller','cancel','listing-1'),t.market.expire('expire','listing-1')]);
 assert.equal(winners.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(auditCustody(t.store.state,{strictAggregate:true}).reservations,0);
});
test('tampered listing unit binding rejects purchase and preserves balances',async()=>{
 const t=setup();await imported(t);await t.buds.earn('fund','bob','reward','proof',100);
 await t.market.list('seller','list-1','listing-1','desk',2,30,999);
 t.store.state.listings.get('listing-1').unitIds[1]=t.store.state.listings.get('listing-1').unitIds[0];
 await assert.rejects(t.market.buy('buyer','buy','listing-1'),/duplicate-listing-unit/);
 assert.equal(t.store.state.balances.get('bob').available,100);
});
test('canonical finalized transfer exits escrow custody and never double mints buyer units',async()=>{
 const t=setup();await imported(t);await t.buds.earn('fund','bob','reward','proof',100);
 await t.market.list('seller','list','listing','desk',2,30,999);
 t.authority.canonicalSettlementRequired=true;
 await t.canonical.prepare('buyer','prepare','listing','transfer:desk');
 await assert.rejects(t.canonical.finalize('premature','transfer:desk'));
 t.state.finalized=true;
 await t.canonical.finalize('finalize','transfer:desk');
 assert.equal(auditCustody(t.store.state).reservations,0);
 assert.equal([...t.store.state.custodyUnits.values()].filter(x=>x.state==='exited').length,2);
 assert.equal(t.store.state.assets.get(key('alice')).reserved,0);
 assert.equal(t.store.state.assets.has(key('bob')),false);
 await assert.rejects(t.canonical.finalize('replay','transfer:desk'));
});
test('canonical unfinalized abort requires independent cancellation and exits escrow only once',async()=>{
 const t=setup();await imported(t);await t.buds.earn('fund','bob','reward','proof',100);
 await t.market.list('seller','list','listing','desk',2,30,999);
 t.authority.canonicalSettlementRequired=true;
 await t.canonical.prepare('buyer','prepare','listing','transfer:desk');
 await assert.rejects(t.canonical.abort('premature','transfer:desk'));
 t.state.cancelled=true;
 await t.canonical.abort('abort','transfer:desk');
 assert.equal([...t.store.state.custodyUnits.values()].filter(x=>x.state==='exited').length,2);
 assert.equal(t.store.state.balances.get('bob').available,100);
 await assert.rejects(t.canonical.abort('again','transfer:desk'));
});
