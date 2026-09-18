import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeQualification, buildBridgeIntent, canSubmitBridge, normalizeBridgeRoute, normalizeSettlement, settlementProgress } from '../core/bridge.js';

const route=()=>({
  routeId:'r1',exchangeAssetId:'asset1',localToken:'0xlocal',canonicalAsset:'asset:eth:1',
  sourceChain:'ethereum',destinationChain:'420',sourceAssetId:'asset:eth:1',destinationAssetId:'0xlocal',
  adapterId:'adapter1',adapterAddress:'0xadapter',verifierId:'verifier1',
  provenanceHash:'0xprov',verificationHash:'0xprov',direction:'INBOUND',
  qualified:true,representationActive:true,canonicalRepresentation:true,routeActive:true,directionEnabled:true,
  adapterLive:true,adapterMatches:true,verifierConfigured:true,settlementHealthy:true,paused:false,bridgeFee:0.42
});

test('route qualification requires every live V11 dependency',()=>{
  assert.equal(bridgeQualification(route()).ok,true);
  assert.equal(bridgeQualification({...route(),adapterMatches:false}).reason,'adapter-mismatch');
  assert.equal(bridgeQualification({...route(),verificationHash:'0xother'}).reason,'provenance-mismatch');
});

test('paused or unhealthy routes fail closed',()=>{
  assert.equal(bridgeQualification({...route(),paused:true}).reason,'paused');
  assert.equal(bridgeQualification({...route(),settlementHealthy:false}).reason,'settlement-unhealthy');
});

test('bridge intent preserves canonical route and asset identity',()=>{
  const intent=buildBridgeIntent(route(),{amount:10,recipient:'0xrecipient'});
  assert.equal(intent.kind,'BRIDGE_DEPOSIT');
  assert.equal(intent.canonicalAsset,'asset:eth:1');
  assert.equal(intent.adapterId,'adapter1');
  assert.equal(intent.quotedBridgeFee,0.42);
});

test('wallet-unavailable state blocks bridge submission',()=>{
  const r=normalizeBridgeRoute(route());
  const intent=buildBridgeIntent(r,{amount:10,recipient:'0xrecipient'});
  assert.equal(canSubmitBridge({route:r,intent,walletReady:false}).reason,'wallet-unavailable');
});

test('settlement timeline preserves attestation and proof provenance',()=>{
  const record=normalizeSettlement({settlementId:'s1',routeId:'r1',state:'PROVEN',attestationId:'a1',proofId:'p1',retryable:false});
  assert.equal(record.attestationId,'a1');
  assert.equal(record.proofId,'p1');
  assert.equal(settlementProgress(record).percent,67);
});

test('failed settlements remain inspectable and explicitly retryable or terminal',()=>{
  const record=normalizeSettlement({settlementId:'s2',routeId:'r1',state:'FAILED',retryable:true,failureReason:'proof unavailable'});
  assert.equal(record.retryable,true);
  assert.equal(settlementProgress(record).terminal,true);
});
