import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {PostgresBudsStore} from '../src/postgres-store.js';
import {HighCountryPlacementTransactions} from '../src/placement-transactions.js';
import {HighCountryMarket} from '../src/market.js';
import {BudsLedger} from '../src/buds-ledger.js';
import {auditCustody} from '../src/custody-records.js';
import {CONTRACT_VERSION} from '../src/placement-contract.js';

const url=process.env.HC_PLACE_TEST_DATABASE_URL;
if(!url)throw Error('dedicated HC_PLACE_TEST_DATABASE_URL required');
const pool=new pg.Pool({connectionString:url,max:10});
const asset='hc-prop-premium-emerald-writing-desk';
const geometry={schemaVersion:CONTRACT_VERSION,assetId:asset,geometryId:'b5-geometry',geometryVersion:1,surface:'floor',layer:'furniture',visualPx:{width:128,height:64},renderAnchorPx:{x:0,y:0},occupancy:{kind:'rectangle',width:2,height:1},allowedOrientations:[0,90,180,270],qualified:true,qualificationRef:'b5-qualified'};
const blank=()=>({schema:1,balances:[],operations:[],claims:[],sourceIssued:[],assets:[],assetSources:[],listings:[],transferIntents:[],settlementJobs:[],importedAssets:[],issued:0,burned:0,placementInstances:[],placementOperations:[],placementScenes:[],placementAuthorityRevisions:[['parcel',{revision:1,evidenceId:'b5-world',geometryQualificationId:'b5-qualified'}]],custodyUnits:[],custodyReceipts:[],custodyReservations:[]});
const record=(instanceId,x=0)=>({schemaVersion:CONTRACT_VERSION,instanceId,assetId:asset,ownerPrincipal:'alice',parcelId:'parcel',buildingId:null,roomId:null,regionId:'emerald-coast',surface:'floor',layer:'furniture',gridX:x,gridY:0,orientation:0,renderAnchor:{x:0,y:0},geometryId:'b5-geometry',geometryVersion:1,parentInstanceId:null,slotId:null,revision:1,createdAt:1,updatedAt:1,history:[],state:'placed',validationVersion:1});
const place=(instanceId,operation,scene=0,x=0)=>({operation,action:'place',instanceId,assetId:asset,expectedRevision:0,expectedSceneRevision:scene,record:record(instanceId,x)});
const remove=(instanceId,operation,scene)=>({operation,action:'remove',instanceId,assetId:asset,expectedRevision:1,expectedSceneRevision:scene});
const placementAuthority={registeredPrincipal:async s=>s,canPlaceOnParcel:async s=>s==='alice',validateWorld:async()=>({qualified:true,evidenceId:'b5-world',revision:1,geometryQualificationId:'b5-qualified'}),qualifiedGeometrySnapshot:async()=>new Map([[asset,geometry]]),verifyAtCommit:({principal,authoritative})=>principal==='alice'&&authoritative.revision===1&&authoritative.evidenceId==='b5-world'};
const marketAuthority={registeredPrincipal:async s=>s,requireAssetIssuer:async s=>{if(s!=='issuer')throw Error('unauthorized issuer')},verifyAssetReceipt:async r=>r.receiptId==='b5-receipt'};
const ns='hc-place-b5-'+process.pid;
const store=()=>new PostgresBudsStore(pool,ns);
const engine=()=>new HighCountryPlacementTransactions({store:store(),authority:placementAuthority,resolveGeometry:async()=>geometry,resolveAssets:async()=>new Set([asset]),clock:()=>10});
const market=()=>new HighCountryMarket(store(),marketAuthority,()=>100);
const ledger=()=>new BudsLedger(store(),{authorize:()=>true,sourceLimit:()=>1000});
async function reset(){await pool.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb) ON CONFLICT(namespace) DO UPDATE SET state=excluded.state',[ns,JSON.stringify(blank())]);await market().importAsset('issuer','import',{receiptId:'b5-receipt',owner:'alice',asset,quantity:3});await ledger().earn('fund','bob','source','funding-proof',100);}
async function snapshot(){return store().transact(s=>({placements:[...s.placementInstances],operations:[...s.placementOperations],units:[...s.custodyUnits],listings:[...s.listings],assets:[...s.assets],balances:[...s.balances],issued:s.issued,burned:s.burned,audit:auditCustody(s,{strictAggregate:true})}));}
function conserved(s){assert.equal(s.units.length,3);assert.equal(s.issued-s.burned,s.balances.reduce((v,[,b])=>v+b.available+b.reserved,0));assert.equal(s.audit.reservations,s.units.filter(([,u])=>u.state==='listed'||u.state==='placed').length);}
test('real PostgreSQL: placement and market race for same last units cannot double allocate',async()=>{
 await reset();
 const e=engine(),m=market();
 const pair=await Promise.allSettled([e.execute('alice',place('desk-a','place-a')),m.list('alice','market-list','listing',''+asset,3,20,1000)]);
 assert.equal(pair.filter(x=>x.status==='fulfilled').length,1);
 const s=await snapshot();conserved(s);assert.equal(s.audit.reservations,pair[0].status==='fulfilled'?1:3);
});
test('real PostgreSQL: cross-instance placement, listing, purchase, remove and restart preserve custody and BUDS',async()=>{
 await reset();const e=engine();
 const p=await e.execute('alice',place('desk-a','place-a'));await market().list('alice','list','listing',asset,2,20,1000);
 const listed=await snapshot();conserved(listed);assert.equal(listed.audit.reservations,3);
 await market().buy('bob','buy','listing');
 const afterBuy=await snapshot();conserved(afterBuy);
 assert.equal(afterBuy.assets.find(([k])=>k===JSON.stringify(['bob',asset]))[1].available,2);
 assert.equal(afterBuy.balances.find(([k])=>k==='bob')[1].available,80);
 await assert.rejects(engine().execute('alice',place('desk-b','place-b',1,5)),/verified-unit-unavailable/);
 const removed=await engine().execute('alice',remove('desk-a','remove-a',1));
 assert.equal(removed.custody.unitId,p.custody.unitId);
 const recovered=await snapshot();conserved(recovered);assert.equal(recovered.audit.reservations,0);
 assert.equal(recovered.assets.find(([k])=>k===JSON.stringify(['alice',asset]))[1].available,1);
 assert.deepEqual(await engine().execute('alice',place('desk-a','place-a')),p);
});
test('real PostgreSQL: stale scene/replayed operation and forced failed transaction roll back together',async()=>{
 await reset();const e=engine();await e.execute('alice',place('desk-a','place-a'));
 const before=await snapshot();
 await assert.rejects(engine().execute('alice',place('desk-b','stale',0,5)),/stale-scene/);
 await assert.rejects(engine().execute('alice',{...place('desk-a','place-a',0,2)}),/replay-payload-conflict/);
 await assert.rejects(store().transact(s=>{s.assets.get(JSON.stringify(['alice',asset])).available=999;throw Error('injected-before-commit')}),/injected-before-commit/);
 const after=await snapshot();assert.deepEqual(after,before);conserved(after);
});
test('real PostgreSQL: two buyers and cancel against purchase cannot double settle',async()=>{
 await reset();await ledger().earn('fund-c','charlie','source','fund-c-proof',100);
 await market().list('alice','list','listing',asset,2,20,1000);
 const a=market(),b=market();
 const results=await Promise.allSettled([a.buy('bob','buy-b','listing'),b.buy('charlie','buy-c','listing'),a.cancel('alice','cancel','listing')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const s=await snapshot();conserved(s);assert.equal(s.audit.reservations,0);
 const listing=s.listings.find(([id])=>id==='listing')[1];assert.ok(['sold','cancelled'].includes(listing.status));
});
test.after(async()=>{try{await pool.query('DELETE FROM highcountry_buds_state WHERE namespace=$1',[ns]);}finally{await pool.end();}});
