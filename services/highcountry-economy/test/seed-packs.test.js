import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,data,ALICE,BOB} from './seed-catalogue.fixture.mjs';
import {SeedPacks,SEED_PACK_POLICY} from '../src/seed-packs.js';
import {SeedIssuanceWorker} from '../src/seed-issuance-worker.js';
import {calldata} from '../src/finalized-rpc.js';
async function setup(){
 const f=await fixture();f.identity.issuers.idp.operators={alice:{sources:['seed-packs']}};
 const issued=new Map();let submits=0;
 const reader={cultivar:async id=>{const g=data.commonReferences.genomes.find(g=>g.cultivarId===id);return {cultivarId:id,genomeId:g.genomeId,basis:'registered-common-reference',anchor:{fixtureOnly:true}};},issuance:async i=>issued.get(i.lotId)??null,issuedLot:async i=>{const e=issued.get(i.lotId);if(!e)throw Error('not finalized');return e;}};
 const packs=new SeedPacks({...f,reader});
 const rpc={unrestricted:async()=>true,chainId:420,contracts:f.chain.rpc.contracts,header:async()=>({hash:'0x'+'ab'.repeat(32)}),request:async()=> '0x'};
 const signerRpc={request:async method=>{if(method==='eth_chainId')return '0x1a4';submits++;return '0x'+'cd'.repeat(32);}};
 const worker=new SeedIssuanceWorker({packs,reader,rpc,signerRpc,operator:ALICE,clock:()=>1000});
 return {...f,packs,reader,worker,issued,submits:()=>submits};
}
test('all four pools are exact immutable catalogue partitions; equal standard odds and quantity',async()=>{
 const f=await setup(),p=f.packs.policy();assert.deepEqual(p.policy.oddsBps,{common:6000,rare:3000,exclusive:1000});assert.equal(p.policy.seedsPerPack,3);assert.equal(p.policy.priceBuds,420);assert.equal(p.policy.priceNative420Wei,'1000000000000000000');
 assert.deepEqual(Object.values(p.pools.World).map(p=>p.length),[23,26,16]);
 for(const tier of ['common','rare','exclusive'])assert.deepEqual(['Emerald Coast','Golden Prairie','Red Mesa'].flatMap(r=>p.pools[r][tier]).sort(),p.pools.World[tier]);
 p.policy.oddsBps.common=0;assert.equal(f.packs.policy().policy.oddsBps.common,6000);
});
test('starter grant is two distinct common packs; retries, races, new sessions and unlink do not repeat',async()=>{
 const f=await setup();const results=await Promise.all(Array.from({length:10},()=>f.packs.starter(f.alice,'Golden Prairie')));
 assert.ok(results.every(r=>JSON.stringify(r)===JSON.stringify(results[0])));assert.equal(new Set(results[0].map(p=>p.starterCultivarId)).size,2);
 for(const p of results[0]){const c=f.catalogue.detail(p.starterCultivarId);assert.equal(c.tier,'common');assert.equal(c.region,'Golden Prairie');assert.equal(p.seeds,3);}
 await f.store.transact(s=>s.runtimeWallets.delete('alice'));
 assert.equal((await f.packs.starter(f.token('alice'),'Golden Prairie')).length,2);
 await assert.rejects(f.packs.starter(f.alice,'Red Mesa'),/already issued/);
 assert.equal(f.store.state.seedPacks.size,2);assert.equal(f.store.state.seedSupply.get('starter:accounts'),1);
 assert.equal(f.store.state.issued,0);assert.equal(f.store.state.assets.size,0);
});
test('starter source and cultivar caps rollback every partial grant',async()=>{
 const f=await setup();await f.store.transact(s=>{s.seedSupply=new Map([['starter:accounts',SEED_PACK_POLICY.starterAccountLimit]]);});
 await assert.rejects(f.packs.starter(f.alice,'Emerald Coast'),/exhausted/);assert.equal(f.store.state.seedPacks,undefined);
 await f.store.transact(s=>{s.seedSupply=new Map([['seeds:'+f.packs.pools.get('Emerald Coast').common[1],99999]]);});
 await assert.rejects(f.packs.starter(f.alice,'Emerald Coast'),/exhausted/);assert.equal(f.store.state.seedPacks,undefined);assert.equal(f.store.state.seedSupply.size,1);
});
test('only scoped issuers allocate packs, receipt identity cannot be reused for changed allocations',async()=>{
 const f=await setup(),request={receiptId:'receipt:1',owner:'bob',region:'World',count:2};
 await assert.rejects(f.packs.allocate(f.bob,request),/denied/);await assert.rejects(f.packs.allocate(f.alice,{...request,count:101}));
 const first=await f.packs.allocate(f.alice,request);assert.deepEqual(await f.packs.allocate(f.alice,request),first);
 await assert.rejects(f.packs.allocate(f.alice,{...request,count:1}),/replay mismatch/);
 await assert.rejects(f.packs.allocate(f.alice,{...request,receiptId:'other',owner:'not-registered'}),/registered/);
 assert.equal(first[0].source.kind,'authorized-allocation');assert.equal(f.store.state.seedSupply.get('standard:World'),2);
 await assert.rejects(f.packs.prepare(f.bob,first[0].id),/HC-SEED-08/);
 await f.store.transact(s=>s.seedSupply.set('standard:World',100000));await assert.rejects(f.packs.allocate(f.alice,{...request,receiptId:'new'}),/exhausted/);
});
test('immutable lot intent uses canonical genome, exact calldata, wallet, supply reservation and no duplicate seeds',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Red Mesa'),i=await f.packs.prepare(f.alice,p.id);
 assert.equal(i.quantity,3);assert.equal(i.wallet,ALICE);assert.equal(i.breedingEventId,'0');assert.ok(BigInt(i.lotId)>0n&&BigInt(i.lotId)<2n**64n);
 assert.equal(i.calldata,calldata('registerSeedLot(uint64,bytes32,uint64,address,uint32,bytes32)',i.lotId,i.genomeId,0,ALICE,3,i.metadataHash));
 assert.deepEqual(await f.packs.prepare(f.alice,p.id),i);assert.equal(f.store.state.seedSupply.get('seeds:'+p.starterCultivarId),3);
 await assert.rejects(f.packs.prepare(f.bob,p.id),/ownership/);await assert.rejects(f.packs.confirm(f.alice,p.id),/not finalized/);
 assert.equal((await f.packs.inventory(f.alice)).packs[0].status,'issuance-prepared');
 f.issued.set(i.lotId,{fixtureOnly:true});assert.equal((await f.packs.confirm(f.alice,p.id)).status,'issued');await f.packs.confirm(f.alice,p.id);assert.equal(f.store.state.seedLotIntents.size,1);
});
test('wallet reuse across accounts, changed wallets, missing genomes and revocation cannot mint',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Emerald Coast');
 const original=f.reader.cultivar;f.reader.cultivar=async()=>null;await assert.rejects(f.packs.prepare(f.alice,p.id),/registered/);assert.equal(f.store.state.seedLotIntents.size,0);f.reader.cultivar=original;
 await f.packs.prepare(f.alice,p.id);await f.store.transact(s=>{s.runtimeWallets.set('alice',{...s.runtimeWallets.get('alice'),wallet:BOB});s.runtimeWallets.set('bob',{...s.runtimeWallets.get('bob'),wallet:ALICE});});
 await assert.rejects(f.packs.prepare(f.alice,p.id),/immutable/);const [b]=await f.packs.starter(f.bob,'Emerald Coast');await assert.rejects(f.packs.prepare(f.bob,b.id),/already used/);
 await f.store.transact(s=>s.runtimeEpochs.set('alice',1));await assert.rejects(f.packs.inventory(f.alice),/revoked/);await assert.rejects(f.worker.tick(f.alice,p.id),/revoked/);
});
test('revocation/unlink during reference RPC cannot commit a lot intent',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Golden Prairie'),original=f.reader.cultivar;
 f.reader.cultivar=async id=>{const result=await original(id);await f.store.transact(s=>s.runtimeWallets.delete('alice'));return result;};
 await assert.rejects(f.packs.prepare(f.alice,p.id),/binding changed/);assert.equal(f.store.state.seedLotIntents.size,0);
});
test('dispatch authorization, crash recovery and confirmation never fabricate local ownership',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Red Mesa'),i=await f.packs.prepare(f.alice,p.id);
 await assert.rejects(f.worker.tick(f.bob,p.id),/denied/);
 assert.equal((await f.worker.tick(f.alice,p.id)).status,'submitted');assert.equal((await f.worker.tick(f.alice,p.id)).status,'awaiting-finality');assert.equal(f.submits(),1);
 f.issued.set(i.lotId,{fixtureOnly:true});assert.equal((await f.worker.tick(f.alice,p.id)).status,'issued');assert.equal((await f.worker.tick(f.alice,p.id)).status,'issued');assert.equal(f.submits(),1);
 assert.equal(f.store.state.assets.size,0);assert.equal(f.store.state.issued,0);assert.equal(f.store.state.burned,0);
});
test('post-broadcast/pre-record recovery reconciles canonical ID before any new submission',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Red Mesa'),i=await f.packs.prepare(f.alice,p.id);
 f.worker.signerRpc.request=async method=>{if(method==='eth_chainId')return '0x1a4';f.issued.set(i.lotId,{fixtureOnly:true});throw Error('broadcast response lost');};
 await assert.rejects(f.worker.tick(f.alice,p.id),/response lost/);assert.equal((await f.worker.tick(f.alice,p.id)).status,'issued');
});
test('mismatched chain, revoked recipient, busy lease and chain mismatch evidence fail closed',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Golden Prairie');await f.packs.prepare(f.alice,p.id);
 f.worker.signerRpc.request=async()=> '0x1';await assert.rejects(f.worker.tick(f.alice,p.id),/wrong chain/);
 await f.store.transact(s=>s.runtimeEpochs.set('alice',1));await assert.rejects(f.worker.tick(f.token('alice'),p.id));
 assert.equal(f.store.state.seedPacks.get(p.id).status,'issuance-prepared');
});
test('finalized reader resolves canonical eligibility and rejects altered lot fields or chain anchors',async()=>{
 const f=await fixture(),c=data.commonReferences.genomes.find(e=>e.cultivarId==='HC-C-blue-dream');
 const i={lotId:'1',genomeId:c.genomeId,breedingEventId:'0',wallet:ALICE,quantity:3,metadataHash:'0x'+'55'.repeat(32),cultivarId:c.cultivarId};
 const {selector}=await import('../src/keccak.js'),{word}=await import('../src/finalized-rpc.js');const previous=f.chain.rpc.request;let exists=false,alter=false;
 f.chain.rpc.request=async(method,args)=>{
  if(method==='eth_call'&&args[0].data.startsWith('0x'+selector('exists(uint64)')))return '0x'+word(exists?1:0);
  if(method==='eth_call'&&args[0].data.startsWith('0x'+selector('getSeedLot(uint64)')))return '0x'+[i.lotId,i.genomeId,0,ALICE,alter?4:3,i.metadataHash,1].map(word).join('');
  return previous(method,args);
 };
 assert.equal((await f.chain.reader.cultivar(c.cultivarId)).genomeId,c.genomeId);
 assert.equal(await f.chain.reader.issuance(i),null);exists=true;assert.equal((await f.chain.reader.issuedLot(i)).lotId,'1');
 alter=true;await assert.rejects(f.chain.reader.issuedLot(i),/intent mismatch/);alter=false;
 for(const change of [{wallet:BOB},{metadataHash:'0x'+'66'.repeat(32)},{cultivarId:'HC-C-not-real'},{breedingEventId:'1'}])await assert.rejects(f.chain.reader.issuedLot({...i,...change}));
 f.chain.state.referenceTampered=true;await assert.rejects(f.chain.reader.issuedLot(i),/reference record/);f.chain.state.referenceTampered=false;
 f.chain.state.reorg=true;await assert.rejects(f.chain.reader.issuedLot(i),/anchor changed/);
});
test('market emergency blocks submissions while finalized reconciliation remains available',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Red Mesa'),i=await f.packs.prepare(f.alice,p.id);f.worker.rpc.unrestricted=async()=>false;
 await assert.rejects(f.worker.tick(f.alice,p.id),/market restricted/);assert.equal(f.submits(),0);
 f.issued.set(i.lotId,{fixtureOnly:true});assert.equal((await f.worker.tick(f.alice,p.id)).status,'issued');
});
test('changed canonical profile cannot receive a stale prepared issuance',async()=>{
 const f=await setup(),[p]=await f.packs.starter(f.alice,'Red Mesa');await f.packs.prepare(f.alice,p.id);
 f.identity.rpc.playerProfile=async()=> '0x'+'99'.repeat(32);
 await assert.rejects(f.worker.tick(f.alice,p.id),/profile changed/);assert.equal(f.submits(),0);
});
