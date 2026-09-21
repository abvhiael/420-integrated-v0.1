import test from 'node:test';
import assert from 'node:assert/strict';
import { createNames420Client, hash420Label } from '../core/names-client.js';
import { keccak256Hex } from '../core/keccak.js';

const CONTRACT = '0x00000000000000000000000000000000000000ab';
const OWNER = '0x00000000000000000000000000000000000000aa';
const RECIPIENT = '0x00000000000000000000000000000000000000bb';
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (address) => address.slice(2).padStart(64, '0');
const id = (signature) => keccak256Hex(new TextEncoder().encode(signature)).slice(0, 10);
const identity = `0x${word(32)}${word(8)}${'4e616d6573343230'.padEnd(64, '0')}`;
const record = `0x${addressWord(OWNER)}${word(0)}${addressWord(RECIPIENT)}${word(0)}${word(0)}${word(9000)}${word(5)}`;

function fakeRpc({ chain = '0x1', code = '0x6000', identityResponse = identity, recordResponse = record, version = `0x${word(3)}`, timestamp = '0x3e8' } = {}) {
  const calls = [];
  const provider = { async request(method, params = []) {
    calls.push({ method, params });
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_getCode') return code;
    if (method === 'eth_getBlockByNumber') return { timestamp };
    if (method === 'eth_call') {
      assert.equal(params[0].to, CONTRACT);
      const selector = params[0].data.slice(0, 10);
      if (selector === id('systemName()')) return identityResponse;
      if (selector === id('protocolVersion()')) return version;
      if (selector === id('resolve(bytes32)')) {
        assert.equal(params[0].data.slice(10), hash420Label('alice.420').slice(2));
        return recordResponse;
      }
      throw new Error('unrecognized selector');
    }
    throw new Error(`unrecognized RPC method: ${method}`);
  } };
  return { provider, calls };
}

test('label hash matches Solidity keccak256("alice") and rejects misleading labels', () => {
  assert.equal(hash420Label('alice.420'), keccak256Hex(new TextEncoder().encode('alice')));
  assert.notEqual(hash420Label('alice.420'), keccak256Hex(new TextEncoder().encode('alice.420')));
  assert.throws(() => hash420Label('аlice.420'), /invalid 420 Name/); // Cyrillic a
  assert.throws(() => hash420Label('Alice.420'), /invalid 420 Name/);
});

test('canonical Names client verifies contract, chain and ABI record before returning a recipient', async () => {
  const { provider, calls } = fakeRpc();
  const client = createNames420Client({ provider, namesAddress: CONTRACT, chainId: '0x01' });
  const resolved = await client.lookup('alice.420');
  assert.equal(resolved.labelHash, hash420Label('alice.420'));
  assert.equal(resolved.record.owner, OWNER);
  assert.equal(resolved.record.resolvedAddress, RECIPIENT);
  assert.equal(resolved.record.expiresAt, 9000n);
  assert.equal(await client.chainTime(), 1000);
  assert.ok(calls.some(({ method }) => method === 'eth_getCode'));
});

test('name reads fail closed for wrong network, missing contract, forged ABI or wrong version', async () => {
  for (const options of [{ chain: '0x2' }, { code: '0x' }, { identityResponse: `0x${word(0)}` }, { version: `0x${word(2)}` }, { recordResponse: '0x' }]) {
    const { provider } = fakeRpc(options);
    await assert.rejects(createNames420Client({ provider, namesAddress: CONTRACT, chainId: '0x1' }).lookup('alice.420'));
  }
  assert.throws(() => createNames420Client({ provider: fakeRpc().provider, namesAddress: '0x0000000000000000000000000000000000000000', chainId: '0x1' }));
  assert.throws(() => createNames420Client({ provider: fakeRpc().provider, namesAddress: CONTRACT, chainId: null }));
});

test('rejects malformed or over-wide name record fields and untrusted block timestamps', async () => {
  for (const recordResponse of [record.slice(0, -64), `0x${'f'.repeat(64)}${record.slice(66)}`, `${record.slice(0, -64)}${word(256)}`, `${record.slice(0, -64)}${word(4)}`]) {
    await assert.rejects(createNames420Client({ provider: fakeRpc({ recordResponse }).provider, namesAddress: CONTRACT, chainId: '0x1' }).lookup('alice.420'));
  }
  await assert.rejects(createNames420Client({ provider: fakeRpc({ timestamp: 'not-a-timestamp' }).provider, namesAddress: CONTRACT, chainId: '0x1' }).chainTime());
});
