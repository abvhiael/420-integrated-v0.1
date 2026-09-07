import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertKnownWalletAuthority420,
  classifyProviderMethod420,
  classifyWalletAuthorityOperation420,
  requiresWalletApproval420,
  WALLET_READ_METHODS_420,
} from '../core/signing-policy.js';

test('provider methods share one canonical read and privileged authority policy', () => {
  for (const method of WALLET_READ_METHODS_420) assert.equal(classifyProviderMethod420(method), 'read-only');
  assert.equal(classifyProviderMethod420('eth_accounts'), 'accounts-read');
  assert.equal(classifyProviderMethod420('eth_requestAccounts'), 'account-connect');
  assert.equal(classifyProviderMethod420('eth_sendTransaction'), 'owner-transaction');
  assert.equal(classifyProviderMethod420('personal_sign'), 'message-signature');
  assert.equal(classifyProviderMethod420('eth_signTypedData_v4'), 'typed-data-signature');
});

test('internal wallet operations classify owner, passkey, session, recovery and capability administration separately', () => {
  assert.equal(classifyWalletAuthorityOperation420('owner-execution'), 'owner-transaction');
  assert.equal(classifyWalletAuthorityOperation420('passkey-userop'), 'passkey');
  assert.equal(classifyWalletAuthorityOperation420('session-userop'), 'session');
  assert.equal(classifyWalletAuthorityOperation420('recovery-finalize'), 'recovery');
  assert.equal(classifyWalletAuthorityOperation420('capability-grant'), 'capability-admin');
});

test('unknown provider and internal authority actions fail closed with EIP-1193 4200 semantics', () => {
  assert.equal(classifyProviderMethod420('eth_sign'), 'unsupported');
  assert.equal(classifyWalletAuthorityOperation420('arbitrary-signing-path'), 'unsupported');
  assert.throws(() => assertKnownWalletAuthority420({ method: 'eth_sign' }), (error) => error?.code === 4200);
  assert.throws(() => assertKnownWalletAuthority420({ operation: 'arbitrary-signing-path' }), (error) => error?.code === 4200);
});

test('only authority-mutating classifications require explicit wallet approval', () => {
  assert.equal(requiresWalletApproval420('read-only'), false);
  assert.equal(requiresWalletApproval420('accounts-read'), false);
  for (const classification of ['account-connect', 'owner-transaction', 'message-signature', 'typed-data-signature', 'passkey', 'session', 'recovery', 'capability-admin']) {
    assert.equal(requiresWalletApproval420(classification), true);
  }
});
