import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
  ARBITRATION_EVIDENCE_DOMAIN_420,ARBITRATION_EVIDENCE_MAX_BYTES_420,
  evidenceCommitment420,hashPrivateEvidence420,preparePrivateEvidence420,
  verifyPrivateEvidence420,normalizeEvidenceContext420,authorizeEvidenceViewer420,
  createPrivateEvidenceStore420,normalizePrivateEvidenceReceipt420
} from '../core/arbitration-evidence.js';
const h=n=>'0x'+n.toString(16).padStart(64,'0');
const a=n=>'0x'+n.toString(16).padStart(40,'0');
const context={chainId:420,caseRegistry:a(301),caseId:h(901),round:0,submitter:a(100)};
const alice=a(100),bob=a(101),resolver=a(102);
const data=new TextEncoder().encode('Highly confidential arbitration evidence');
const prep=()=>preparePrivateEvidence420({data,context,cryptoImpl:webcrypto});
const open=(sealed,options={})=>verifyPrivateEvidence420({encrypted:sealed.encrypted,
  recoveryKey:sealed.recoveryKey,context,expectedCommitment:sealed.commitment,
  cryptoImpl:webcrypto,...options});
const record={id:context.caseId,round:0,claimant:alice,respondent:bob,
  resolver,appealResolver:a(103)};
const grant=(viewer,expiry=Date.now()+60000)=>({account:viewer,caseId:context.caseId,
  round:0,chainId:420,caseRegistry:context.caseRegistry,expiresAt:expiry,
  authorization:'420ID-verified-private-authorization-123'});
const object={object_id:'obj1',manifest_id:'manifest1',shard_index:0,
  shard_root:h(4),size_bytes:320,commitment_id:'storage-commit1'};
test('domain-separated salted commitment is deterministic for identical exact context, digest, salt',async()=>{
  const digest=await hashPrivateEvidence420(data,{cryptoImpl:webcrypto}),salt=h(300);
  const commitment=evidenceCommitment420(context,digest,salt);
  assert.equal(commitment,evidenceCommitment420(context,digest,salt));
  assert.match(commitment,/^0x[0-9a-f]{64}$/);
  assert.match(ARBITRATION_EVIDENCE_DOMAIN_420,/^0x[0-9a-f]{64}$/);
  assert.notEqual(commitment,evidenceCommitment420({...context,round:1},digest,salt));
  assert.notEqual(commitment,evidenceCommitment420({...context,caseId:h(902)},digest,salt));
  assert.notEqual(commitment,evidenceCommitment420({...context,submitter:bob},digest,salt));
  assert.notEqual(commitment,evidenceCommitment420({...context,chainId:421},digest,salt));
  assert.notEqual(commitment,evidenceCommitment420({...context,caseRegistry:a(302)},digest,salt));
  assert.notEqual(commitment,evidenceCommitment420(context,digest,h(301)));
});
test('random nonces make equal private documents non-linkable by public commitment',async()=>{
  const first=await prep(),second=await prep();
  assert.notEqual(first.commitment,second.commitment);
  assert.notEqual(first.encrypted.ciphertext,second.encrypted.ciphertext);
  assert.notEqual(first.recoveryKey,second.recoveryKey);
  assert.equal(first.encrypted.access,'private');
  assert.equal(first.encrypted.contentType,'application/octet-stream');
  assert(!JSON.stringify(first.encrypted).includes('Highly confidential'));
  assert(!JSON.stringify(first).includes('Highly confidential'));
});
test('successful local decryption verifies exact file bytes, SHA256 and case AAD',async()=>{
  const sealed=await prep();
  const raw=await open(sealed);
  assert.deepEqual(raw,data);
  assert.equal(sealed.encrypted.sizeBytes,data.length);
  assert.equal(sealed.encrypted.digest,await hashPrivateEvidence420(data,{cryptoImpl:webcrypto}));
});
test('tampered ciphertext, IV, digest, wrong key and changed commitment all fail closed',async()=>{
  const sealed=await prep();
  for(const mutation of [
    p=>({...p,ciphertext:p.ciphertext.slice(0,-2)+'aa'}),
    p=>({...p,iv:'0x'+'ab'.repeat(12)}),
    p=>({...p,digest:h(44)}),
    p=>({...p,commitment:h(80)}),
    p=>({...p,sizeBytes:p.sizeBytes+1}),
    p=>({...p,access:'public'}),
    p=>({...p,context:{...p.context,round:1}})
  ])await assert.rejects(open({...sealed,encrypted:mutation(sealed.encrypted)}),
    /Private evidence unavailable/);
  await assert.rejects(open(sealed,{recoveryKey:h(700)}),/Private evidence unavailable/);
  await assert.rejects(open(sealed,{expectedCommitment:h(700)}),/Private evidence unavailable/);
});
test('cross-case, user, round, chain and registry substitution never decrypts',async()=>{
  const s=await prep();
  for(const c of [{...context,caseId:h(150)},{...context,submitter:bob},
    {...context,round:1},{...context,chainId:421},{...context,caseRegistry:a(400)}])
    await assert.rejects(open(s,{context:c}),/Private evidence unavailable/);
});
test('input buffers are copied and neither raw plaintext nor decryption key enters the envelope',async()=>{
  const original=new Uint8Array(data);const sealed=await preparePrivateEvidence420({
    data:original,context,cryptoImpl:webcrypto,nonce:new Uint8Array(32).fill(8)});
  assert.deepEqual(original,data);
  assert.equal(Object.hasOwn(sealed.encrypted,'recoveryKey'),false);
  assert.equal(Object.hasOwn(sealed.encrypted,'key'),false);
  assert.equal(sealed.commitment,evidenceCommitment420(context,sealed.encrypted.digest,sealed.encrypted.nonce));
  assert.deepEqual(await open(sealed),data);
});
test('empty, oversized and invalid file inputs are rejected without uploading',async()=>{
  for(const raw of [new Uint8Array(0),new Uint8Array(ARBITRATION_EVIDENCE_MAX_BYTES_420+1)])
    await assert.rejects(preparePrivateEvidence420({data:raw,context,cryptoImpl:webcrypto}),/invalid evidence size/);
  await assert.rejects(preparePrivateEvidence420({data,context,cryptoImpl:null}),/secure evidence cryptography/);
  await assert.rejects(preparePrivateEvidence420({data,context,cryptoImpl:webcrypto,nonce:new Uint8Array(32)}),/invalid evidence nonce/);
});
test('viewer must be an on-chain party or selected resolver with exact scoped, unexpired authorization',()=>{
  assert.equal(authorizeEvidenceViewer420({context,record,viewer:alice,grant:grant(alice)}),true);
  assert.equal(authorizeEvidenceViewer420({context,record,viewer:resolver,grant:grant(resolver)}),true);
  for(const [viewer,g,r] of [
    [a(444),grant(a(444)),record],[alice,null,record],
    [alice,{...grant(alice),expiresAt:Date.now()-1},record],
    [alice,{...grant(alice),caseId:h(300)},record],
    [alice,{...grant(alice),round:1},record],
    [alice,{...grant(alice),account:bob},record],
    [alice,grant(alice),{...record,id:h(200)}]
  ])assert.throws(()=>authorizeEvidenceViewer420({context,record:r,viewer,grant:g}),
    /authorization|required|mismatch/);
});
test('missing storage provider and authorization fail without producing network calls',async()=>{
  const sealed=await prep(),verify=async()=>grant(alice);
  const store=createPrivateEvidenceStore420({storage:null,authenticate:verify});
  await assert.rejects(store.upload({encrypted:sealed.encrypted,context,record,
    viewer:alice,object,retentionMs:1000}),/storage unavailable/);
  await assert.rejects(store.retrieve({context,record,viewer:alice,object,
    expectedCommitment:sealed.commitment,recoveryKey:sealed.recoveryKey}),/storage unavailable/);
  assert.throws(()=>createPrivateEvidenceStore420(),/session verifier/);
});
test('storage prepared/ingested ciphertext only after exact scoped authorization',async()=>{
  const sealed=await prep(),calls=[];
  const storage={
    async prepare(args){calls.push(['prepare',args]);return {upload_id:'u1'};},
    async ingest(args){calls.push(['ingest',args]);return {object,visibility:'private'};}
  };
  const store=createPrivateEvidenceStore420({storage,authenticate:async()=>grant(alice)});
  const receipt=await store.upload({encrypted:sealed.encrypted,context,record,
    viewer:alice,object,retentionMs:3600000});
  assert.equal(receipt.visibility,'private');assert.equal(calls.length,2);
  const payload=new TextDecoder().decode(calls[1][1].bytes);
  assert.equal(JSON.parse(payload).commitment,sealed.commitment);
  assert(!payload.includes('Highly confidential'));
  assert(!Object.keys(calls[0][1]).includes('recoveryKey'));
  assert.equal(calls[1][1].metadata.visibility,'private');
});
test('interrupted upload and provider errors never constitute successful storage or chain state',async()=>{
  const sealed=await prep(),controller=new AbortController(),calls=[];
  const storage={
    async prepare(){calls.push('prepare');controller.abort();return {upload_id:'u1'};},
    async ingest(){calls.push('ingest');return {object,visibility:'private'};}
  };
  const store=createPrivateEvidenceStore420({storage,authenticate:async()=>grant(alice)});
  await assert.rejects(store.upload({encrypted:sealed.encrypted,context,record,viewer:alice,
    object,retentionMs:5000,signal:controller.signal}),/unavailable or interrupted/);
  assert.deepEqual(calls,['prepare']);
  const corrupt=createPrivateEvidenceStore420({storage:{
    async prepare(){return {upload_id:'u1'};},async ingest(){return {object,visibility:'public'};}
  },authenticate:async()=>grant(alice)});
  await assert.rejects(corrupt.upload({encrypted:sealed.encrypted,context,record,viewer:alice,
    object,retentionMs:5000}),/unavailable or interrupted/);
});
test('storage retrieval validates private object identity and ciphertext then decrypts',async()=>{
  const sealed=await prep(),calls=[];
  const storage={async retrieve(args){calls.push(args);return {visibility:'private',object,
    bytes:new TextEncoder().encode(JSON.stringify(sealed.encrypted))};}};
  const store=createPrivateEvidenceStore420({storage,authenticate:async()=>grant(alice)});
  const result=await store.retrieve({context,record,viewer:alice,object,
    expectedCommitment:sealed.commitment,recoveryKey:sealed.recoveryKey});
  assert.deepEqual(result,data);
  assert.equal(calls[0].mode,'private');
  assert.equal(calls[0].grant.account,alice);
});
test('unavailable, expired, wrong-object, public or corrupted retrieval fails securely',async()=>{
  const sealed=await prep();
  for(const response of [
    null,{visibility:'public',object,bytes:new Uint8Array([1])},
    {visibility:'private',object:{...object,object_id:'wrong'},bytes:new Uint8Array([1])},
    {visibility:'private',object,bytes:new TextEncoder().encode('not json')},
    {visibility:'private',object,bytes:new TextEncoder().encode(JSON.stringify({...sealed.encrypted,commitment:h(99)}))}
  ]){
    const store=createPrivateEvidenceStore420({storage:{retrieve:async()=>response},
      authenticate:async()=>grant(alice)});
    await assert.rejects(store.retrieve({context,record,viewer:alice,object,
      expectedCommitment:sealed.commitment,recoveryKey:sealed.recoveryKey}),/Private evidence unavailable/);
  }
  const expired=createPrivateEvidenceStore420({storage:{retrieve:async()=>{throw Error('should not reach');}},
    authenticate:async()=>grant(alice,Date.now()-1000)});
  await assert.rejects(expired.retrieve({context,record,viewer:alice,object,
    expectedCommitment:sealed.commitment,recoveryKey:sealed.recoveryKey}),/authorization required/);
});
test('storage errors do not disclose private payload content or credentials',async()=>{
  const sealed=await prep();
  const store=createPrivateEvidenceStore420({storage:{
    async retrieve(){throw Error('Highly confidential arbitration evidence secret authorization='+
      '420ID-verified-private-authorization-123');}
  },authenticate:async()=>grant(alice)});
  await assert.rejects(store.retrieve({context,record,viewer:alice,object,
    expectedCommitment:sealed.commitment,recoveryKey:sealed.recoveryKey}),e=>
      !String(e.message).includes('Highly confidential')&&
      !String(e.message).includes('420ID-verified-private-authorization-123'));
});
test('storage receipt full six-field identity enforced even for private mode',()=>{
  assert.deepEqual(normalizePrivateEvidenceReceipt420({object,visibility:'private'},object).object,object);
  for(const k of Object.keys(object))assert.throws(()=>normalizePrivateEvidenceReceipt420(
    {object:{...object,[k]:'fake'},visibility:'private'},object),/identity mismatch/);
  assert.throws(()=>normalizePrivateEvidenceReceipt420({object,visibility:'public'},object),/visibility/);
});
