import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BridgeLifecycleController,BridgeLifecycleError,bridgeManifestFingerprint,bridgeReplayKey,
  canonicalBridgeManifest,canonicalBridgeTransfer,createMemoryReplayGuard,createProofProviderAdapter,reconcileBridgeProjection,
} from '../core/bridge-lifecycle.js';

const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const manifest=Object.freeze({
  routeId:id(1),sourceAdapterId:id(2),destinationAdapterId:id(3),verifierId:id(4),verifierConfigHash:id(5),manifestId:id(6),
  sourceChainId:'0x420',destinationChainId:'0x421',sourceAssetId:id(7),destinationAssetId:id(8),canonicalAssetId:id(9),
  sourceGateway:addr(10),destinationGateway:addr(11),version:1,
});
const transfer=Object.freeze({
  manifest,sender:addr(12),beneficiary:addr(13),amountRaw:'420000000',replayDomain:id(14),expiresAt:2000,
});
const source={txHash:id(21),blockHash:id(22),messageId:id(23)};
const destination={txHash:id(31),blockHash:id(32),transferId:id(33)};
function proof(overrides={}){
  return {
    schema:'420-exchange-bridge-proof-v1',proofId:id(40),proofBytes:'0x1234',
    sourceChainId:'0x420',destinationChainId:'0x421',sourceTxHash:source.txHash,sourceBlockHash:source.blockHash,sourceMessageId:source.messageId,
    routeId:manifest.routeId,sourceAdapterId:manifest.sourceAdapterId,destinationAdapterId:manifest.destinationAdapterId,
    verifierId:manifest.verifierId,manifestFingerprint:bridgeManifestFingerprint(manifest),
    beneficiary:transfer.beneficiary,amountRaw:transfer.amountRaw,sourceAssetId:manifest.sourceAssetId,destinationAssetId:manifest.destinationAssetId,
    replayDomain:transfer.replayDomain,...overrides,
  };
}
async function controller({proofResult=proof(),replayGuard=createMemoryReplayGuard(),projectionReader=null,clock=()=>1000}={}){
  return new BridgeLifecycleController({
    transfer,proofProvider:createProofProviderAdapter(async()=>proofResult),replayGuard,projectionReader,clock,
  });
}
async function throughProof(c){
  c.prepareSource();c.sourceSubmitted({txHash:source.txHash});c.sourceFinalized(source);await c.requestProof();c.verifyProof();await c.prepareDestination();
}
async function throughDestination(c){
  await throughProof(c);c.destinationSubmitted({txHash:destination.txHash});c.destinationFinalized(destination);
}

test('PRE-09 canonical manifest binds route adapters verifier manifest chains assets and gateways',()=>{
  const m=canonicalBridgeManifest(manifest);
  assert.equal(m.routeId,manifest.routeId);assert.equal(m.verifierConfigHash,manifest.verifierConfigHash);
  assert.equal(m.sourceChainId,'0x420');assert.equal(m.destinationChainId,'0x421');
  assert.match(bridgeManifestFingerprint(m),/^0x[0-9a-f]{64}$/);
  assert.throws(()=>canonicalBridgeManifest({...manifest,destinationChainId:'0x420'}),e=>e.code==='SAME_CHAIN');
});

test('two-chain mock E2E proves exact beneficiary payout and canonical destination state',async()=>{
  const c=await controller();
  await throughDestination(c);
  const settled=await c.confirmSettlement({
    beneficiary:transfer.beneficiary,amountRaw:transfer.amountRaw,destinationAssetId:manifest.destinationAssetId,transferId:destination.transferId,paid:true,
  });
  assert.equal(settled.state,'SETTLED');
  assert.equal(settled.settlement.beneficiary,transfer.beneficiary);
  assert.equal(settled.settlement.amountRaw,transfer.amountRaw);
  assert.equal(settled.settlement.destinationAssetId,manifest.destinationAssetId);
});

test('replay domain plus source message rejects a second destination claim',async()=>{
  const guard=createMemoryReplayGuard();
  const first=await controller({replayGuard:guard});await throughDestination(first);
  await first.confirmSettlement({beneficiary:transfer.beneficiary,amountRaw:transfer.amountRaw,destinationAssetId:manifest.destinationAssetId,transferId:destination.transferId,paid:true});
  const second=await controller({replayGuard:guard});
  second.prepareSource();second.sourceSubmitted({txHash:source.txHash});second.sourceFinalized(source);await second.requestProof();second.verifyProof();
  await assert.rejects(second.prepareDestination(),e=>e.code==='REPLAY');
  assert.equal(await guard.isConsumed(bridgeReplayKey(canonicalBridgeTransfer(transfer),{sourceMessageId:source.messageId})),true);
});

test('proof binding rejects beneficiary amount route adapter verifier asset and replay substitutions',async()=>{
  for(const bad of [
    {beneficiary:addr(99)},{amountRaw:'1'},{routeId:id(99)},{destinationAdapterId:id(99)},{verifierId:id(99)},
    {destinationAssetId:id(99)},{replayDomain:id(99)},{sourceMessageId:id(99)},{manifestFingerprint:id(99)},
  ]){
    const c=await controller({proofResult:proof(bad)});
    c.prepareSource();c.sourceSubmitted({txHash:source.txHash});c.sourceFinalized(source);
    await assert.rejects(c.requestProof(),e=>e.code==='PROOF_BINDING_MISMATCH');
  }
});

test('source finality is required before proof availability and destination claim',async()=>{
  const c=await controller();c.prepareSource();c.sourceSubmitted({txHash:source.txHash});
  await assert.rejects(c.requestProof(),e=>e.code==='STATE_MISMATCH');
  assert.throws(()=>c.destinationSubmitted({txHash:destination.txHash}),e=>e.code==='STATE_MISMATCH');
});

test('pause resume expiry proof invalidation and retry-safe states are explicit',async()=>{
  let now=1000;
  const c=await controller({clock:()=>now});
  c.prepareSource();assert.equal(c.pause().state,'PAUSED');assert.equal(c.resume().state,'SOURCE_READY');
  c.sourceSubmitted({txHash:source.txHash});c.sourceFinalized(source);await c.requestProof();
  assert.equal(c.invalidateProof('operator-revoked').state,'PROOF_INVALIDATED');
  assert.equal(c.retry('new-proof').state,'RETRYABLE');
  await c.requestProof();c.verifyProof();
  now=2000;
  await assert.rejects(c.prepareDestination(),e=>e.code==='TRANSFER_EXPIRED');
  assert.equal(c.state,'EXPIRED');
});

test('source and destination reorgs invalidate forward progress and remain retry-safe',async()=>{
  const sourceReorg=await controller();sourceReorg.prepareSource();sourceReorg.sourceSubmitted({txHash:source.txHash});sourceReorg.sourceFinalized(source);
  assert.equal(sourceReorg.sourceReorged().state,'RETRYABLE');assert.equal(sourceReorg.proof,null);

  const destReorg=await controller();await throughDestination(destReorg);
  assert.equal(destReorg.destinationReorged().state,'RETRYABLE');assert.equal(destReorg.settlement,null);
});

test('refund and recovery states are explicit and terminally separate from payout',async()=>{
  const c=await controller();c.prepareSource();c.sourceSubmitted({txHash:source.txHash});
  assert.equal(c.refundPending('source-timeout').state,'REFUND_PENDING');
  const refunded=c.refunded({refundId:id(88)});
  assert.equal(refunded.state,'REFUNDED');
  assert.throws(()=>c.retry(),e=>e.code==='STATE_MISMATCH');
});

test('indexed bridge reconciliation preserves canonicality and detects beneficiary/amount/reorg conflicts',()=>{
  const t=canonicalBridgeTransfer(transfer);
  const good={recordId:'bridge-1',manifestFingerprint:t.manifestFingerprint,replayDomain:t.replayDomain,routeId:manifest.routeId,
    beneficiary:t.beneficiary,amountRaw:t.amountRaw,destinationAssetId:manifest.destinationAssetId,txHash:destination.txHash,active:true};
  assert.equal(reconcileBridgeProjection({transfer:t,destinationTxHash:destination.txHash,records:[good]}).status,'CANONICAL');
  const conflict={...good,recordId:'bridge-2',beneficiary:addr(99),amountRaw:'1'};
  const bad=reconcileBridgeProjection({transfer:t,destinationTxHash:destination.txHash,records:[conflict]});
  assert.equal(bad.status,'CONFLICTING');assert.ok(bad.conflicts.includes('beneficiary-conflict'));assert.ok(bad.conflicts.includes('amount-conflict'));
  const orphan={...good,active:false};
  assert.ok(reconcileBridgeProjection({transfer:t,destinationTxHash:destination.txHash,records:[orphan]}).conflicts.includes('destination-reorg'));
});

test('projection reader drives indexer delayed/conflicting lifecycle without becoming settlement authority',async()=>{
  let records=[];
  const c=await controller({projectionReader:async()=>records});
  c.prepareSource();c.sourceSubmitted({txHash:source.txHash});c.sourceFinalized(source);
  const delayed=await c.reconcile();assert.equal(delayed.status,'UNINDEXED');assert.equal(c.state,'INDEXER_DELAYED');

  const c2=await controller({projectionReader:async()=>[{
    manifestFingerprint:bridgeManifestFingerprint(manifest),replayDomain:transfer.replayDomain,beneficiary:addr(99),amountRaw:transfer.amountRaw,active:true,
  }]});
  c2.prepareSource();c2.sourceSubmitted({txHash:source.txHash});c2.sourceFinalized(source);
  const conflict=await c2.reconcile();assert.equal(conflict.status,'CONFLICTING');assert.equal(c2.state,'INDEXER_CONFLICTING');
});

test('destination payout verification fails closed on wrong beneficiary asset amount transfer or unpaid state',async()=>{
  for(const settlement of [
    {beneficiary:addr(99),amountRaw:transfer.amountRaw,destinationAssetId:manifest.destinationAssetId,transferId:destination.transferId,paid:true},
    {beneficiary:transfer.beneficiary,amountRaw:'1',destinationAssetId:manifest.destinationAssetId,transferId:destination.transferId,paid:true},
    {beneficiary:transfer.beneficiary,amountRaw:transfer.amountRaw,destinationAssetId:id(99),transferId:destination.transferId,paid:true},
    {beneficiary:transfer.beneficiary,amountRaw:transfer.amountRaw,destinationAssetId:manifest.destinationAssetId,transferId:id(99),paid:true},
    {beneficiary:transfer.beneficiary,amountRaw:transfer.amountRaw,destinationAssetId:manifest.destinationAssetId,transferId:destination.transferId,paid:false},
  ]){
    const c=await controller();await throughDestination(c);
    await assert.rejects(Promise.resolve().then(()=>c.confirmSettlement(settlement)),e=>e instanceof BridgeLifecycleError&&e.code==='SETTLEMENT_MISMATCH');
  }
});
