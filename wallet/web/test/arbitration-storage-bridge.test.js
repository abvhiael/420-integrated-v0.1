import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createArbitration420StorageBridge420} from '../core/arbitration-storage-bridge.js';
import {preparePrivateEvidence420} from '../core/arbitration-evidence.js';

const h=n=>'0x'+n.toString(16).padStart(64,'0');
const a=n=>'0x'+n.toString(16).padStart(40,'0');
const ctx={chainId:420,caseRegistry:a(301),caseId:h(501),round:0,submitter:a(100)};
const plaintext=new TextEncoder().encode('Private Arbitration case evidence, not for network logs');
const record={id:ctx.caseId,round:0,claimant:a(100),respondent:a(101),
  resolver:a(102),appealResolver:a(103),permissions:{evidence:true},history:[]};
const privateEnvelope=()=>preparePrivateEvidence420({data:plaintext,context:ctx,cryptoImpl:webcrypto});
const hex=b=>'0x'+Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const objectFor=async envelope=>{
  const payload=new TextEncoder().encode(JSON.stringify(envelope));
  return {payload,object:{object_id:'arb-001',manifest_id:'manifest-001',shard_index:0,
    shard_root:hex(new Uint8Array(await webcrypto.subtle.digest('SHA-256',payload))),
    size_bytes:payload.length,commitment_id:'storage-commit-001'}};
};
const app=()=>({
  account:a(100),
  async verify(){return {binding:{chainId:ctx.chainId,dependencies:{
    cases:{address:ctx.caseRegistry}}}};},
  async detail(id){if(id!==ctx.caseId)throw Error('case not found');return structuredClone(record);}
});
const grantFor=({context,viewer,capability,object},overrides={})=>({
  source:'420Storage',account:viewer,caseId:context.caseId,round:context.round,
  chainId:context.chainId,caseRegistry:context.caseRegistry,capability,
  storageObject:{...object},expiresAt:Date.now()+60000,
  authorization:'operator-verified-case-bound-wallet-authorization-123',
  storageSubject:'approved-wallet-storage-subject',
  storageSessionId:'approved-private-storage-session-123456',
  ...overrides
});
const fixture=async()=>{
  const sealed=await privateEnvelope(),{object,payload}=await objectFor(sealed.encrypted);
  const evidence={kind:'evidence',caseId:ctx.caseId,round:0,actor:ctx.submitter,
    details:{evidenceHash:sealed.commitment},blockNumber:2n,transactionHash:h(111)};
  record.history=[evidence];
  return {sealed,object,payload};
};
const endpoint='https://storage.420integrated.org';
const preconditions={agreement_id:'existing-agreement-01',
  capacity_reservation_id:'existing-reservation-01',
  idempotency_key:'arb-case-501-round-0',
  commitment_id:'storage-commit-001'};

test('420Storage integration remains disabled without live authority, but local file encryption works',async()=>{
  const appClient=app(),bridge=createArbitration420StorageBridge420({app:appClient,cryptoImpl:webcrypto});
  assert.equal(bridge.online,false);
  const sealed=await bridge.workspace.prepare({caseId:ctx.caseId,data:plaintext});
  assert.match(sealed.commitment,/^0x[0-9a-f]{64}$/);
  await assert.rejects(bridge.workspace.upload({caseId:ctx.caseId,round:0,
    submitter:ctx.submitter,commitment:sealed.commitment,
    encrypted:sealed.encrypted,recoveryKey:sealed.recoveryKey}),
    /approved private evidence storage unavailable/);
});

test('private Storage host and trusted issuer must both exist; no anonymous or HTTP fallback',()=>{
  for(const args of [
    {endpoint,approvedSessionIssuer:null},
    {endpoint:null,approvedSessionIssuer:async()=>({})},
    {endpoint:'http://unapproved.example',approvedSessionIssuer:async()=>({})},
    {endpoint:'https://user:pass@storage.example',approvedSessionIssuer:async()=>({})},
    {endpoint,approvedSessionIssuer:async()=>({}),uploadPort:{}}
  ])assert.throws(()=>createArbitration420StorageBridge420({app:app(),...args}),
    /Approved private 420Storage session unavailable/);
});

test('real v1 private read adapter receives only exact approved scoped session and hash-verified ciphertext',async()=>{
  const {sealed,object,payload}=await fixture(),seen=[];
  const bridge=createArbitration420StorageBridge420({
    app:app(),endpoint,cryptoImpl:webcrypto,
    approvedSessionIssuer:async scope=>grantFor(scope),
    fetchImpl:async(uri,opts)=>{
      seen.push({uri,opts});
      return new Response(payload,{headers:{'cache-control':'private, no-store'}});
    }
  });
  assert.equal(bridge.online,true);assert.equal(bridge.uploadReady,false);
  const retrieved=await bridge.workspace.retrieve({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment,object,recoveryKey:sealed.recoveryKey});
  assert.deepEqual(retrieved.bytes,plaintext);
  assert.equal(seen.length,1);
  assert.equal(seen[0].opts.headers['X-420-Access-Mode'],'private');
  assert.equal(seen[0].opts.headers['X-420-Capability'],'read');
  assert(!seen[0].uri.includes('approved-private-storage-session'));
  retrieved.bytes.fill(0);
});

test('cross-case/object/role/expired/capability/issuer-subject grants are rejected before storage fetch',async()=>{
  const {sealed,object,payload}=await fixture();
  for(const overrides of [
    {account:a(300)},{caseId:h(800)},{round:1},{chainId:421},
    {caseRegistry:a(309)},{expiresAt:Date.now()-1},
    {capability:'write'},{source:'420Identity'},
    {storageObject:{...object,object_id:'other-object'}},
    {storageSessionId:'too-short'},
  ]){
    let calls=0;
    const bridge=createArbitration420StorageBridge420({
      app:app(),endpoint,cryptoImpl:webcrypto,
      approvedSessionIssuer:async scope=>grantFor(scope,overrides),
      fetchImpl:async()=>{calls++;return new Response(payload,{headers:{'cache-control':'no-store'}});}
    });
    await assert.rejects(bridge.workspace.retrieve({caseId:ctx.caseId,round:0,
      submitter:ctx.submitter,commitment:sealed.commitment,object,
      recoveryKey:sealed.recoveryKey}),/Approved private 420Storage session unavailable|authorization/);
    assert.equal(calls,0,'refuse unapproved grant before 420Storage read');
  }
});

test('approved private 420Storage v1 prepare/ingest port uses existing preconditions, encrypted bytes only',async()=>{
  const {sealed,object,payload}=await fixture(),events=[];
  const port={
    async prepare(args){events.push(['prepare',args]);return {upload_id:'approved-storage-upload-1'};},
    async ingest(args){events.push(['ingest',args]);return {visibility:'private',object};}
  };
  const bridge=createArbitration420StorageBridge420({
    app:app(),endpoint,cryptoImpl:webcrypto,uploadPort:port,
    approvedSessionIssuer:async scope=>grantFor(scope)
  });
  assert.equal(bridge.uploadReady,true);
  const receipt=await bridge.workspace.upload({caseId:ctx.caseId,round:0,
    submitter:ctx.submitter,commitment:sealed.commitment,encrypted:sealed.encrypted,
    recoveryKey:sealed.recoveryKey,object,preconditions,retentionMs:60_000});
  assert.equal(receipt.visibility,'private');
  assert.equal(events.length,2);
  assert.deepEqual(events[0][1].preconditions,preconditions);
  assert.equal(events[0][1].grant.capability,'write');
  assert.deepEqual(events[1][1].bytes,payload);
  assert(!new TextDecoder().decode(events[1][1].bytes).includes('Private Arbitration case evidence'));
  assert.equal(record.history.length,1,'transport never modifies canonical case state');
});

test('untrusted 420ID app login alone grants neither Wallet identity nor Storage access',async()=>{
  const {sealed,object,payload}=await fixture(),events=[];
  const bridge=createArbitration420StorageBridge420({app:app(),endpoint,cryptoImpl:webcrypto,
    approvedSessionIssuer:async ()=>({
      authenticated:true,app:'420wallet',subject:'an-app-subject-only',
      permissions:[],financialAuthority:false
    }),
    fetchImpl:async()=>{events.push('leaked');return new Response(payload);}
  });
  await assert.rejects(bridge.workspace.retrieve({caseId:ctx.caseId,round:0,
    submitter:ctx.submitter,commitment:sealed.commitment,object,recoveryKey:sealed.recoveryKey}),
    /Approved private 420Storage session unavailable/);
  assert.deepEqual(events,[]);
});

test('failed private Storage route cannot change case or issue a false canonical success',async()=>{
  const {sealed,object}=await fixture(),initial=structuredClone(record.history);
  const bridge=createArbitration420StorageBridge420({
    app:app(),endpoint,cryptoImpl:webcrypto,
    approvedSessionIssuer:async scope=>grantFor(scope),
    fetchImpl:async()=>{throw Error('private server offline; recovery secret must stay hidden');}
  });
  await assert.rejects(bridge.workspace.retrieve({caseId:ctx.caseId,round:0,
    submitter:ctx.submitter,commitment:sealed.commitment,object,recoveryKey:sealed.recoveryKey}),
    error=>!String(error.message).includes('recovery secret'));
  assert.deepEqual(record.history,initial);
});
