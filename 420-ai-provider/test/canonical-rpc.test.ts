import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalRPCState420, type CanonicalRPCConfig420 } from '../src/canonical-rpc.js';
import { JsonRpcProvider } from 'ethers';

const addresses = {
  aiJobs: '0x0000000000000000000000000000000000000431',
  aiProviders: '0x000000000000000000000000000000000000042f',
  computeJobs: '0x0000000000000000000000000000000000000501',
  computeRequests: '0x0000000000000000000000000000000000000502',
  computeProviders: '0x0000000000000000000000000000000000000503'
};
const config: CanonicalRPCConfig420 = {chainId:420n,addresses,confirmations:3,verifiedComputeAddresses:[addresses.computeJobs,addresses.computeRequests,addresses.computeProviders]};
const rpc = new JsonRpcProvider('http://127.0.0.1:8545');

test('accepts frozen Genesis AI anchors and manifest-verified Compute contracts', () => {
  const state = new CanonicalRPCState420(rpc, config);
  assert.equal(state.addresses.aiJobs.toLowerCase(), addresses.aiJobs);
});
test('rejects historical/conflicting physical AI addresses', () => {
  assert.throws(() => new CanonicalRPCState420(rpc,{...config,addresses:{...addresses,aiJobs:'0x0000000000000000000000000000000000000420'}}),/frozen AI address mismatch/);
});
test('rejects unverified Compute contracts, duplicate addresses and unsafe finality', () => {
  assert.throws(() => new CanonicalRPCState420(rpc,{...config,verifiedComputeAddresses:[]}),/unverified Compute contract address/);
  assert.throws(() => new CanonicalRPCState420(rpc,{...config,addresses:{...addresses,computeProviders:addresses.computeJobs}}),/duplicate canonical addresses/);
  assert.throws(() => new CanonicalRPCState420(rpc,{...config,confirmations:0}),/invalid chain\/finality/);
});
test('rejects RPC chain mismatch before any canonical contract reads', async () => {
  const mismatch = {getNetwork:async()=>({chainId:421n})} as unknown as JsonRpcProvider;
  const state = new CanonicalRPCState420(mismatch,config);
  await assert.rejects(state.getCanonicalWork(('0x'+'1'.repeat(64)) as `0x${string}`,('0x'+'2'.repeat(64)) as `0x${string}`),/chain mismatch/);
});
