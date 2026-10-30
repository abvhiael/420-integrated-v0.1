import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
import {TAXONOMY_VERSION,POLICY_VERSION,defineTaxonomyCatalog} from '../src/object-taxonomy.js';
import {ItemIssuance,verifyItemProof,rollModifiers,unbiasedTicket} from '../src/item-issuance.js';
const type={schemaVersion:TAXONOMY_VERSION,typeId:'artisan_bench',family:'equipment',roles:['crafting'],surfaces:['floor'],layers:['furniture'],decorative:false,qualified:true,qualificationRef:'reviewed_type'};
const policy=(origin)=>({schemaVersion:POLICY_VERSION,policyId:origin+'_policy',typeId:'artisan_bench',revision:1,origin,maxModifiers:origin==='developer'?1:2,perItemCapBps:origin==='quest'?2000:500,effects:origin==='developer'?[{effectId:'crafting_efficiency',minBps:250,maxBps:250,weight:1}]:origin==='quest'?[{effectId:'crafting_efficiency',minBps:400,maxBps:500,weight:1},{effectId:'material_conservation',minBps:400,maxBps:500,weight:1}]:[{effectId:'crafting_efficiency',minBps:70,maxBps:180,weight:2},{effectId:'material_conservation',minBps:70,maxBps:180,weight:1}],qualified:true,qualificationRef:'reviewed_policy'});
const catalog=defineTaxonomyCatalog({types:[type],policies:['creator','developer','quest'].map(policy)});
const entropy='0x'+'ab'.repeat(32);
const fixtures=()=>{
 const store=new MemoryTransactionFixture();let paid=false,quest=false,random=true,verified=0,revoked=false,tamperedRequest=false;
 const authority={principal:async session=>session,issuer:async()=>true,guardState:()=>!revoked,verifyPurchase:async()=>paid,verifyQuest:async()=>quest,verifyTransfer:async()=>true,verifyCancellation:async()=>true};
 const entropyReader={verifyFinalized:async intent=>{verified++;return random?{verified:true,context:intent.context,entropy,requestId:tamperedRequest?'different_request':intent.randomnessRequestId,anchor:'finalized_block_77'}:{verified:false,context:intent.context,entropy,requestId:tamperedRequest?'different_request':intent.randomnessRequestId,anchor:'finalized_block_77'};}};
 const issuer=new ItemIssuance({store,catalog,authority,entropyReader,clock:()=>111});
 const design=origin=>({designId:origin+'_design',typeId:'artisan_bench',policyId:origin+'_policy',policyRevision:1,editionCap:2,certificationRef:'signed_cert',creator:'alice',origin});
 const reserve=(origin,item=origin+'_item',source=origin+'_purchase')=>issuer.reserve('alice',{designId:origin+'_design',itemId:item,sourceId:source,intentNonce:'nonce_unique'});
 const evidence=origin=>({source:{receiptId:origin+'_purchase'},randomness:origin==='developer'?null:{proof:'immutable'}});
 return {store,issuer,design,reserve,evidence,paid:()=>{paid=true;},quest:()=>{quest=true;},unverify:()=>{random=false;},revoke:()=>{revoked=true;},tamper:()=>{tamperedRequest=true;},calls:()=>verified};
};
test('immutable cap 1..420, duplicate publication and reservation cap',async()=>{
 const f=fixtures();await assert.rejects(f.issuer.publish('admin',{...f.design('creator'),editionCap:421}),/design-invalid/);
 await f.issuer.publish('admin',f.design('creator'));
 await assert.rejects(f.issuer.publish('admin',f.design('creator')),/already-published/);
 await f.reserve('creator');await f.reserve('creator','second_item','second_purchase');
 await assert.rejects(f.reserve('creator','third_item','third_purchase'),/reserved/);
});
test('no reveal before independently verified finalized purchase and randomness',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('creator'));await f.reserve('creator');
 await assert.rejects(f.issuer.issue('alice',{itemId:'creator_item',evidence:f.evidence('creator')}),/source-not-finalized/);
 assert.equal(f.calls(),0);f.paid();f.unverify();
 await assert.rejects(f.issuer.issue('alice',{itemId:'creator_item',evidence:f.evidence('creator')}),/randomness-unverified/);
 assert.equal(f.store.state.econItems?.size??0,0);
});
test('verified creator draw, stable proof and no outcome substitution or replay',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('creator'));await f.reserve('creator');f.paid();
 const item=await f.issuer.issue('alice',{itemId:'creator_item',evidence:f.evidence('creator')});
 assert.equal(verifyItemProof(catalog,item),true);assert(item.effects.reduce((n,e)=>n+e.bps,0)<=500);
 const replay=await f.issuer.issue('alice',{itemId:'creator_item',evidence:f.evidence('creator')});assert.deepEqual(replay,item);
 assert.throws(()=>verifyItemProof(catalog,{...item,effects:[{effectId:'crafting_efficiency',bps:500}]}),/proof-outcome/);
 assert.throws(()=>verifyItemProof(catalog,{...item,anchor:'forged'}),/proof-hash/);
 await assert.rejects(f.reserve('creator','new_item','creator_purchase'),/replay/);
 const transferred=await f.issuer.transfer('alice','creator_item','bob',{receiptId:'transfer_receipt_a'});assert.equal(verifyItemProof(catalog,transferred),true);
 await assert.rejects(f.issuer.proof('alice','creator_item'),/proof-denied/);
 assert.equal((await f.issuer.proof('bob','creator_item')).itemId,'creator_item');
});
test('developer policy is fixed and has no random verifier or reroll',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('developer'));await f.reserve('developer');f.paid();
 await assert.rejects(f.issuer.issue('alice',{itemId:'developer_item',evidence:{source:{},randomness:{clientRoll:true}}}),/developer-randomness-denied/);
 const item=await f.issuer.issue('alice',{itemId:'developer_item',evidence:f.evidence('developer')});
 assert.deepEqual(item.effects,[{effectId:'crafting_efficiency',bps:250}]);assert.equal(f.calls(),0);assert.equal(verifyItemProof(catalog,item),true);
});
test('quest is nontransferable, above 5% when authorized, burns once without restoring supply',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('quest'));await f.reserve('quest');
 await assert.rejects(f.issuer.issue('alice',{itemId:'quest_item',evidence:f.evidence('quest')}),/source-not-finalized/);f.quest();
 const item=await f.issuer.issue('alice',{itemId:'quest_item',evidence:f.evidence('quest')});
 assert(item.effects.reduce((n,e)=>n+e.bps,0)>500);assert.equal(item.transferable,false);
 await assert.rejects(f.issuer.transfer('alice','quest_item','bob',{receiptId:'transfer_quest'}),/transfer-denied/);
 const burned=await f.issuer.burn('alice','quest_item');assert.equal(burned.state,'burned');
 await assert.rejects(f.issuer.burn('alice','quest_item'),/burn-denied/);
 assert.equal(f.store.state.econDesigns.get('quest_design').issuedEver,1);
});
test('reject fake entropy and wrong owner, unsafe bounds and malformed source',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('creator'));await f.reserve('creator');f.paid();
 await assert.rejects(f.issuer.issue('bob',{itemId:'creator_item',evidence:f.evidence('creator')}),/intent-not-owned/);
 assert.throws(()=>unbiasedTicket('client-roll','request','a'.repeat(64),0,5),/invalid-draw/);
 assert.throws(()=>unbiasedTicket(entropy,'request','a'.repeat(64),0,0),/invalid-draw/);
 assert.throws(()=>rollModifiers(policy('developer'),entropy,'req','a'.repeat(64)),/nonrandom-origin/);
});
test('proof finality requires an independent source and bound finalized entropy',async()=>{
 const {verifyFinalizedItemProof}=await import('../src/item-issuance.js');
 const f=fixtures();await f.issuer.publish('admin',f.design('creator'));await f.reserve('creator');f.paid();
 const item=await f.issuer.issue('alice',{itemId:'creator_item',evidence:f.evidence('creator')});
 await assert.rejects(verifyFinalizedItemProof(catalog,item,{entropyReader:{verifyFinalized:async()=>({verified:false})},sourceReader:{verifySource:async()=>true}}),/randomness-unverified/);
 await assert.rejects(verifyFinalizedItemProof(catalog,item,{entropyReader:{verifyFinalized:async()=>({verified:true})},sourceReader:{verifySource:async()=>false}}),/source-unverified/);
 const reader={verifyFinalized:async intent=>({verified:true,context:intent.context,requestId:item.requestId,entropy:item.entropy,anchor:item.anchor})};
 assert.equal(await verifyFinalizedItemProof(catalog,item,{entropyReader:reader,sourceReader:{verifySource:async()=>true}}),true);
});

test('cancel is independently authorized, consumes source and releases only reservation',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('creator'));await f.reserve('creator');
 const cancelled=await f.issuer.cancel('alice','creator_item',{proof:'finalized_cancel'});
 assert.equal(cancelled.status,'cancelled');
 await assert.rejects(f.reserve('creator','other_copy','creator_purchase'),/replay/);
 assert.equal(f.store.state.econDesigns.get('creator_design').issuedEver,0);
 await f.reserve('creator','other_copy','new_source');
});
test('creator policy expected mean is evaluated with actual weights not mere midpoint',async()=>{
 const {expectedCreatorModifierBps}=await import('../src/item-issuance.js');
 assert.equal(expectedCreatorModifierBps(policy('creator')),250);
 const f=fixtures();const abnormal={...f.design('creator')};
 await f.issuer.publish('admin',abnormal);
 assert.throws(()=>expectedCreatorModifierBps(policy('developer')),/expected-origin/);
});
test('PostgreSQL JSONB transaction serialization retains cap and receipts across store recreation',async()=>{
 const {PostgresBudsStore}=await import('../src/postgres-store.js');
 let persisted={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],issued:0,burned:0};
 const pool={connect:async()=>({query:async(sql,args)=>{
   if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(persisted)}]};
   if(sql.startsWith('UPDATE highcountry_buds_state')){persisted=JSON.parse(args[1]);return {rowCount:1};}
   return {rows:[]};
 },release(){}})};
 const auth={principal:async x=>x,issuer:async()=>true,guardState:()=>true,verifyPurchase:async()=>true,verifyQuest:async()=>false,verifyTransfer:async()=>true,verifyCancellation:async()=>true};
 const reader={verifyFinalized:async intent=>({verified:true,context:intent.context,requestId:intent.randomnessRequestId,entropy,anchor:'finalized_anchor'})};
 const factory=()=>new ItemIssuance({store:new PostgresBudsStore(pool,'game_econ'),catalog,authority:auth,entropyReader:reader,clock:()=>111});
 await factory().publish('issuer',{designId:'durable_design',typeId:'artisan_bench',policyId:'creator_policy',policyRevision:1,editionCap:1,certificationRef:'cert_reviewed',creator:'alice',origin:'creator'});
 await factory().reserve('alice',{designId:'durable_design',itemId:'durable_copy',sourceId:'paid_receipt',intentNonce:'committed_nonce'});
 const result=await factory().issue('alice',{itemId:'durable_copy',evidence:{source:{receiptId:'paid_receipt'},randomness:{source:'finalized_vrf'}}});
 assert.equal(verifyItemProof(catalog,result),true);
 assert.equal((await factory().proof('alice','durable_copy')).itemId,'durable_copy');
 await assert.rejects(factory().reserve('alice',{designId:'durable_design',itemId:'another_copy',sourceId:'different_receipt',intentNonce:'other_nonce'}),/edition-unavailable/);
 assert.equal(persisted.econDesigns.length,1);
 assert.equal(persisted.econItems.length,1);
});

test('wrong independently verified request cannot substitute, nor revoke during transaction',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('creator'));await f.reserve('creator');f.paid();f.tamper();
 await assert.rejects(f.issuer.issue('alice',{itemId:'creator_item',evidence:f.evidence('creator')}),/randomness-unverified/);
 const g=fixtures();await g.issuer.publish('admin',g.design('creator'));await g.reserve('creator');g.paid();g.revoke();
 await assert.rejects(g.issuer.issue('alice',{itemId:'creator_item',evidence:g.evidence('creator')}),/session-revoked/);
 assert.equal(g.store.state.econItems?.size??0,0);
});
test('transfer receipt replay is rejected across ownership roundtrips',async()=>{
 const f=fixtures();await f.issuer.publish('admin',f.design('creator'));await f.reserve('creator');f.paid();
 await f.issuer.issue('alice',{itemId:'creator_item',evidence:f.evidence('creator')});
 await f.issuer.transfer('alice','creator_item','bob',{receiptId:'receipt_transfer_1'});
 await f.issuer.transfer('bob','creator_item','alice',{receiptId:'receipt_transfer_2'});
 await assert.rejects(f.issuer.transfer('alice','creator_item','bob',{receiptId:'receipt_transfer_1'}),/transfer-replay/);
});