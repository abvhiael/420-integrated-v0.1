import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_CREATION_FEE_WEI_420, TOKEN_SERVICE_ID_420, validateTokenRuntime420,
  normalizeTokenReleaseBinding420 } from '../core/token-runtime.js';
import { prepareTokenDeploymentHandoff420, buildTokenDeploymentRequest420 } from '../core/token-handoff.js';
import {fixture,addr,digest,controller,account,state,draftFor} from './token-test-fixture.js';

test('420Token runtime requires distinct verified factory, registry and Vault identities',()=>{
  const {binding}=fixture();
  assert.equal(validateTokenRuntime420(binding).factory.address,binding.factory.address);
  const bad=structuredClone(binding);bad.communityTreasuryVault.address=bad.factory.address;
  assert.throws(()=>validateTokenRuntime420(bad),/dependency alias/);
  const zeroHash=structuredClone(binding);zeroHash.templateRegistry.codeHash=digest(0);
  assert.throws(()=>validateTokenRuntime420(zeroHash),/unverified/);
  const old=structuredClone(binding);old.factory.address=addr(0x455);
  assert.throws(()=>validateTokenRuntime420(old),/reserved or retired/);
});

test('420Token runtime fails closed on wrong service, version or Vault identity',()=>{
  const {binding}=fixture();
  for(const [patch,reason] of [
    [{serviceId:'420/service/not-token/v1'},/service id/],[{version:2},/version/],
    [{communityTreasuryVaultId:'wrong'},/vault id/],[{chainId:0},/chain id/],
    [{chainId:Number.MAX_SAFE_INTEGER+1},/chain id/],
  ])assert.throws(()=>validateTokenRuntime420({...binding,...patch}),reason);
});

test('420Token handoff preserves SmartAccount420 authority and exact fee',async()=>{
  const {binding,provider,calls}=fixture();
  const r=buildTokenDeploymentRequest420(binding,draftFor());
  const prepared=await prepareTokenDeploymentHandoff420(provider,controller,state,binding,r);
  assert.equal(prepared.authority,'SmartAccount420');
  assert.equal(prepared.transaction.to,account);
  assert.equal(prepared.target,binding.factory.address);
  assert.equal(prepared.value,TOKEN_CREATION_FEE_WEI_420);
  assert.ok(calls.some(x=>x[0]==='eth_call'&&x[1][0].to===account));
  assert.ok(calls.some(x=>x[0]==='eth_estimateGas'));
  assert.ok(!calls.some(x=>x[0]==='eth_sendTransaction'));
});

test('420Token handoff rejects wrong factory, fee and empty calldata before wallet execution',async()=>{
  const {binding}=fixture(),r=buildTokenDeploymentRequest420(binding,draftFor());
  const provider={request:async()=>{throw Error('provider must not be called')}};
  for(const [patch,reason] of [
    [{target:addr(99)},/factory target/],[{value:41n*10n**18n},/exactly 42/],
    [{value:TOKEN_CREATION_FEE_WEI_420+1n},/exactly 42/],[{value:Number(TOKEN_CREATION_FEE_WEI_420)},/exactly 42/],
    [{data:'0x'},/calldata/],[{data:'0x1234'},/canonical draft/],[{data:r.data+'00'},/canonical draft/],
    [{draft:undefined},/draft required/],[{configHash:digest(9)},/canonical draft/],
    [{draft:{...r.draft,name:'changed'}},/canonical draft/],[{serviceId:'other'},/service id/]
  ])await assert.rejects(prepareTokenDeploymentHandoff420(provider,controller,state,binding,{...r,...patch}),reason);
});

test('shape-only or aliased release records cannot authorize a handoff',async()=>{
  const {binding}=fixture();
  const r=buildTokenDeploymentRequest420(binding,draftFor());
  const provider={request:async()=>{throw Error('provider must not be called')}};
  const shape=validateTokenRuntime420(binding);
  await assert.rejects(prepareTokenDeploymentHandoff420(provider,controller,state,shape,r),/Genesis V3/);
  const wrong=structuredClone(binding);wrong.vaultGraph.VaultAccounting420.address=wrong.factory.address;
  assert.throws(()=>normalizeTokenReleaseBinding420(wrong),/alias/);
  const bad=structuredClone(binding);bad.vaultGraph.AssetVault420.codeHash=digest(9);
  assert.throws(()=>normalizeTokenReleaseBinding420(bad),/Vault binding mismatch/);
  assert.throws(()=>normalizeTokenReleaseBinding420({...binding,genesisConfigHash:digest(3)}),/Genesis V3/);
});
