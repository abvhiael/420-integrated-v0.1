import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGasSponsorGrantRequest,
  prepareGasSponsorGrantCreation,
  sendGasSponsorGrantCreation,
} from '../core/capability-management.js';

const owner = '0x1111111111111111111111111111111111111111';
const account = '0x3333333333333333333333333333333333333333';
const sponsor = '0x7777777777777777777777777777777777777777';
const registry = '0x0000000000000000000000000000000000000421';
const operation = `0x${'12'.repeat(32)}`;
const grantId = `0x${'34'.repeat(32)}`;
const txHash = `0x${'ab'.repeat(32)}`;
const smartAccountState = {
  deployed: true,
  controllerIsOwner: true,
  owner,
  smartAccount: account,
  capabilityRegistry: registry,
};

const request = {
  sponsor,
  operation,
  perCallLimit: '42',
  periodLimit: '420',
  periodSeconds: '86400',
  validFrom: '0',
  validUntil: '0',
};

test('gas sponsor grant request validates bounded period configuration', () => {
  const normalized = normalizeGasSponsorGrantRequest(request);
  assert.equal(normalized.sponsor, sponsor);
  assert.equal(normalized.perCallLimit, 42n);
  assert.throws(() => normalizeGasSponsorGrantRequest({ ...request, periodSeconds: '0' }), /both be zero or both be non-zero/);
  assert.throws(() => normalizeGasSponsorGrantRequest({ ...request, operation: `0x${'0'.repeat(64)}` }), /operation must be non-zero/);
});

test('gas sponsor grant creation simulates the owner-only SmartAccount420 call', async () => {
  const calls = [];
  const provider = { request: async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_call') return grantId;
    if (method === 'eth_estimateGas') return '0x12345';
    throw new Error(method);
  } };
  const prepared = await prepareGasSponsorGrantCreation(provider, owner, smartAccountState, request);
  assert.equal(prepared.expectedGrantId, grantId);
  assert.equal(prepared.transaction.from, owner);
  assert.equal(prepared.transaction.to, account);
  assert.equal(prepared.transaction.value, '0x0');
  assert.equal(prepared.transaction.data.slice(0, 10), '0x297945e0');
  assert.deepEqual(calls.map(([method]) => method), ['eth_call', 'eth_estimateGas']);
});

test('gas sponsor grant send re-simulates before explicit provider approval', async () => {
  const calls = [];
  const provider = { request: async (method, params) => {
    calls.push(method);
    if (method === 'eth_call') return grantId;
    if (method === 'eth_estimateGas') return '0x12345';
    if (method === 'eth_sendTransaction') {
      assert.equal(params[0].to, account);
      assert.equal(params[0].data.slice(0, 10), '0x297945e0');
      return txHash;
    }
    throw new Error(method);
  } };
  const submitted = await sendGasSponsorGrantCreation(provider, owner, smartAccountState, request);
  assert.equal(submitted.txHash, txHash);
  assert.deepEqual(calls, ['eth_call', 'eth_estimateGas', 'eth_sendTransaction']);
});

test('capability management fails closed for non-owner controllers or non-canonical registries', async () => {
  const provider = { request: async () => { throw new Error('should not reach provider'); } };
  await assert.rejects(
    prepareGasSponsorGrantCreation(provider, '0x2222222222222222222222222222222222222222', smartAccountState, request),
    /not the on-chain.*owner/i,
  );
  await assert.rejects(
    prepareGasSponsorGrantCreation(provider, owner, { ...smartAccountState, capabilityRegistry: '0x4444444444444444444444444444444444444444' }, request),
    /canonical CapabilityRegistry420/,
  );
});
