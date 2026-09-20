import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualifiedNamesSend420 } from '../core/names-guided-send.js';
import { keccak256Hex } from '../core/keccak.js';

const CONTRACT = '0x00000000000000000000000000000000000000ab';
const OWNER = '0x00000000000000000000000000000000000000aa';
const RECIPIENT = '0x00000000000000000000000000000000000000bb';
const OTHER = '0x00000000000000000000000000000000000000cc';
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => value.slice(2).padStart(64, '0');
const selector = (signature) => keccak256Hex(new TextEncoder().encode(signature)).slice(0, 10);
const identity = `0x${word(32)}${word(8)}${'4e616d6573343230'.padEnd(64, '0')}`;
const record = (recipient) => `0x${addressWord(OWNER)}${word(0)}${addressWord(recipient)}${word(0)}${word(0)}${word(9000)}${word(5)}`;
function setup() {
  let chain = '0x1';
  let target = RECIPIENT;
  const provider = { async request(method, params = []) {
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_getCode') return '0x60006000';
    if (method === 'eth_getBlockByNumber') return { timestamp: '0x3e8' };
    if (method === 'eth_call') {
      assert.equal(params[0].to, CONTRACT);
      if (params[0].data.startsWith(selector('protocolVersion()'))) return `0x${word(3)}`;
      if (params[0].data.startsWith(selector('systemName()'))) return identity;
      if (params[0].data.startsWith(selector('resolve(bytes32)'))) return record(target);
    }
    throw new Error('unexpected Names RPC request');
  } };
  const config = {
    schema: '420-wallet-runtime-config-v1',
    network: { chainId: '0x1', rpcUrl: 'https://rpc.example.test' },
    manifest: { url: 'https://manifest.example.test/network.json' },
    deployment: { namesAddress: CONTRACT, environment: 'testnet', sourceInventoryPhase: 'W14.1' },
  };
  return { provider, config, retarget(value) { target = value; }, switchChain(value) { chain = value; } };
}

test('qualified name resolution builds native send to the on-chain target after explicit confirmation', async () => {
  const { provider, config } = setup();
  let reviews = 0;
  const flow = createQualifiedNamesSend420({ provider, config, confirm({ name, recipient }) {
    reviews += 1;
    assert.equal(name, 'alice.420');
    assert.equal(recipient, RECIPIENT);
    return true;
  } });
  const prepared = await flow.prepare({ recipient: 'alice.420', amount: '4.2', asset: { kind: 'native', symbol: '420', decimals: 18 } });
  assert.equal(prepared.request.target, RECIPIENT);
  assert.equal(prepared.request.value, '4200000000000000000');
  assert.equal(prepared.summary.recipient, RECIPIENT);
  await flow.revalidate(prepared);
  assert.equal(reviews, 2);
});

test('qualified name send rejects retargeting or network switches before execution', async () => {
  const rpc = setup();
  const flow = createQualifiedNamesSend420({ provider: rpc.provider, config: rpc.config, confirm: () => true });
  const prepared = await flow.prepare({ recipient: 'alice.420', amount: '1', asset: { kind: 'native' } });
  rpc.retarget(OTHER);
  await assert.rejects(flow.revalidate(prepared), /changed/);
  rpc.switchChain('0x2');
  await assert.rejects(flow.revalidate(prepared), /chain changed/);
});

test('named send requires qualified deployment binding and explicit confirmation', async () => {
  const { provider, config } = setup();
  assert.throws(() => createQualifiedNamesSend420({ provider, config: { ...config, deployment: undefined }, confirm: () => true }), /qualified chain-specific deployment manifest/);
  assert.throws(() => createQualifiedNamesSend420({ provider, config: { ...config, manifest: { url: null } }, confirm: () => true }), /qualified chain-specific deployment manifest/);
  assert.throws(() => createQualifiedNamesSend420({ provider, config, confirm: null }), /explicit recipient confirmation/);
  const flow = createQualifiedNamesSend420({ provider, config, confirm: () => false });
  await assert.rejects(flow.prepare({ recipient: 'alice.420', amount: '1', asset: { kind: 'native' } }), /was not confirmed/);
});
