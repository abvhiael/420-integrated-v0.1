import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
import {ReviewerCertification,CERT_VERSION,assertCertifiedForIssuance} from '../src/reviewer-certification.js';
const key=()=>generateKeyPairSync('ed25519');
const signature=(p,privateKey)=>sign(null,Buffer.from(JSON.stringify(p)),privateKey).toString('base64');
const make=()=>{
 const store=new MemoryTransactionFixture(),pair=key();let blocked=new Set();
 store.state.econCreatorAssets=new Map([[JSON.stringify(['design',1]),{assetId:'design',revision:1,creatorId:'creator',sha256:'a'.repeat(64),metadataHash:'b'.repeat(64),publicationStatus:'unpublished'}]]);
 const authority={principal:async s=>s,guardState:(_s,_session,scope,principal)=>!blocked.has(scope)&&!(scope==='review-certify'&&principal!=='reviewer')};
 const automation={verify:async (_asset,evidence)=>evidence?.approved===true?{valid:true,evidenceId:'verified_png_01'}:{valid:false}};
 const reviews=new ReviewerCertification({store,authority,automation,clock:()=>100});
 const cert=()=>{const p={version:CERT_VERSION,certificateId:'cert_1',assignmentId:'assign_1',reviewerId:'reviewer',assetId:'design',revision:1,sha256:'a'.repeat(64),metadataHash:'b'.repeat(64),description:'A verified original floor illustration',issuedAt:100};return {...p,signature:signature(p,pair.privateKey)};};
 const design={designId:'design',certificationRef:'cert_1',creator:'creator',origin:'creator'};
 return {store,reviews,authority,automation,pair,cert,design,block:x=>blocked.add(x)};
};
async function prepared(f){await f.reviews.register('operator',{reviewerId:'reviewer',publicKey:f.pair.publicKey.export({format:'pem',type:'spki'}),expiresAt:Date.now()+86400000});await f.reviews.assign('operator',{assignmentId:'assign_1',reviewerId:'reviewer',assetId:'design',revision:1});}
test('real Ed25519 certificate, exact revision, QA separation and durable audit',async()=>{
 const f=make();await prepared(f);await assert.rejects(f.reviews.certify('reviewer',f.cert(),{approved:false}),/automation-rejected/);
 const signed=await f.reviews.certify('reviewer',f.cert(),{approved:true});assert.equal(signed.status,'pending-qa');
 assert.throws(()=>assertCertifiedForIssuance(f.store.state,f.design),/certification-not-authorized/);
 await assert.rejects(f.reviews.qa('reviewer','cert_1','approve','good evidence'),/qa-denied/);
 await f.reviews.qa('qa','cert_1','approve','verified original');assert.equal(assertCertifiedForIssuance(f.store.state,f.design),true);
 assert.equal(f.store.state.econReviewAudit.size,4);
 assert.throws(()=>assertCertifiedForIssuance(f.store.state,{...f.design,creator:'other'}),/not-authorized/);
 assert.throws(()=>assertCertifiedForIssuance(f.store.state,{...f.design,designId:'different'}),/not-authorized/);
});
test('no forged, unsigned, replayed or reassigned reviewer certification',async()=>{
 const f=make();await prepared(f);
 await assert.rejects(f.reviews.certify('intruder',f.cert(),{approved:true}),/certificate-input/);
 await assert.rejects(f.reviews.certify('reviewer',{...f.cert(),signature:''},{approved:true}),/invalid-signature/);
 await assert.rejects(f.reviews.certify('reviewer',{...f.cert(),description:'a forged replacement description'},{approved:true}),/invalid-signature/);
 await assert.rejects(f.reviews.certify('reviewer',{...f.cert(),sha256:'c'.repeat(64)},{approved:true}),/certificate-conflict/);
 await f.reviews.certify('reviewer',f.cert(),{approved:true});
 await assert.rejects(f.reviews.certify('reviewer',f.cert(),{approved:true}),/certificate-conflict/);
 await assert.rejects(f.reviews.assign('operator',{assignmentId:'assign_1',reviewerId:'reviewer',assetId:'design',revision:1}),/assignment-denied/);
});
test('suspension, revocation, disputes, appeals and scoped authority deny new issuance',async()=>{
 const f=make();await prepared(f);await f.reviews.certify('reviewer',f.cert(),{approved:true});await f.reviews.qa('qa','cert_1','approve','approved');
 await f.reviews.discipline('operator','reviewer','warn','neglect');await f.reviews.discipline('operator','reviewer','warn','repeated neglect');
 assert.equal(f.store.state.econReviewers.get('reviewer').warnings,2);
 await f.reviews.discipline('operator','reviewer','suspend','under investigation');
 assert.throws(()=>assertCertifiedForIssuance(f.store.state,f.design),/not-authorized/);
 await f.reviews.discipline('operator','reviewer','reinstate','review complete');
 const appeal=await f.reviews.dispute('creator','cert_1','appeal_1','rights complaint');assert.equal(appeal.status,'open');
 assert.throws(()=>assertCertifiedForIssuance(f.store.state,f.design),/not-authorized/);
 await assert.rejects(f.reviews.resolve('creator','appeal_1','restore','invalid appeal'),/appeal-denied/);
 await f.reviews.resolve('qa','appeal_1','restore','claim not substantiated');assert.equal(assertCertifiedForIssuance(f.store.state,f.design),true);
 f.store.state.econReviewers.get('reviewer').expiresAt=1;
 assert.throws(()=>assertCertifiedForIssuance(f.store.state,f.design),/not-authorized/);
 f.store.state.econReviewers.get('reviewer').expiresAt=Date.now()+86400000;
 await f.reviews.discipline('operator','reviewer','revoke','proven fraud');
 assert.throws(()=>assertCertifiedForIssuance(f.store.state,f.design),/not-authorized/);
});
test('serial assignment collision, QA revocation, guarded roles and retained historical evidence',async()=>{
 const f=make();await prepared(f);const [a,b]=await Promise.allSettled([f.reviews.certify('reviewer',f.cert(),{approved:true}),f.reviews.certify('reviewer',f.cert(),{approved:true})]);
 assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);
 await f.reviews.qa('qa','cert_1','approve','checked');
 f.block('review-qa');await assert.rejects(f.reviews.qa('qa','cert_1','revoke','revoked'),/authority-revoked/);f.block('review-assign');
 assert.equal(f.store.state.econCertificates.get('cert_1').status,'approved');
 assert.equal(f.store.state.econReviewAudit.size,4);
});

test('PostgreSQL JSONB persistence retains signed certification, QA and revocation across independent service recreation',async()=>{
 const f=make(),asset=[...f.store.state.econCreatorAssets];
 let persisted={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],issued:0,burned:0,econCreatorAssets:asset};
 const pool={connect:async()=>({query:async(sql,args)=>{
  if(sql.startsWith('SELECT state'))return {rows:[{state:structuredClone(persisted)}]};
  if(sql.startsWith('UPDATE highcountry_buds_state')){persisted=JSON.parse(args[1]);return {rowCount:1};}
  return {rows:[]};
 },release(){}})};
 const {PostgresBudsStore}=await import('../src/postgres-store.js');
 const factory=()=>new ReviewerCertification({store:new PostgresBudsStore(pool,'cert_game'),authority:f.authority,automation:f.automation,clock:()=>100});
 await factory().register('operator',{reviewerId:'reviewer',publicKey:f.pair.publicKey.export({format:'pem',type:'spki'}),expiresAt:Date.now()+86400000});
 await factory().assign('operator',{assignmentId:'assign_1',reviewerId:'reviewer',assetId:'design',revision:1});
 await factory().certify('reviewer',f.cert(),{approved:true});
 await factory().qa('qa','cert_1','approve','checked artwork');
 const store=new PostgresBudsStore(pool,'cert_game');
 assert.equal(await store.transact(s=>assertCertifiedForIssuance(s,f.design)),true);
 await factory().discipline('operator','reviewer','revoke','confirmed fraud');
 await assert.rejects(store.transact(s=>assertCertifiedForIssuance(s,f.design)),/certification-not-authorized/);
 assert.deepEqual(persisted.econReviewAudit.map(([,row])=>row.type),['registered','assigned','signed','qa-approve','discipline-revoke']);
 assert.equal(persisted.econCertificates[0][1].status,'approved');
});
