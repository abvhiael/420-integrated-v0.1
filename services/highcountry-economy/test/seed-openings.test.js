import {test} from 'node:test';import assert from 'node:assert/strict';
import {openingFixture} from './seed-openings.fixture.mjs';
import {SeedOpenings} from '../src/seed-openings.js';
import {seedTier,uniformSeedDraw,poolDefinition,selectSeedOutcome,seedHash,OPENING_POOLS} from '../src/seed-opening-selection.js';
import {calldata} from '../src/finalized-rpc.js';
async function complete(f,p){const i=await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);f.prove(i.openingKey);await f.worker.tick(f.alice,p.id);return f.openings.reconcile(f.alice,p.id);}
test('exact 6/3/1 tier partition and independent bounded selection across all four immutable pools',async()=>{
 const counts=[0,0,0];for(let i=0;i<10;i++)counts[seedTier(i)]++;assert.deepEqual(counts,[6,3,1]);assert.throws(()=>seedTier(10));
 const f=await openingFixture();for(const region of OPENING_POOLS){const p=poolDefinition(f.catalogue,region);for(let n=0;n<100;n++){const o=selectSeedOutcome(p,seedHash('root:'+n),seedHash('request:'+n));assert.ok(p.tiers[o.tierIndex].includes(o.cultivarId));assert.ok(o.index>=0&&o.index<p.tiers[o.tierIndex].length);}}
 assert.ok(uniformSeedDraw('0x'+'00'.repeat(32),seedHash('r'),'d',10)>=0);
});
test('ownership and exact source provenance required; no preview or caller-provided outcome',async()=>{
 const f=await openingFixture(),[p]=await f.allocate();assert.equal((await f.openings.status(f.alice,p.id)).status,'not-committed');await assert.rejects(f.openings.reconcile(f.alice,p.id),/committed/);await assert.rejects(f.openings.open(f.bob,p.id),/ownership/);
 await f.store.transact(s=>s.seedPackSources.clear());await assert.rejects(f.openings.open(f.alice,p.id),/source admission/);assert.equal(f.store.state.seedOpenings.size,0);assert.equal(f.state.submissions.length,0);
});
test('one irreversible commitment, all 65 holds, retries/concurrency/restarts preserve identity and sealed outcome',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),results=await Promise.all(Array.from({length:8},()=>f.openings.open(f.alice,p.id)));
 assert.ok(results.every(r=>r.openingKey===results[0].openingKey));assert.ok(results.every(r=>r.outcome===null&&r.requestId===null));assert.equal(f.store.state.seedOpeningHolds.size,65);assert.ok([...f.store.state.seedOpeningHolds.values()].every(n=>n===3));
 const restart=new SeedOpenings({packs:f.packs,reader:f.reader});assert.deepEqual(await restart.open(f.alice,p.id),results[0]);assert.equal(f.store.state.seedOpenings.size,1);assert.equal(f.store.state.seedPacks.get(p.id).status,'opening-committed');
});
test('incomplete genotype pool and exhausted single cultivar reject before entropy or any hold',async()=>{
 const f=await openingFixture(),[p]=await f.allocate();const original=f.genomeReader.cultivar;f.genomeReader.cultivar=async cid=>cid==='HC-C-blueberry'?null:original(cid);
 await assert.rejects(f.openings.open(f.alice,p.id),/complete registered/);assert.equal(f.store.state.seedOpenings?.size??0,0);
 f.genomeReader.cultivar=original;await f.store.transact(s=>s.seedSupply.set('seeds:HC-C-blueberry',99999));await assert.rejects(f.openings.open(f.alice,p.id),/supply unavailable/);assert.equal(f.store.state.seedOpeningHolds.size,0);assert.equal(f.state.submissions.length,0);
});
test('starter issuance cannot steal capacity reserved by a pending standard draw',async()=>{
 const f=await openingFixture(),[p]=await f.allocate('Golden Prairie');await f.openings.open(f.alice,p.id);const cid=f.packs.pools.get('Golden Prairie').common[0];await f.store.transact(s=>s.seedSupply.set('seeds:'+cid,99996));await assert.rejects(f.packs.starter(f.bob,'Golden Prairie'),/supply exhausted/);assert.equal(f.store.state.seedOpeningHolds.get(cid),3);
});
test('canonical request, original-proof wait, fulfillment and selected seed issuance happen once',async()=>{
 const f=await openingFixture(),[p]=await f.allocate();const i=await f.openings.open(f.alice,p.id);assert.equal((await f.worker.tick(f.alice,p.id)).phase,'request');assert.equal((await f.worker.tick(f.alice,p.id)).status,'awaiting-original-proof');assert.equal(f.state.submissions.length,1);
 f.prove(i.openingKey);assert.equal((await f.worker.tick(f.alice,p.id)).phase,'fulfill');const result=await f.openings.reconcile(f.alice,p.id);assert.equal(result.status,'fulfilled');
 const chosen=result.outcome.cultivarId;assert.equal(f.store.state.seedSupply.get('seeds:'+chosen),3);assert.ok([...f.store.state.seedOpeningHolds.values()].every(n=>n===0));
 for(let n=0;n<5;n++){await f.openings.open(f.alice,p.id);await f.openings.reconcile(f.alice,p.id);await f.worker.tick(f.alice,p.id);}assert.equal(f.state.submissions.length,2);assert.equal(f.store.state.seedSupply.get('seeds:'+chosen),3);
 const lot=await f.packs.prepare(f.alice,p.id);assert.equal(lot.genomeId,result.outcome.genomeId);assert.equal(lot.cultivarId,chosen);assert.equal(lot.quantity,3);assert.equal(lot.breedingEventId,result.outcome.breedingEventId);assert.equal(lot.calldata,calldata('registerSeedLot(uint64,bytes32,uint64,address,uint32,bytes32)',lot.lotId,lot.genomeId,lot.breedingEventId,lot.wallet,3,lot.metadataHash));assert.deepEqual(await f.packs.prepare(f.alice,p.id),lot);assert.equal(f.store.state.seedSupply.get('seeds:'+chosen),3);
 assert.equal(f.store.state.issued,0);assert.equal(f.store.state.assets.size,0);
});
test('post-broadcast crash recovers original request without another provider request or lost holds',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id);f.state.hideResponse=true;await assert.rejects(f.worker.tick(f.alice,p.id),/response lost/);f.state.hideResponse=false;
 assert.equal((await f.worker.tick(f.alice,p.id)).status,'awaiting-original-proof');assert.equal(f.state.records.size,1);assert.equal(f.state.submissions.length,1);assert.equal(f.store.state.seedOpeningHolds.size,65);f.prove(i.openingKey);await f.worker.tick(f.alice,p.id);assert.equal((await f.openings.reconcile(f.alice,p.id)).status,'fulfilled');
});
test('after outcome commitment wallet changes cannot redirect seed entitlement',async()=>{
 const f=await openingFixture(),[p]=await f.allocate();await complete(f,p);await f.store.transact(s=>s.runtimeWallets.set('alice',{...s.runtimeWallets.get('alice'),wallet:'0x'+'33'.repeat(20)}));await assert.rejects(f.packs.prepare(f.alice,p.id),/immutable/);assert.equal((await f.openings.status(f.alice,p.id)).status,'fulfilled');assert.equal(f.store.state.seedLotIntents.size,0);
});
test('forged provider/proof/index, downgraded request, bad code and reorg never release holds',async()=>{
 for(const flag of ['badPurpose','badCode','reorg','badProof','badIndex']){
  const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);f.prove(i.openingKey);await f.worker.tick(f.alice,p.id);f.state[flag]=true;
  await assert.rejects(f.openings.reconcile(f.alice,p.id));assert.ok([...f.store.state.seedOpeningHolds.values()].every(n=>n===3));assert.equal(f.store.state.seedPacks.get(p.id).status,'opening-committed');
 }
 const f=await openingFixture(),[p]=await f.allocate();await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);f.state.persistent=false;await assert.rejects(f.openings.reconcile(f.alice,p.id),/binding mismatch/);
});
test('revocation/unlink during pool validation prevents irreversible commitment',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),original=f.genomeReader.cultivar;let first=true;f.genomeReader.cultivar=async cid=>{if(first){first=false;await f.identity.unlink(f.alice);}return original(cid);};await assert.rejects(f.openings.open(f.alice,p.id),/authority or pack changed/);assert.equal(f.store.state.seedOpenings.size,0);assert.equal(f.store.state.seedOpeningHolds.size,0);
});
test('modulo bias boundaries reject precisely the surplus words for every supported pool bound',async()=>{
 const {reduceSeedWord}=await import('../src/seed-opening-selection.js');for(let b=1;b<=65;b++){const threshold=(2n**256n)%BigInt(b);if(threshold)assert.equal(reduceSeedWord(threshold-1n,b).accepted,false);assert.equal(reduceSeedWord(threshold,b).accepted,true);assert.equal((2n**256n-threshold)%BigInt(b),0n);}assert.throws(()=>reduceSeedWord(0n,0));
});
test('unregistered sources and public queue cannot inject entropy; operator runner plans without dispatch',async()=>{
 const {dispatchSeedOpenings}=await import('../../../scripts/highcountry/dispatch_seed_openings.mjs'),f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id),calls=[],reports=[];
 await assert.rejects(f.openings.pending(f.bob,{after:'',limit:100}),/denied/);
 const fetchImpl=async(url,options)=>{calls.push([String(url),JSON.parse(options.body)]);return {ok:true,json:async()=>({ok:true,result:{intents:[i],next:null}})};};assert.deepEqual(await dispatchSeedOpenings({apiUrl:'https://hc.example',token:'signed',fetchImpl,report:r=>reports.push(r)}),{processed:1,failed:0});assert.equal(calls.length,1);assert.equal(reports[0].scopeHash,i.openingKey);assert.equal(reports[0].amount,0);
});
test('fulfilled draw and committed holds persist through account wallet unlink without reroll',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);await f.identity.unlink(f.alice);f.prove(i.openingKey);await f.worker.tick(f.alice,p.id);const done=await f.openings.reconcile(f.alice,p.id);assert.equal(done.status,'fulfilled');assert.equal(f.state.records.size,1);assert.equal((await f.openings.open(f.alice,p.id)).requestId,done.requestId);await assert.rejects(f.packs.prepare(f.alice,p.id),/wallet binding/);
});
test('each rarity issues the exact approved common, rare or founding genome and lossless breeding event',async()=>{
 for(const wanted of ['common','rare','exclusive']){
  const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);const r=f.state.records.get(i.openingKey),pool=poolDefinition(f.catalogue,'World');
  // TEST ONLY: enumerate fixture roots for branch coverage. No production entropy injection API exists.
  for(let j=0;j<1000;j++){r.entropy=seedHash('TEST_ONLY_TIER_COVERAGE:'+j);if(selectSeedOutcome(pool,r.entropy,r.requestId).tier===wanted)break;}
  f.prove(i.openingKey);await f.worker.tick(f.alice,p.id);const done=await f.openings.reconcile(f.alice,p.id),lot=await f.packs.prepare(f.alice,p.id);assert.equal(done.outcome.tier,wanted);assert.equal(f.catalogue.detail(lot.cultivarId).tier,wanted);assert.equal(lot.genomeId,done.outcome.genomeId);if(wanted==='rare'){assert.ok(BigInt(lot.breedingEventId)>0n);assert.equal(typeof lot.breedingEventId,'string');}else assert.equal(lot.breedingEventId,'0');
 }
});
test('a fulfilled result whose canonical proof disappears cannot prepare seeds',async()=>{
 const f=await openingFixture(),[p]=await f.allocate();const done=await complete(f,p);f.state.records.delete(done.openingKey);await assert.rejects(f.packs.prepare(f.alice,p.id),/canonical opening evidence/);assert.equal(f.store.state.seedLotIntents.size,0);assert.equal((await f.openings.status(f.alice,p.id)).requestId,done.requestId);
});
test('pending broadcasts wait, finalized reverted transactions retry the same immutable opening',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id),original=f.worker.signerRpc.request,txHash=seedHash('TEST_REVERTED_TX');
 f.worker.signerRpc.request=async method=>method==='eth_chainId'?'0x1a4':txHash;
 assert.equal((await f.worker.tick(f.alice,p.id)).status,'submitted');assert.equal((await f.worker.tick(f.alice,p.id)).status,'awaiting-finality');
 f.state.receipt={transactionHash:txHash,status:'0x0',blockNumber:'0x63',blockHash:'0x'+'aa'.repeat(32)};f.state.transaction={from:f.worker.operator,to:f.rpc.contracts.seedOpening.address,input:i.calldata,value:'0x0'};
 f.worker.signerRpc.request=original;assert.equal((await f.worker.tick(f.alice,p.id)).status,'submitted');assert.equal(f.store.state.seedOpeningJobs.get(p.id).failures.length,1);assert.equal(f.state.records.size,1);assert.equal((await f.openings.status(f.alice,p.id)).openingKey,i.openingKey);assert.ok([...f.store.state.seedOpeningHolds.values()].every(n=>n===3));
});
test('forged failed-transaction evidence never clears a pending request or releases entitlement',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id),txHash=seedHash('TEST_WRONG_TX');f.worker.signerRpc.request=async method=>method==='eth_chainId'?'0x1a4':txHash;await f.worker.tick(f.alice,p.id);
 f.state.receipt={transactionHash:txHash,status:'0x0',blockNumber:'0x63',blockHash:'0x'+'aa'.repeat(32)};f.state.transaction={from:f.worker.operator,to:f.rpc.contracts.seedOpening.address,input:'0x00',value:'0x0'};
 await assert.rejects(f.worker.tick(f.alice,p.id),/binding mismatch/);assert.equal(f.store.state.seedOpeningJobs.get(p.id).hashes.request,txHash);assert.equal((await f.openings.status(f.alice,p.id)).openingKey,i.openingKey);
});
test('lost fulfillment response reconciles one selected reservation and never submits a second fulfillment',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);f.prove(i.openingKey);f.state.hideResponse=true;await assert.rejects(f.worker.tick(f.alice,p.id),/response lost/);f.state.hideResponse=false;
 assert.equal((await f.worker.tick(f.alice,p.id)).status,'fulfilled');assert.equal((await f.worker.tick(f.alice,p.id)).status,'fulfilled');assert.equal(f.state.submissions.length,2);const o=await f.openings.status(f.alice,p.id);assert.equal(f.store.state.seedSupply.get('seeds:'+o.outcome.cultivarId),3);assert.ok([...f.store.state.seedOpeningHolds.values()].every(n=>n===0));
});
test('changing deployed opening/router/profile configuration cannot reroll an existing entitlement',async()=>{
 const {SeedOpeningChainReader}=await import('../src/seed-opening-chain-reader.js');
 const f=await openingFixture(),[p]=await f.allocate(),intent=await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);
 for(const key of ['seedOpening','randomRouter']){
  const rpc={...f.rpc,contracts:structuredClone(f.rpc.contracts)};rpc.contracts[key].address='0x'+'ef'.repeat(20);
  const reader=new SeedOpeningChainReader({rpc,catalogue:f.catalogue,gameId:f.identity.gameId,profileId:f.profile,timeoutSeconds:100,approvedRoutes:[f.route]});await assert.rejects(reader.read(intent),/deployment cannot be replaced/);
 }
 const reader=new SeedOpeningChainReader({rpc:f.rpc,catalogue:f.catalogue,gameId:f.identity.gameId,profileId:seedHash('new-profile'),timeoutSeconds:100,approvedRoutes:[f.route]});await assert.rejects(reader.read(intent),/deployment cannot be replaced/);assert.equal(f.state.records.size,1);assert.ok([...f.store.state.seedOpeningHolds.values()].every(n=>n===3));
});

test('fulfilled zero-valued canonical result retains its entitlement and exactly-once selection',async()=>{
 const f=await openingFixture(),[p]=await f.allocate(),i=await f.openings.open(f.alice,p.id);await f.worker.tick(f.alice,p.id);
 const record=f.state.records.get(i.openingKey);record.entropy='0x'+'00'.repeat(32);record.proofHash='0x'+'00'.repeat(32);f.prove(i.openingKey);
 await f.worker.tick(f.alice,p.id);const done=await f.openings.reconcile(f.alice,p.id);assert.equal(done.status,'fulfilled');
 const lot=await f.packs.prepare(f.alice,p.id);assert.equal(lot.cultivarId,done.outcome.cultivarId);assert.deepEqual(await f.packs.prepare(f.alice,p.id),lot);
});
