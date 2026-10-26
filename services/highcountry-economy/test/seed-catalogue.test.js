import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,chainFixture,data,ALICE,BOB} from './seed-catalogue.fixture.mjs';
import {SeedCatalogue,SeedCollection} from '../src/seed-catalogue.js';
import {parseSeedBreedingPlan,canonicalSeedChild} from '../src/seed-chain-reader.js';
import {spawnSync} from 'node:child_process';

test('all 65 public entries, exact region/tier filters and source-safe ancestry',()=>{
 const c=new SeedCatalogue(data);assert.equal(c.browse().entries.length,65);assert.equal(c.browse({tier:'common',region:'Red Mesa'}).entries.length,7);
 assert.equal(c.browse({search:'blue moon'}).entries[0].id,'HC-R-blue-moon');assert.equal(c.detail('HC-R-spirit-bear').ancestry.parents[0].name,'White Widow');
 assert.equal(c.detail('HC-F01').name,'Emerald Ghost');assert.equal(c.detail('HC-C-granddaddy-purple').ancestry.candidates.length,2);
 assert.doesNotMatch(JSON.stringify(c.browse()),/"(?:libraryFileId|finalRevelation|discoverableFragments|metadataHash|loci)"\s*:/);
 assert.throws(()=>c.browse({owner:'victim'}));assert.throws(()=>c.browse({region:'Northern Lights'}));assert.throws(()=>c.detail('unknown'));
});
test('browsing does not discover or award; no caller owner/quantity assumptions',async()=>{
 const f=await fixture();f.catalogue.browse();assert.equal(f.store.state.seedDiscoveries,undefined);assert.equal(f.store.state.seedHarvestCards,undefined);
 const before=await f.service.snapshot(f.bob);assert.equal(before.cards.length,0);assert.ok(before.entries.every(e=>!e.discovered&&e.ownedSeeds===0));
 const a=await f.service.snapshot(f.alice);const blue=a.entries.find(e=>e.id==='HC-C-blue-dream');assert.equal(blue.ownedSeeds,3);assert.equal(blue.discovered,true);assert.equal(blue.harvested,false);
 assert.equal(f.store.state.issued,0);assert.equal(f.store.state.assets.size,0);
});
test('transfers remove current ownership while retaining authenticated discoveries',async()=>{
 const f=await fixture();await f.service.snapshot(f.alice);f.chain.state.owner=BOB;
 const s=await f.service.snapshot(f.alice);assert.equal(s.entries.find(e=>e.id==='HC-C-blue-dream').ownedSeeds,0);assert.equal(s.entries.find(e=>e.id==='HC-C-blue-dream').discovered,true);
});
test('successful grower gets one durable cosmetic card with replay-safe source identity',async()=>{
 const f=await fixture();const card=await f.service.claimHarvest(f.alice,'7');assert.equal(card.cultivarId,'HC-C-blue-dream');assert.equal(card.nonTransferable,true);assert.equal(card.cosmeticOnly,true);
 assert.deepEqual(await f.service.claimHarvest(f.alice,'7'),card);assert.equal((await f.service.snapshot(f.alice)).cards.length,1);assert.equal((await f.service.snapshot(f.bob)).cards.length,0);
 assert.equal(f.store.state.seedHarvestClaims.size,1);assert.equal(f.store.state.burned,0);assert.equal(f.store.state.issued,0);
});
test('wrong grower, zero yield, failed grade and forged genome reject',async()=>{
 for(const [key,value] of [['grower',BOB],['grams',0],['grade',0],['referenceTampered',true]]){const f=await fixture();f.chain.state[key]=value;await assert.rejects(f.service.claimHarvest(f.alice,'7'));assert.equal(f.store.state.seedHarvestCards,undefined);}
});
test('unsigned, revoked and expired sessions cannot award',async()=>{
 const f=await fixture();await assert.rejects(f.service.claimHarvest('forged','7'));f.clock(100001);await assert.rejects(f.service.claimHarvest(f.alice,'7'));
 const revoked=await fixture();await revoked.store.transact(s=>s.runtimeEpochs.set('alice',1));await assert.rejects(revoked.service.claimHarvest(revoked.alice,'7'));
});
test('revocation or wallet unlink during RPC prevents transaction commit',async()=>{
 const f=await fixture();const original=f.service.reader.harvest.bind(f.service.reader);
 f.service.reader={ownership:()=>{},harvest:async(...args)=>{const h=await original(...args);await f.store.transact(s=>s.runtimeWallets.delete('alice'));return h;}};
 await assert.rejects(f.service.claimHarvest(f.alice,'7'),/binding revoked/);assert.equal(f.store.state.seedHarvestCards,undefined);
});
test('unlinked registered accounts have explicit unknown ownership, never fake zero',async()=>{
 const f=await fixture();await f.identity.unlink(f.alice);const s=await f.service.snapshot(f.alice);assert.equal(s.ownershipStatus,'wallet-not-linked');assert.ok(s.entries.every(e=>e.ownedSeeds===null));await assert.rejects(f.service.claimHarvest(f.alice,'7'),/wallet binding/);
});
test('concurrent claims grant once and claims cannot migrate with wallet relinking',async()=>{
 const f=await fixture();await Promise.all([f.service.claimHarvest(f.alice,'7'),f.service.claimHarvest(f.alice,'7')]);assert.equal(f.store.state.seedHarvestCards.size,1);
 await f.identity.unlink(f.alice);await f.store.transact(s=>s.runtimeWallets.set('bob',{wallet:ALICE,profile:f.identity.gameId,chainId:420,game:f.identity.gameId}));await assert.rejects(f.service.claimHarvest(f.bob,'7'),/another account/);
});
test('canonical reader fails closed on code, reference, remaining balance and anchor mismatch',async()=>{
 for(const [key,value] of [['badCode',true],['referenceTampered',true],['remaining',6],['reorg',true]]){const f=chainFixture();f.state[key]=value;await assert.rejects(f.reader.ownership(ALICE));}
});
test('all chain reads use the same finalized block hash and canonicality requirement',async()=>{
 const f=chainFixture();await f.reader.harvest(ALICE,'7');const calls=f.state.calls.filter(([m])=>m==='eth_call'||m==='eth_getCode');assert.ok(calls.length>5);assert.ok(calls.every(([,p])=>p[1].requireCanonical===true&&p[1].blockHash==='0x'+'aa'.repeat(32)));
});
test('uint64 breeding IDs retain exact values through parsing',()=>{
 const p=parseSeedBreedingPlan('{"breedingEventId":18446744073709551614}');assert.equal(p.breedingEventId,'18446744073709551614');
});
test('JavaScript inheritance matches qualified Python model across every planned rare cross',()=>{
 const script=`import sys,json;sys.path.insert(0,'scripts/highcountry');import rare_genome_lifecycle as r\np=r.g.load('rare-breeding-plan.v1.json');c={e['genomeId']:e for e in r.g.load('common-reference-genomes.v1.json')['genomes']}\nprint(json.dumps([{'id':str(e['breedingEventId']),'entropy':r.g.k(('SEED05_TEST:'+str(i)).encode()),'a':c[e['parentAGenomeId']]['loci'],'b':c[e['parentBGenomeId']]['loci'],'expected':r.offspring(c[e['parentAGenomeId']]['loci'],c[e['parentBGenomeId']]['loci'],r.g.k(('SEED05_TEST:'+str(i)).encode()),e['breedingEventId'])[0]} for i,e in enumerate(p['events'])]))`;
 const run=spawnSync('python',['-c',script],{cwd:new URL('../../../',import.meta.url),encoding:'utf8'});assert.equal(run.status,0,run.stderr);for(const v of JSON.parse(run.stdout))assert.deepEqual(canonicalSeedChild(v.a,v.b,v.entropy,v.id),v.expected);
});

test('rare catalogue identity requires consumed canonical breeding, proof binding and inherited loci',async()=>{
 const good=chainFixture();good.state.harvestGenome=good.rare.childGenomeId;assert.equal((await good.reader.harvest(ALICE,'7')).cultivarId,good.rare.cultivarId);
 for(const key of ['badRare','badProof','badLoci']){const f=chainFixture();f.state.harvestGenome=f.rare.childGenomeId;f.state[key]=true;await assert.rejects(f.reader.harvest(ALICE,'7'));}
});
test('Original Sixteen require the actual reserved founding line mapping',async()=>{
 const f=chainFixture();f.state.harvestGenome=f.founderGenome;assert.equal((await f.reader.harvest(ALICE,'7')).cultivarId,f.founder.id);f.state.badFounder=true;await assert.rejects(f.reader.harvest(ALICE,'7'),/founding line/);
});
