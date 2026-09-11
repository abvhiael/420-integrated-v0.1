import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeveloperTestAccount420, createFaucetClient420, FaucetError420 } from '../src/testnet-faucet.mjs';

const ADDRESS = '0x1111111111111111111111111111111111111111';

function network420(overrides = {}) {
  const services = { faucet: 'https://faucet.testnet.example' };
  return {
    name: '420 Integrated Testnet',
    environment: 'testnet',
    chainIdDecimal: '420',
    canRequestFaucet: true,
    service: (name) => services[name] ?? null,
    ...overrides
  };
}

test('developer test accounts are externally-custodied address descriptors only', () => {
  const account = createDeveloperTestAccount420(ADDRESS, 'ci');
  assert.equal(account.address, ADDRESS);
  assert.equal(account.label, 'ci');
  assert.equal(account.custody, 'external-wallet');
  assert.equal(account.secretMaterialManaged, false);
  assert.equal(Object.isFrozen(account), true);
});

test('developer test-account validation rejects malformed addresses and labels', () => {
  assert.throws(() => createDeveloperTestAccount420('0x1234'), FaucetError420);
  assert.throws(() => createDeveloperTestAccount420(ADDRESS, ''), FaucetError420);
});

test('remote faucet access fails closed outside testnet', () => {
  for (const environment of ['local', 'devnet', 'mainnet']) {
    assert.throws(
      () => createFaucetClient420({ network: network420({ environment }), transport: { request: async () => ({}) } }),
      /testnet-only/
    );
  }
});

test('faucet requires manifest-discovered faucet capability and endpoint', () => {
  assert.throws(
    () => createFaucetClient420({ network: network420({ canRequestFaucet: false }), transport: { request: async () => ({}) } }),
    /does not expose faucet capability/
  );
  assert.throws(
    () => createFaucetClient420({ network: network420({ service: () => null }), transport: { request: async () => ({}) } }),
    /endpoint is unavailable/
  );
});

test('faucet request uses only the canonical manifest endpoint and validated address', async () => {
  const calls = [];
  const client = createFaucetClient420({
    network: network420(),
    transport: {
      async request(endpoint, body) {
        calls.push({ endpoint, body });
        return { ok: true, requestId: 'req-420' };
      }
    }
  });
  const result = await client.requestFunds(ADDRESS);
  assert.deepEqual(calls, [{ endpoint: 'https://faucet.testnet.example', body: { address: ADDRESS } }]);
  assert.equal(result.address, ADDRESS);
  assert.equal(result.submitted, true);
  assert.equal(result.canonicalBalanceProof, false);
  assert.deepEqual(result.serviceResponse, { ok: true, requestId: 'req-420' });
});

test('faucet service responses never become canonical balance proof', async () => {
  const client = createFaucetClient420({
    network: network420(),
    transport: { request: async () => ({ ok: true, balance: '999999999' }) }
  });
  const result = await client.requestFunds(ADDRESS);
  assert.equal(result.canonicalBalanceProof, false);
});
