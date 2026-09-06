import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntimeState } from '../core/passkey-runtime.js';

const zero = '0x0000000000000000000000000000000000000000';
const browser = { credentials: { create() {}, get() {} } };
const config = { features: { passkeys: true } };

function account(overrides = {}) {
  return {
    deployed: true,
    controllerIsOwner: true,
    authorizationEpoch: 2n,
    pendingRecoveryOwner: zero,
    ...overrides,
  };
}

function binding(epoch = '2') {
  return { authorizationEpoch: epoch };
}

test('passkey runtime remains fully blocked when feature flag is disabled', () => {
  const state = passkeyRuntimeState({ features: { passkeys: false } }, account(), binding(), browser);
  assert.equal(state.enabled, false);
  assert.equal(state.canEnroll, false);
  assert.equal(state.canReenroll, false);
  assert.equal(state.canExecute, false);
});

test('passkey runtime fails closed when WebAuthn create/get are unavailable', () => {
  const state = passkeyRuntimeState(config, account(), null, { credentials: {} });
  assert.equal(state.enabled, false);
  assert.match(state.reason, /does not expose WebAuthn/i);
});

test('passkey enrollment requires a deployed owner-controlled SmartAccount420', () => {
  assert.equal(passkeyRuntimeState(config, account({ deployed: false }), null, browser).canEnroll, false);
  assert.equal(passkeyRuntimeState(config, account({ controllerIsOwner: false }), null, browser).canEnroll, false);
  assert.equal(passkeyRuntimeState(config, account(), null, browser).canEnroll, true);
});

test('passkey runtime blocks every action while recovery is pending', () => {
  const state = passkeyRuntimeState(config, account({ pendingRecoveryOwner: '0x1111111111111111111111111111111111111111' }), binding(), browser);
  assert.equal(state.canEnroll, false);
  assert.equal(state.canReenroll, false);
  assert.equal(state.canExecute, false);
  assert.match(state.reason, /recovery is pending/i);
});

test('stale binding enables explicit re-enrollment but never execution', () => {
  const state = passkeyRuntimeState(config, account({ authorizationEpoch: 2n }), binding('1'), browser);
  assert.equal(state.canEnroll, false);
  assert.equal(state.canReenroll, true);
  assert.equal(state.canExecute, false);
  assert.match(state.reason, /stale/i);
});

test('current-epoch binding enables PK42 execution and disables enrollment mutation', () => {
  const state = passkeyRuntimeState(config, account({ authorizationEpoch: 2n }), binding('2'), browser);
  assert.equal(state.canEnroll, false);
  assert.equal(state.canReenroll, false);
  assert.equal(state.canExecute, true);
});
