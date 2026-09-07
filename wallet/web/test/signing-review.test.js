import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSigningReview420, MAX_UINT256_420 } from '../core/signing-review.js';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';
const SPENDER = '0x3333333333333333333333333333333333333333';
const RECIPIENT = '0x4444444444444444444444444444444444444444';
const wordAddress = (value) => value.slice(2).padStart(64, '0');
const wordUint = (value) => BigInt(value).toString(16).padStart(64, '0');

test('transaction review decodes ERC20 approve and flags unlimited allowance', () => {
  const data = `0x095ea7b3${wordAddress(SPENDER)}${wordUint(MAX_UINT256_420)}`;
  const review = buildSigningReview420({
    method: 'eth_sendTransaction',
    params: [{ from: ACCOUNT, to: TOKEN, value: '0x0', data, chainId: '0x420' }],
  }, { origin: 'https://dapp.example', accounts: [ACCOUNT], chainId: '0x420' });
  assert.equal(review.kind, 'erc20-approve');
  assert.equal(review.spender, SPENDER);
  assert.equal(review.unlimited, true);
  assert.deepEqual(review.warnings, ['unlimited-token-approval']);
});

test('transaction review decodes ERC20 transfer and preserves target/value context', () => {
  const data = `0xa9059cbb${wordAddress(RECIPIENT)}${wordUint(420n)}`;
  const review = buildSigningReview420({ method: 'eth_sendTransaction', params: [{ from: ACCOUNT, to: TOKEN, data }] }, { accounts: [ACCOUNT], chainId: '0x420' });
  assert.equal(review.kind, 'erc20-transfer');
  assert.equal(review.recipient, RECIPIENT);
  assert.equal(review.amount, 420n);
  assert.equal(review.target, TOKEN);
  assert.equal(review.value, 0n);
});

test('unknown calldata is surfaced instead of presented as a known action', () => {
  const review = buildSigningReview420({ method: 'eth_sendTransaction', params: [{ from: ACCOUNT, to: TOKEN, data: '0xdeadbeef' }] }, { accounts: [ACCOUNT], chainId: '0x420' });
  assert.equal(review.kind, 'unknown-calldata');
  assert.deepEqual(review.warnings, ['unknown-calldata']);
});

test('transaction signer and chain drift fail before approval', () => {
  assert.throws(() => buildSigningReview420({ method: 'eth_sendTransaction', params: [{ from: RECIPIENT, to: TOKEN }] }, { accounts: [ACCOUNT], chainId: '0x420' }), (error) => error.code === 4100);
  assert.throws(() => buildSigningReview420({ method: 'eth_sendTransaction', params: [{ from: ACCOUNT, to: TOKEN, chainId: '0x421' }] }, { accounts: [ACCOUNT], chainId: '0x420' }), (error) => error.code === 4901);
});

test('typed-data review enforces signer and EIP-712 chain domain binding', () => {
  const typed = JSON.stringify({ domain: { name: '420 Swap', version: '1', chainId: '0x420', verifyingContract: TOKEN }, primaryType: 'Order', types: {}, message: {} });
  const review = buildSigningReview420({ method: 'eth_signTypedData_v4', params: [ACCOUNT, typed] }, { origin: 'https://dapp.example', accounts: [ACCOUNT], chainId: '0x420' });
  assert.equal(review.domain.name, '420 Swap');
  assert.equal(review.domain.verifyingContract, TOKEN);
  assert.equal(review.primaryType, 'Order');
  assert.deepEqual(review.warnings, []);
  assert.throws(() => buildSigningReview420({ method: 'eth_signTypedData_v4', params: [ACCOUNT, JSON.stringify({ domain: { chainId: '0x421' }, types: {}, message: {} })] }, { accounts: [ACCOUNT], chainId: '0x420' }), (error) => error.code === 4901);
});

test('typed data without chain binding is explicitly warned and personal_sign is opaque', () => {
  const typed = buildSigningReview420({ method: 'eth_signTypedData_v4', params: [ACCOUNT, JSON.stringify({ domain: { name: 'legacy' }, types: {}, message: {} })] }, { accounts: [ACCOUNT], chainId: '0x420' });
  assert.deepEqual(typed.warnings, ['typed-data-without-chain-binding']);
  const message = buildSigningReview420({ method: 'personal_sign', params: ['0x1234', ACCOUNT] }, { accounts: [ACCOUNT], chainId: '0x420' });
  assert.deepEqual(message.warnings, ['opaque-message-signature']);
});
