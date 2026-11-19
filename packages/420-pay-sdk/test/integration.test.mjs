import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { keccak256Hex } from '../../../wallet/web/core/keccak.js';
import { createPayReader, createPayRegistry, createPayWallet, invoiceView, paymentView, PAYMENT_ROUTER } from '../dist/index.js';

const address = digit => '0x' + digit.repeat(40);
const hash = digit => '0x' + digit.repeat(64);
const word = item => (typeof item === 'string' ? item.slice(2) : item.toString(16)).padStart(64, '0');
const encode = (...items) => '0x' + items.map(word).join('');
const digest = text => keccak256Hex(new TextEncoder().encode(text));
const call = (signature, argument) => digest(signature).slice(0, 10) + argument.slice(2);
const origin = 'https://pay.420integrated.org';
const snapshot = { chainId: 420n, blockHash: hash('a') };
const code = '0x6000';
const codeHash = keccak256Hex(Uint8Array.of(0x60, 0x00));

function fixture() {
  const service = (digit, metadata) => ({ implementation: address(digit), codeHash, metadataHash: hash(metadata), version: 1 });
  const config = {
    chainId: 420n, registry: address('1'), registryCodeHash: codeHash, origin,
    pay: service('2', 'b'), names: service('3', 'c'), identity: service('4', 'd'),
    components: Object.fromEntries([invoiceView.component, paymentView.component, PAYMENT_ROUTER].map(id => [id, codeHash]))
  };
  const labelHash = digest('crowley');
  const profile = hash('5');
  const account = address('9');
  const replies = new Map();
  for (const [id, entry] of [['pay', config.pay], ['names', config.names], ['identity', config.identity]]) {
    replies.set(call('getService(bytes32)', digest('420/service/' + id + '/v1')),
      encode(entry.implementation, codeHash, entry.metadataHash, 1, 10, 1));
  }
  for (const [index, id] of [invoiceView.component, paymentView.component, PAYMENT_ROUTER].entries()) {
    const component = digest(id);
    replies.set(call('component(bytes32)', component), encode(component, address(String(index + 6)), codeHash, 1, 0, 0, 2));
  }
  const recordCall = call('resolve(bytes32)', labelHash);
  const profileCall = call('profiles(bytes32)', profile);
  replies.set(recordCall, encode(account, address('0'), account, profile, hash('0'), 20, 7));
  replies.set(profileCall, encode(account, address('0'), hash('0'), labelHash, 1, 2, 1));
  const paymentCall = paymentView.selector + hash('6').slice(2);
  replies.set(paymentCall, encode(...paymentView.output.map(() => 0)));

  const state = { canonical: true, chainId: '0x1a4', runtime: code,
    block: { hash: snapshot.blockHash, number: '0x2', timestamp: '0xa' }
  };
  const log = [];
  const application = createPayRegistry({ async request(method, params) {
    log.push([method, params]);
    if (method === 'eth_chainId') return state.chainId;
    if (method === 'eth_getBlockByHash') {
      assert.deepEqual(params, [snapshot.blockHash, false]);
      return state.block;
    }
    if (method === 'eth_getBlockByNumber') {
      assert.ok(params[0] === 'latest' || params[0] === state.block?.number);
      return state.canonical ? state.block : { ...state.block, hash: hash('b') };
    }
    assert.deepEqual(params[1], { blockHash: snapshot.blockHash, requireCanonical: true });
    if (method === 'eth_getCode') return params[0] === address('7') ? state.runtime : code;
    assert.equal(method, 'eth_call');
    assert.ok(replies.has(params[0].data), 'unexpected ABI call ' + params[0].data);
    if (params[0].data === recordCall) assert.equal(params[0].to, config.names.implementation);
    else if (params[0].data === profileCall) assert.equal(params[0].to, config.identity.implementation);
    else if (params[0].data === paymentCall) {
      assert.equal(params[0].to, address('7'));
      if (state.reorgDuringRead) state.canonical = false;
    } else assert.equal(params[0].to, config.registry);
    return replies.get(params[0].data);
  } }, config);
  return { state, replies, application, config, log, account, labelHash, profile, recordCall, profileCall };
}

test('Pay reads use the same canonical block for Registry, bytecode and view', async () => {
  const { application, state, replies, config } = fixture();
  const reader = createPayReader(application.transport, snapshot);
  assert.deepEqual(await application.latestSnapshot(), snapshot);
  assert.equal(await reader.payment(hash('6')), null);
  await assert.rejects(application.paymentRouter(snapshot, 'https://pay.420integrated.org.attacker.example'), /origin/);
  state.runtime = '0x6001';
  await assert.rejects(reader.payment(hash('6')), /runtime code mismatch/);
  state.runtime = code;
  state.chainId = '0x1';
  await assert.rejects(reader.payment(hash('6')), /wrong chain/);
  state.chainId = '0x1a4';
  const serviceCall = call('getService(bytes32)', digest('420/service/pay/v1'));
  const goodService = replies.get(serviceCall);
  replies.set(serviceCall, encode(config.pay.implementation, codeHash, hash('f'), 1, 10, 1));
  await assert.rejects(reader.payment(hash('6')), /service binding/);
  replies.set(serviceCall, goodService);
  const componentId = digest(paymentView.component);
  const componentCall = call('component(bytes32)', componentId);
  const goodComponent = replies.get(componentCall);
  replies.set(componentCall, encode(componentId, address('7'), codeHash, 1, 0, 0, 4));
  await assert.rejects(reader.payment(hash('6')), /component binding/);
  replies.set(componentCall, goodComponent);
  state.reorgDuringRead = true;
  await assert.rejects(reader.payment(hash('6')), /no longer canonical/);
  state.block = null;
  await assert.rejects(reader.payment(hash('6')), /hash/);
});

test('name resolution checks expiry and bilateral active Identity controller binding', async () => {
  const { application, replies, account, profile, labelHash, recordCall, profileCall } = fixture();
  assert.deepEqual(await application.resolveName(snapshot, 'crowley.420'), {
    name: 'crowley.420', recipient: account, verifiedProfileId: profile
  });
  await assert.rejects(application.resolveName(snapshot, 'crоwley.420'), /Invalid 420 name/); // Cyrillic o
  for (const [controller, primaryName, active] of [[address('a'), labelHash, 1], [account, hash('b'), 1], [account, labelHash, 0]]) {
    replies.set(profileCall, encode(controller, address('0'), hash('0'), primaryName, 1, 2, active));
    await assert.rejects(application.resolveName(snapshot, 'crowley.420'), /do not agree/);
  }
  replies.set(recordCall, encode(account, address('0'), account, hash('0'), hash('0'), 20, 7));
  assert.equal((await application.resolveName(snapshot, 'crowley.420')).verifiedProfileId, null);
  replies.set(recordCall, encode(account, address('0'), account, profile, hash('0'), 10, 7));
  await assert.rejects(application.resolveName(snapshot, 'crowley.420'), /expired/);
});

test('Wallet receives only the selected account, canonical target and exact call for approval', async t => {
  const { application, account } = fixture();
  globalThis.location = { origin: 'https://spoof.example' };
  t.after(() => { delete globalThis.location; });
  const calls = [];
  let walletChain = '0x1a4';
  let accounts = [account];
  let deny = true;
  const provider = { is420Wallet: true, async request(request) {
    calls.push(request);
    if (request.method === 'eth_chainId') return walletChain;
    if (request.method === 'eth_requestAccounts' || request.method === 'eth_accounts') return accounts;
    if (request.method === 'wallet_revokePermissions') return null;
    assert.equal(request.method, 'eth_sendTransaction');
    if (deny) throw new Error('Wallet simulation failed or user rejected');
    return hash('e');
  } };
  assert.throws(() => createPayWallet(application, provider), /origin/);
  globalThis.location = { origin };
  const wallet = createPayWallet(application, provider);
  const data = '0x8ef5948b' + word(1);
  const input = { data, value: 42n };
  await assert.rejects(wallet.submitPayment(input), /Connect/);
  assert.deepEqual(await wallet.connect(), { account, chainId: 420n });
  walletChain = '0x1';
  await assert.rejects(wallet.submitPayment(input), /wrong network/);
  walletChain = '0x1a4';
  accounts = [address('b')];
  await assert.rejects(wallet.submitPayment(input), /selection changed/);
  accounts = [account];
  await assert.rejects(wallet.submitPayment({ ...input, data: '0x12345678' }), /Invalid Pay transaction/);
  assert.equal(calls.filter(x => x.method === 'eth_sendTransaction').length, 0);
  await assert.rejects(wallet.submitPayment(input), /Wallet simulation failed or user rejected/);
  deny = false;
  assert.deepEqual(await wallet.submitPayment(input), { submissionHash: hash('e'), chainId: 420n });
  assert.deepEqual(calls.at(-1), {
    method: 'eth_sendTransaction', params: [{ from: account, to: address('8'), chainId: '0x1a4', data, value: '0x2a' }]
  });
  await wallet.revoke();
  assert.deepEqual(calls.at(-1), { method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  await assert.rejects(wallet.submitPayment(input), /Connect/);
});

test('Wallet settlement selectors agree with the frozen router ABI', async t => {
  globalThis.location = { origin };
  t.after(() => { delete globalThis.location; });
  const { application, account } = fixture();
  const bundle = new URL('../../../contracts/artifacts/genesis-residents/v3/contracts.json.gz', import.meta.url);
  const abi = JSON.parse(gunzipSync(readFileSync(bundle))).PaymentRouter420.compiler_artifact.abi;
  const type = p => p.type.startsWith('tuple')
    ? '(' + p.components.map(type).join(',') + ')' + p.type.slice(5) : p.type;
  const writes = abi.filter(x => x.type === 'function' && x.name.startsWith('execute'));
  assert.equal(writes.length, 4);
  const submitted = [];
  const wallet = createPayWallet(application, { is420Wallet: true, async request({ method, params }) {
    if (method === 'eth_chainId') return '0x1a4';
    if (method === 'eth_sendTransaction') {
      submitted.push(params[0].data);
      return hash('e');
    }
    return [account];
  } });
  await wallet.connect();
  const expected = writes.map(x => digest(x.name + '(' + x.inputs.map(type).join(',') + ')').slice(0, 10));
  for (const data of expected) await wallet.submitPayment({ data, value: 0n });
  assert.deepEqual(submitted, expected);
});
