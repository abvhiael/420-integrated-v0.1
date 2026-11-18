import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { keccak256Hex } from '../../../wallet/web/core/keccak.js';
import {
  ACCEPTANCE_MODES, INVOICE_MODES, PAYMENT_STATUSES, PAY_SERVICE_ID, QUOTE_LIFETIME_SECONDS,
  createPayReader, invoiceView, isPayQuoteFresh, paymentView, toPayPaymentSummary
} from '../dist/index.js';

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url));
const hash = (c) => '0x' + c.repeat(64);
const address = (c) => '0x' + c.repeat(40);
const snapshot = { chainId: 420n, blockHash: hash('a') };
const id = hash('b');
const word = (value) => (typeof value === 'string' ? value.slice(2) : value.toString(16)).padStart(64, '0');
const encode = (words) => '0x' + words.map(word).join('');
const invoiceWords = [
  hash('c'), address('1'), hash('d'), '434144'.padEnd(64, '0').replace(/^/, '0x'),
  (1n << 200n) + 1n, 60n, 100n, 0n, 1n, 0n, 42n, hash('e'), hash('f'), hash('0'), 1n
];
const paymentWords = [
  id, address('2'), address('1'), address('0'), 10n, address('3'), 9n, hash('4'), 0n, hash('5'), 0n, 0n, 4n
];

test('view ABI, selectors and enums are pinned to current retained authorities', () => {
  const manifest = JSON.parse(read('contracts/artifacts/genesis-residents/v3/manifest.json'));
  const bundle = gunzipSync(read('contracts/artifacts/genesis-residents/v3/contracts.json.gz'));
  assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.bundle_content_sha256);
  const artifacts = JSON.parse(bundle);
  const ids = read('contracts/src/pay/PayIds420.sol').toString();
  for (const view of [invoiceView, paymentView]) {
    const abi = artifacts[view.contract].compiler_artifact.abi;
    const entry = abi.find((item) => item.name === view.signature.split('(')[0]);
    assert.equal(entry.type, 'function');
    assert.equal(entry.stateMutability, 'view');
    assert.equal(`${entry.name}(${entry.inputs.map(i => i.type).join(',')})`, view.signature);
    assert.deepEqual(entry.outputs[0].components.map(i => [i.name, i.type]), view.output);
    assert.equal(keccak256Hex(new TextEncoder().encode(view.signature)).slice(0, 10), view.selector);
    assert.ok(ids.includes(`keccak256("${view.component}")`));
  }
  const enumSource = (contract, name) => {
    const source = read(`contracts/src/pay/${contract}.sol`).toString();
    return source.match(new RegExp(`enum ${name}\\s*\\{([^}]+)\\}`))[1].split(',').map(x => x.trim());
  };
  assert.deepEqual(enumSource('InvoiceRegistry420', 'Mode'), INVOICE_MODES);
  assert.deepEqual(enumSource('InvoiceRegistry420', 'Acceptance'), ACCEPTANCE_MODES);
  assert.deepEqual(enumSource('PaymentRegistry420', 'Status'), PAYMENT_STATUSES);
  assert.ok(read('contracts/src/libraries/ServiceIds420.sol').toString().includes(`keccak256("${PAY_SERVICE_ID}")`));
  assert.equal(BigInt(JSON.parse(read('contracts/config/pay/420pay-parameters.json')).invoice.quote_lifetime_seconds), QUOTE_LIFETIME_SECONDS);
});

test('pinned reads use distinct component IDs and retain lossless values and status', async () => {
  const calls = [];
  const input = { ...snapshot };
  const reader = createPayReader({ async read(call) {
    calls.push(call);
    return encode(call.component === invoiceView.component ? invoiceWords : paymentWords);
  } }, input);
  input.blockHash = hash('0');
  const invoice = await reader.invoice(id.toUpperCase().replace('0X', '0x'));
  const payment = await reader.payment(id);
  assert.deepEqual(calls, [invoiceView, paymentView].map(view => ({
    component: view.component, snapshot, calldata: view.selector + id.slice(2)
  })));
  assert.equal(invoice.amount, (1n << 200n) + 1n);
  assert.equal(invoice.currency, 'CAD');
  assert.equal(invoice.mode, 'SINGLE_USE');
  assert.equal(invoice.acceptance, 'FINALIZED');
  assert.equal(payment.status, 'FINALIZED');
  assert.equal(payment.payer, address('2'));
  assert.deepEqual(JSON.parse(JSON.stringify(toPayPaymentSummary(payment))), {
    paymentId: id, invoiceId: id, chainId: '420', blockHash: snapshot.blockHash, status: 'FINALIZED'
  });
});

test('reject invalid selectors and malformed or semantically impossible responses', async () => {
  assert.throws(() => createPayReader({}, { ...snapshot, chainId: 0n }), /chain/);
  assert.throws(() => createPayReader({}, { ...snapshot, blockHash: hash('0') }), /block/);
  let raw = encode(invoiceWords);
  const reader = createPayReader({ read: async () => raw }, snapshot);
  await assert.rejects(reader.invoice(hash('0')), /invoice ID/);
  await assert.rejects(reader.payment('0x0011'), /payment ID/);
  raw = '0x' + '0'.repeat(64 * invoiceWords.length);
  assert.equal(await reader.invoice(id), null);
  for (const value of [null, '0x', encode(invoiceWords) + '00', '0xzz']) {
    raw = value;
    await assert.rejects(reader.invoice(id), /ABI response/);
  }
  for (const [offset, value, expected] of [
    [1, hash('f'), /padding/], [3, hash('f'), /padding/], [5, 1n << 64n, /overflow/],
    [8, 250n, /enum/], [9, 2n, /boolean/], [9, 1n, /canonical invoice/],
    [10, 43n, /canonical invoice/], [11, hash('0'), /canonical invoice/]
  ]) {
    raw = encode(invoiceWords.with(offset, value));
    await assert.rejects(reader.invoice(id), expected);
  }
  raw = encode(paymentWords.with(12, 0n));
  await assert.rejects(reader.payment(id), /canonical payment/);
  const unavailable = createPayReader({ read: async () => { throw new Error('not canonical'); } }, snapshot);
  await assert.rejects(unavailable.payment(id), /not canonical/);
});

test('quote freshness uses canonical chain time and the inclusive contract boundary', () => {
  assert.equal(isPayQuoteFresh(100n, 142n), true);
  assert.equal(isPayQuoteFresh(100n, 143n), false);
  assert.equal(isPayQuoteFresh(100n, 99n), false);
  assert.equal(isPayQuoteFresh(-1n, 1n), false);
  assert.equal(isPayQuoteFresh(1n << 64n, 1n << 64n), false);
  assert.equal(isPayQuoteFresh('100', 120n), false);
});
