import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {createArbitrationEvidenceWorkspace420} from '../core/arbitration-evidence-workspace.js';
import {preparePrivateEvidence420} from '../core/arbitration-evidence.js';
const h=n=>'0x'+n.toString(16).padStart(64,'0'),a=n=>'0x'+n.toString(16).padStart(40,'0');
const ctx={chainId:420,caseRegistry:a(301),caseId:h(902),round:0,submitter:a(100)};
const document=new TextEncoder().encode('Arbitration evidence that must never be public');
function fixture(){
  const state={chain:420,allowed:true,account:a(100),history:[],id:ctx.caseId,round:0,
    claimedRound:0,submitted:false};
  const app={
    account:a(100),
    async verify(){return {binding:{chainId:state.chain,dependencies:{cases:{address:ctx.caseRegistry}}}};},
    async detail(id){
      if(id!==state.id)throw Error('UnknownCase');
      return {id:state.id,round:state.round,claimant:a(100),respondent:a(101),
        resolver:a(102),appealResolver:a(103),permissions:{evidence:state.allowed},
        history:structuredClone(state.history)};
    }
  };
  const workspace=createArbitrationEvidenceWorkspace420({app,cryptoImpl:webcrypto});
  return {state,app,workspace};
}
function receipt(sealed,context=ctx,actor=ctx.submitter){
  return {kind:'evidence',caseId:context.caseId,round:context.round,
    actor,details:{evidenceHash:sealed.commitment},blockNumber:16n,transactionHash:h(70)};
}
test('Workspace refuses missing verified Wallet case client',()=>{
  assert.throws(()=>createArbitrationEvidenceWorkspace420(),/verified Arbitration/);
});
test('Workspace prepares encrypted evidence for the actual authorized case/round and no other',async()=>{
  const {workspace,state}=fixture();
  const sealed=await workspace.prepare({caseId:ctx.caseId,data:document});
  assert.match(sealed.commitment,/^0x[0-9a-f]{64}$/);
  state.allowed=false;
  await assert.rejects(workspace.prepare({caseId:ctx.caseId,data:document}),/not permitted/);
  state.allowed=true;state.round=1;
  const appeal=await workspace.prepare({caseId:ctx.caseId,data:document});
  assert.equal(appeal.encrypted.context.round,1);
  assert.notEqual(appeal.commitment,sealed.commitment);
});
test('No private content can be inspected before an actual canonical case evidence event exists',async()=>{
  const {workspace}=fixture(),sealed=await workspace.prepare({caseId:ctx.caseId,data:document});
  await assert.rejects(workspace.inspectLocal({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment,encrypted:sealed.encrypted,recoveryKey:sealed.recoveryKey}),
    /not recorded/);
});
test('Committed evidence can be inspected by its original submitter with exact case binding',async()=>{
  const {workspace,state}=fixture(),sealed=await workspace.prepare({caseId:ctx.caseId,data:document});
  state.history.push(receipt(sealed));
  const opened=await workspace.inspectLocal({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment,encrypted:sealed.encrypted,recoveryKey:sealed.recoveryKey});
  assert.deepEqual(opened.bytes,document);
  assert.equal(opened.chainTransaction,h(70));
  assert.equal(opened.context.caseRegistry,ctx.caseRegistry);
  opened.bytes.fill(0);
});
test('a duplicated commitment in canonical history fails closed instead of selecting an ambiguous event',async()=>{
  const {workspace,state}=fixture(),sealed=await workspace.prepare({caseId:ctx.caseId,data:document});
  state.history.push(receipt(sealed),{...receipt(sealed),transactionHash:h(71)});
  await assert.rejects(workspace.verifyCommitted({caseId:ctx.caseId,round:0,
    submitter:ctx.submitter,commitment:sealed.commitment}),/ambiguous duplicate/);
});
test('Cross-case and wrong-round or wrong-user log spoofing is rejected',async()=>{
  for(const change of [
    s=>s.history.push({...receipt(s.sealed),caseId:h(903)}),
    s=>s.history.push({...receipt(s.sealed),round:1}),
    s=>s.history.push({...receipt(s.sealed),actor:a(101)}),
    s=>s.history.push({...receipt(s.sealed),details:{evidenceHash:h(100)}})
  ]){
    const f=fixture(),sealed=await f.workspace.prepare({caseId:ctx.caseId,data:document});
    f.state.sealed=sealed;change(f.state);
    await assert.rejects(f.workspace.inspectLocal({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
      commitment:sealed.commitment,encrypted:sealed.encrypted,recoveryKey:sealed.recoveryKey}),
      /not recorded/);
  }
});
test('App rechecks canonical history after decrypt; a reorg cannot bless a stale log',async()=>{
  const {workspace,state,app}=fixture(),sealed=await workspace.prepare({caseId:ctx.caseId,data:document});
  state.history.push(receipt(sealed));
  const original=app.detail;
  let reads=0;
  app.detail=async id=>{const result=await original(id);reads++;
    if(reads>=2)result.history=[];return result;};
  await assert.rejects(workspace.inspectLocal({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment,encrypted:sealed.encrypted,recoveryKey:sealed.recoveryKey}),
    /authorization or chain history changed/);
});
test('Observer cannot inspect or upload evidence even when holding ciphertext and a recovery key',async()=>{
  const {app,state}=fixture();
  const sealed=await preparePrivateEvidence420({data:document,context:ctx,cryptoImpl:webcrypto});
  state.history.push(receipt(sealed));
  app.account=a(999);
  const outsider=createArbitrationEvidenceWorkspace420({app,cryptoImpl:webcrypto});
  await assert.rejects(outsider.inspectLocal({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment,encrypted:sealed.encrypted,recoveryKey:sealed.recoveryKey}),
    /authorization required/);
  await assert.rejects(outsider.upload({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment,encrypted:sealed.encrypted}),/authorization required/);
});
test('Missing approved storage rejects upload/download without altering case record',async()=>{
  const {workspace,state}=fixture(),sealed=await workspace.prepare({caseId:ctx.caseId,data:document});
  state.history.push(receipt(sealed));
  const initial=structuredClone(state.history);
  await assert.rejects(workspace.upload({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment,encrypted:sealed.encrypted}),/approved private evidence storage unavailable/);
  await assert.rejects(workspace.retrieve({caseId:ctx.caseId,round:0,submitter:ctx.submitter,
    commitment:sealed.commitment}),/approved private evidence storage unavailable/);
  assert.deepEqual(state.history,initial);
});
test('Storage retrieval must recheck same chain log and provide scoped grant',async()=>{
  const {app,state}=fixture();
  const sealed=await preparePrivateEvidence420({data:document,context:ctx,cryptoImpl:webcrypto});
  state.history.push(receipt(sealed));
  const object={object_id:'o',manifest_id:'m',shard_index:0,shard_root:h(6),
    size_bytes:100,commitment_id:'c'};
  let reads=0;
  const workspace=createArbitrationEvidenceWorkspace420({app,cryptoImpl:webcrypto,
    storage:{async retrieve(){
      reads++;return {visibility:'private',object,bytes:new TextEncoder().encode(JSON.stringify(sealed.encrypted))};
    }},
    authenticate:async()=>({account:a(100),caseId:ctx.caseId,round:0,chainId:420,
      caseRegistry:ctx.caseRegistry,expiresAt:Date.now()+5000,
      authorization:'420ID-private-scoped-authenticated-session',capability:'read',storageObject:object,
      storageSubject:'test-scoped-subject',storageSessionId:'test-private-session-12345678'})});
  const result=await workspace.retrieve({caseId:ctx.caseId,round:0,submitter:a(100),
    commitment:sealed.commitment,object,recoveryKey:sealed.recoveryKey});
  assert.deepEqual(result.bytes,document);
  assert.equal(reads,1);
  result.bytes.fill(0);
  state.history=[];
  await assert.rejects(workspace.retrieve({caseId:ctx.caseId,round:0,submitter:a(100),
    commitment:sealed.commitment,object,recoveryKey:sealed.recoveryKey}),/not recorded/);
  assert.equal(reads,1,'do not access private provider without canonical log');
});
