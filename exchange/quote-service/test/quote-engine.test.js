import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createQuoteEngine,SIGNER_ROTATION_MODEL} from '../src/quote-engine.js';
import {createStaticChainAdapter,createStaticRouteSource} from '../src/adapters.js';
import {validateRequest} from '../src/validation.js';
import {testSigner} from './test-auth.js';

const vector=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../fixtures/pre04-vector-v1.json'),'utf8'));
function engine({route=vector.route,assets=vector.assets,feeBps=vector.feeBps,deploymentId=vector.deploymentId,manifestHash=vector.manifestHash,observedAt=1000,clock=()=>1000,chainId=vector.chainId,maxRouteHops=8}={}){
  return createQuoteEngine({
    chainId,router:vector.router,spender:vector.spender,deploymentId,manifestHash,maxRouteHops,clock,
    routeSource:createStaticRouteSource({routes:[route]}),
    chainAdapter:createStaticChainAdapter({assets,feeBps,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash},chainId,observedAt}),
    signer:testSigner(),
  });
}
test('PRE-04 deterministic offline vector emits complete canonical quote',async()=>{
  const request=validateRequest(vector.request),quote=await engine()(request);
  assert.equal(quote.schema,'420-exchange-executable-swap-quote-v1');
  assert.equal(quote.quoteId,vector.expected.quoteId);
  assert.match(quote.replayDomain,/^0x[0-9a-f]{64}$/);
  assert.equal(quote.reviewedIntent.routeCommitment,vector.expected.expectedPathHash);
  assert.equal(quote.execution.expectedPathHash,vector.expected.expectedPathHash);
  assert.equal(quote.quoteEconomics.grossAmountOutRaw,vector.expected.grossAmountOutRaw);
  assert.equal(quote.quoteEconomics.feeAmountRaw,vector.expected.feeAmountRaw);
  assert.equal(quote.quoteEconomics.netAmountOutRaw,vector.expected.netAmountOutRaw);
  assert.equal(quote.expiresAt,vector.expected.expiresAt);
  assert.equal(quote.deployment.deploymentId,vector.deploymentId);
  assert.equal(quote.deployment.manifestHash,vector.manifestHash);
  assert.equal(quote.deployment.router,vector.router);
  assert.equal(quote.builder.router,vector.router);
  assert.equal(quote.builder.spender,vector.spender);
  assert.equal(quote.builder.value,'0x0');
  assert.equal(quote.producer.authentication,'ED25519_PRE05');
  assert.equal(quote.producer.algorithm,'Ed25519');
  assert.equal(quote.authentication.algorithm,'Ed25519');
  assert.match(quote.authentication.signature,/^[A-Za-z0-9_-]+$/);
  assert.match(quote.transactionFingerprint,/^0x[0-9a-f]{64}$/);
  assert.equal(quote.marketSource,'api');assert.equal(quote.demo,false);assert.equal(quote.fixture,false);
});
test('PRE-04 quote output is deterministic for same inputs, source state and clock',async()=>{
  const request=validateRequest(vector.request),a=await engine()(request),b=await engine()(request);
  assert.deepEqual(a,b);
});
test('PRE-04 rejects stale/wrong-chain inputs, deployment mismatch and invalid fee policy',async()=>{
  const request=validateRequest(vector.request);
  await assert.rejects(engine({observedAt:900})(request),e=>e.code==='STALE_INPUT');
  await assert.rejects(engine({route:{...vector.route,observedAt:900}})(request),e=>e.code==='STALE_INPUT');
  const wrongChainAdapter=createStaticChainAdapter({assets:vector.assets,feeBps:vector.feeBps,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash},chainId:'0x421',observedAt:1000});
  await assert.rejects(createQuoteEngine({chainId:vector.chainId,router:vector.router,spender:vector.spender,deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,clock:()=>1000,routeSource:createStaticRouteSource({routes:[vector.route]}),chainAdapter:wrongChainAdapter,signer:testSigner()})(request),e=>e.code==='CHAIN_MISMATCH');
  await assert.rejects(engine({deploymentId:'0x'+'ff'.repeat(32)})(request),e=>e.code==='DEPLOYMENT_MISMATCH');
  await assert.rejects(engine({feeBps:101})(request),e=>e.code==='FEE_POLICY_INVALID');
});
test('PRE-04 rejects unsupported route, oversized route, invalid token metadata and unmet minimum',async()=>{
  const request=validateRequest(vector.request);
  await assert.rejects(engine({route:{...vector.route,tokenOut:'0x'+'99'.repeat(20)}})(request),e=>e.code==='UNSUPPORTED_ROUTE');
  await assert.rejects(engine({route:{...vector.route,hops:[...vector.route.hops,...vector.route.hops,...vector.route.hops]},maxRouteHops:2})(request),e=>e.code==='UNSUPPORTED_ROUTE');
  await assert.rejects(engine({route:{...vector.route,hops:[{...vector.route.hops[0],routeData:'0x'+'aa'.repeat(5000)}]}})(request),e=>e.code==='UNSUPPORTED_ROUTE');
  await assert.rejects(engine({assets:[{...vector.assets[0],verified:false},vector.assets[1]]})(request),e=>e.code==='INVALID_TOKEN_METADATA');
  await assert.rejects(engine({route:{...vector.route,grossAmountOutRaw:'4000000',hops:[{...vector.route.hops[0],amountOutRaw:'4000000',minAmountOutRaw:'3900000'}]}})(request),e=>e.code==='MINIMUM_OUTPUT_UNMET');
});
test('PRE-04 provider-neutral adapters fail closed when dependencies are absent',async()=>{
  const request=validateRequest(vector.request);
  await assert.rejects(createQuoteEngine({
    chainId:vector.chainId,router:vector.router,deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,
    routeSource:{quoteExactInput:async()=>{throw Object.assign(Error('route outage'),{code:'ROUTE_SOURCE_UNAVAILABLE'});}},
    chainAdapter:{snapshot:async()=>({assets:{input:vector.assets[0],output:vector.assets[1]},feeBps:25,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash}})},
    clock:()=>1000,signer:testSigner(),
  })(request),/route outage/);
});
test('PRE-05 signer rotation model is policy-driven and excludes repository private keys',()=>{
  assert.equal(SIGNER_ROTATION_MODEL.status,'PRE05_IMPLEMENTED_POLICY_DRIVEN');
  assert.equal(SIGNER_ROTATION_MODEL.privateKeyStorage,'EXTERNAL_INJECTED_SIGNER_ONLY');
  assert.equal(SIGNER_ROTATION_MODEL.overlap,'BOUNDED_BY_CLIENT_POLICY');
  assert.equal(SIGNER_ROTATION_MODEL.revocation,'EXPLICIT_EPOCH_AND_REVOKED_FLAG');
});

test('PRE-05 quote engine refuses to start without an authenticated signer',()=>{
  assert.throws(()=>createQuoteEngine({
    chainId:vector.chainId,router:vector.router,spender:vector.spender,deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,
    routeSource:createStaticRouteSource({routes:[vector.route]}),
    chainAdapter:createStaticChainAdapter({assets:vector.assets,feeBps:vector.feeBps,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash},chainId:vector.chainId,observedAt:1000}),
  }),e=>e.code==='SERVICE_CONFIG_INVALID');
});
