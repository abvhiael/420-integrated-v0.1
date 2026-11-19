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
  const merchantKey = '420/APP/420PAY/MERCHANT_REGISTRY';
  config.components[merchantKey] = codeHash;
  const replies = new Map();
  const merchantComponent = digest(merchantKey);
  replies.set(call('component(bytes32)', merchantComponent), encode(merchantComponent, address('5'), codeHash, 1, 0, 0, 2));
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
    if (method === 'eth_getLogs') {
      assert.equal(params[0].address, address('7'));
      assert.deepEqual(params[0].topics, [digest('PaymentSet(bytes32,bytes32,uint8)')]);
      return state.events;
    }
    assert.deepEqual(params[1], { blockHash: snapshot.blockHash, requireCanonical: true });
    if (method === 'eth_getBalance') {
      assert.equal(params[0], account);
      return state.native;
    }
    if (method === 'eth_getCode') return params[0] === address('7') ? state.runtime : code;
    assert.equal(method, 'eth_call');
    assert.ok(replies.has(params[0].data), 'unexpected ABI call ' + params[0].data);
    if (params[0].data === recordCall) assert.equal(params[0].to, config.names.implementation);
    else if (params[0].data === profileCall) assert.equal(params[0].to, config.identity.implementation);
    else if (params[0].data === paymentCall) {
      assert.equal(params[0].to, address('7'));
      if (state.reorgDuringRead) state.canonical = false;
    } else if (params[0].data.startsWith(invoiceView.selector) ||
      params[0].data.startsWith(digest('isClosed(bytes32)').slice(0, 10))) assert.equal(params[0].to, address('6'));
    else if (['merchants(bytes32)', 'currentPayout(bytes32)', 'effectiveRole(bytes32,bytes32,address)', 'activeLocations(bytes32,bytes32)'].some(sig =>
      params[0].data.startsWith(digest(sig).slice(0, 10)))) assert.equal(params[0].to, address('5'));
    else if (params[0].data.startsWith(paymentView.selector)) assert.equal(params[0].to, address('7'));
    else if (params[0].data.startsWith(digest('balanceOf(address)').slice(0, 10))) assert.equal(params[0].to, address('a'));
    else assert.equal(params[0].to, config.registry);
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


test('dashboard derives lossless balances through verified asset bytecode at the snapshot', async () => {
  const { application, state, replies, account } = fixture();
  state.native = '0x2000000000000000000';
  replies.set(digest('balanceOf(address)').slice(0, 10) + word(account), encode(42n));
  const asset = { address: address('a'), codeHash };
  assert.deepEqual(await application.accountBalances(snapshot, account, [asset]), [BigInt(state.native), 42n]);
  await assert.rejects(application.accountBalances(snapshot, account, [{ ...asset, codeHash: hash('b') }]), /runtime code/);
});

test('dashboard history verifies event blocks and payment identity, deduplicates and scopes records', async () => {
  const { application, state, replies, account } = fixture();
  const invoice = hash('d');
  const linked = hash('6');
  const other = hash('e');
  const event = (id, index) => ({
    address: address('7'), topics: [digest('PaymentSet(bytes32,bytes32,uint8)'), id, invoice],
    blockNumber: '0x2', blockHash: snapshot.blockHash, logIndex: '0x' + index, removed: false
  });
  state.events = [event(linked, 0), event(linked, 1), event(other, 2)];
  for (const [id, payer] of [[linked, account], [other, address('b')]]) {
    replies.set(paymentView.selector + id.slice(2),
      encode(invoice, payer, address('a'), address('0'), 12, address('0'), 12, hash('0'), 0, hash('b'), 0, 0, 4));
  }
  const result = await application.accountHistory(snapshot, account);
  assert.deepEqual(result.payments.map(payment => [payment.id, payment.status]), [[linked, 'FINALIZED']]);
  assert.deepEqual([result.first, result.last, result.next], [0n, 2n, null]);
  await assert.rejects(application.accountHistory(snapshot, account, 3n), /history range/);
  state.events[2].topics[2] = hash('a');
  await assert.rejects(application.accountHistory(snapshot, account), /canonical payment/);
  state.events = [{ ...event(linked, 0), blockHash: hash('b') }];
  await assert.rejects(application.accountHistory(snapshot, account), /no longer canonical/);
  state.events[0].removed = true;
  await assert.rejects(application.accountHistory(snapshot, account), /Invalid Pay history event/);
});

test('native sends preserve the selected account, network, recipient and value in Wallet', async t => {
  globalThis.location = {origin};
  t.after(() => { delete globalThis.location; });
  const {application, account} = fixture();
  let selected = account;
  const seen = [];
  const wallet = createPayWallet(application, {is420Wallet: true, async request({method, params}) {
    if (method === 'eth_chainId') return '0x1a4';
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [selected];
    assert.equal(method, 'eth_sendTransaction');
    seen.push(params);
    return hash('f');
  }});
  await wallet.connect();
  await assert.rejects(wallet.sendNative(address('0'), 1n), /Invalid Pay address/);
  await assert.rejects(wallet.sendNative(address('a'), 0n), /Invalid native send value/);
  selected = address('b');
  await assert.rejects(wallet.sendNative(address('a'), 1n), /selection changed/);
  selected = account;
  assert.deepEqual(await wallet.sendNative(address('a'), 42n), {submissionHash:hash('f'), chainId:420n});
  assert.deepEqual(seen, [[{chainId:'0x1a4', from:account, to:address('a'), data:'0x', value:'0x2a'}]]);
});


test('invoice review rejects closed and expired canonical registry records', async () => {
  const {application, state, replies, account} = fixture();
  const id = hash('d');
  const get = invoiceView.selector + id.slice(2);
  const closed = call('isClosed(bytes32)', id);
  replies.set(get, encode(hash('e'), account, hash('0'), '0x' + '343230'.padEnd(64,'0'),
    42, 11, 20, 0, 1, 0, 0, hash('a'), hash('0'), hash('0'), 1));
  replies.set(closed, encode(0));
  assert.equal((await application.invoiceForReview(snapshot, id)).merchant, account);
  replies.set(closed, encode(1));
  await assert.rejects(application.invoiceForReview(snapshot, id), /closed or expired/);
  replies.set(closed, encode(0));
  state.block.timestamp = '0xc';
  await assert.rejects(application.invoiceForReview(snapshot, id), /closed or expired/);
});


test('hosted checkout reads verified invoice, active merchant and payout at one snapshot', async () => {
  const {application, replies, account} = fixture();
  const id = hash('d');
  const merchant = hash('e');
  const payout = address('b');
  const controller = call('merchants(bytes32)', merchant);
  const profile = call('currentPayout(bytes32)', merchant);
  replies.set(invoiceView.selector + id.slice(2), encode(merchant, account, hash('0'), '0x' + '343230'.padEnd(64,'0'),
    42, 11, 20, 0, 1, 0, 0, hash('a'), hash('0'), hash('0'), 1));
  replies.set(call('isClosed(bytes32)', id), encode(0));
  replies.set(controller, encode(account, hash('0'), hash('0'), 1, 1, 1));
  replies.set(profile, encode(payout, 1, hash('0')));
  const review = await application.hostedCheckout(snapshot, id);
  assert.equal(review.recipient, payout);
  assert.equal(review.invoice.amount, 42n);
  assert.equal(review.chainTime, 10n);
  replies.set(profile, encode(payout, 2, hash('f')));
  await assert.rejects(application.hostedCheckout(snapshot, id), /payout plan has changed/);
  replies.set(controller, encode(address('a'), hash('0'), hash('0'), 1, 1, 1));
  await assert.rejects(application.hostedCheckout(snapshot, id), /merchant binding/);
});


test('merchant reports require a tenant role and filter invoices even when the controller is shared', async () => {
  const { application, replies, state, account } = fixture();
  const tenant = hash('1');
  const otherTenant = hash('2');
  const reporter = address('b');
  const cashier = address('a');
  const merchantRead = call('merchants(bytes32)', tenant);
  const role = (location, user) => digest('effectiveRole(bytes32,bytes32,address)').slice(0, 10) +
    word(tenant) + word(location) + word(user);
  replies.set(merchantRead, encode(account, hash('0'), hash('0'), 2, 1, 1));
  replies.set(role(hash('0'), reporter), encode(1));
  replies.set(role(hash('0'), cashier), encode(0));
  const records = [[hash('6'), hash('d'), tenant], [hash('8'), hash('e'), otherTenant]];
  state.events = records.map(([payment, invoice], index) => ({
    address: address('7'), topics: [digest('PaymentSet(bytes32,bytes32,uint8)'), payment, invoice],
    blockNumber: '0x2', blockHash: snapshot.blockHash, logIndex: '0x' + index, removed: false
  }));
  for (const [payment, invoice, owner] of records) {
    replies.set(paymentView.selector + payment.slice(2),
      encode(invoice, address('7'), account, address('0'), 12, address('0'), 12, hash('0'), 0, hash('b'), 0, 0, 5));
    replies.set(invoiceView.selector + invoice.slice(2), encode(owner, account, hash('0'), '0x' + '343230'.padEnd(64, '0'),
      12, 20, 25, 0, 1, 0, 0, hash('a'), hash('0'), hash('0'), 1));
  }
  assert.equal((await application.merchantDashboard(snapshot, tenant, reporter)).status, 'CREDENTIALED');
  assert.deepEqual((await application.accountHistory(snapshot, reporter, undefined, tenant)).payments.map(p => p.id), [hash('6')]);
  await assert.rejects(application.accountHistory(snapshot, cashier, undefined, tenant), /access denied/);
  await assert.rejects(application.merchantTransaction(snapshot, reporter, {kind:'location', id:tenant,
    locationId:hash('3'), active:true}), /controller required/);
  replies.set(merchantRead, encode(...Array(6).fill(0)));
  const tx = await application.merchantTransaction(snapshot, account, {kind:'register', id:tenant, payout:reporter});
  assert.deepEqual(tx, { target:address('5'),
    data:digest('registerForController(bytes32,address,address)').slice(0, 10) + word(tenant) + word(account) + word(reporter) });
});
