import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSendExecution, encodeErc20Transfer, parseUnits } from '../core/send.js';

const ZERO = '0x0000000000000000000000000000000000000000';

test('parseUnits converts decimal amounts exactly', () => {
  assert.equal(parseUnits('4.2', 18), 4200000000000000000n);
  assert.equal(parseUnits('0.000001', 6), 1n);
  assert.throws(() => parseUnits('1.0000001', 6), /more than 6 decimal places/);
  assert.throws(() => parseUnits('0', 18), /greater than zero/);
});

test('parseUnits rejects malformed, oversized and invalid-decimal input', () => {
  assert.throws(() => parseUnits('1e18', 18), /positive decimal number/);
  assert.throws(() => parseUnits('1'.repeat(97), 18), /positive decimal number/);
  assert.throws(() => parseUnits('1', -1), /invalid asset decimals/);
  assert.throws(() => parseUnits('1', 256), /invalid asset decimals/);
  assert.throws(() => parseUnits((1n << 256n).toString(), 0), /uint256 range/);
});

test('buildSendExecution maps native 420 sends to value-only SmartAccount execution', () => {
  const built = buildSendExecution({
    recipient: '0x00000000000000000000000000000000000000aa',
    amount: '4.2',
    asset: { kind: 'native', symbol: '420', decimals: 18 },
  });
  assert.deepEqual(built.request, {
    target: '0x00000000000000000000000000000000000000aa',
    value: '4200000000000000000',
    data: '0x',
  });
});

test('buildSendExecution maps erc20 sends to transfer calldata with zero native value', () => {
  const recipient = '0x00000000000000000000000000000000000000bb';
  const token = '0x00000000000000000000000000000000000000cc';
  const built = buildSendExecution({
    recipient,
    amount: '12.5',
    asset: { kind: 'erc20', address: token, symbol: 'TEST', decimals: 6 },
  });
  assert.equal(built.request.target, token);
  assert.equal(built.request.value, '0');
  assert.equal(built.request.data, encodeErc20Transfer(recipient, 12500000n));
  assert.match(built.request.data, /^0xa9059cbb/);
});

test('guided send rejects zero addresses and token-contract-as-recipient mistakes', () => {
  const recipient = '0x00000000000000000000000000000000000000bb';
  const token = '0x00000000000000000000000000000000000000cc';
  assert.throws(() => buildSendExecution({ recipient: ZERO, amount: '1', asset: { kind: 'native', decimals: 18 } }), /recipient cannot be the zero address/);
  assert.throws(() => buildSendExecution({ recipient, amount: '1', asset: { kind: 'erc20', address: ZERO, decimals: 18 } }), /token address cannot be the zero address/);
  assert.throws(() => buildSendExecution({ recipient: token, amount: '1', asset: { kind: 'erc20', address: token, decimals: 18 } }), /token contract cannot be used as the transfer recipient/);
});
