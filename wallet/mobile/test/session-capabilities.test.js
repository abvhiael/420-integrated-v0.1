import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeMobileGrant420,
  prepareMobileSessionAdmin420,
  prepareMobileSessionExecution420,
  sendMobileSessionExecution420,
} from '../core/session-capabilities.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const ACCOUNT = '0x3333333333333333333333333333333333333333';
const REGISTRY = '0x0000000000000000000000000000000000000421';

function runtime() {
  return { request: async () => { throw new Error('unexpected RPC'); } };
}

function state(overrides = {}) {
  return {
    deployed: true,
    smartAccount: ACCOUNT,
    owner: OWNER,
    controllerIsOwner: true,
    authorizationEpoch: 7n,
    capabilityRegistry: REGISTRY,
    recoveryAuthority: '0x4444444444444444444444444444444444444444',
    ...overrides,
  };
}

test('mobile grant summary presents active, scheduled, expired, and revoked states', () => {
  const base = {
    exists: true,
    belongsToAccount: true,
    grant: {
      principal: OTHER,
      capabilityId: `0x${'1'.repeat(64)}`,
      scopeHash: `0x${'2'.repeat(64)}`,
      perCallLimit: 5n,
      periodLimit: 20n,
      periodSeconds: 60n,
      validFrom: 100n,
      validUntil: 200n,
      revoked: false,
    },
    usage: { periodIndex: 2n, used: 3n },
  };
  assert.equal(summarizeMobileGrant420(base, 150).state, 'active');
  assert.equal(summarizeMobileGrant420(base, 50).state, 'scheduled');
  assert.equal(summarizeMobileGrant420(base, 250).state, 'expired');
  assert.equal(summarizeMobileGrant420({ ...base, grant: { ...base.grant, revoked: true } }, 150).state, 'revoked');
});

test('session administration fails closed for non-owner controller before RPC', async () => {
  await assert.rejects(
    prepareMobileSessionAdmin420({ runtime: runtime(), action: 'enableSessionKey', controller: OTHER, smartAccountState: state(), sessionKey: OTHER }),
    /not the on-chain SmartAccount420 owner/,
  );
});

test('session administration rejects unsupported actions', async () => {
  await assert.rejects(
    prepareMobileSessionAdmin420({ runtime: runtime(), action: 'destroyEverything', controller: OWNER, smartAccountState: state(), sessionKey: OTHER }),
    /unsupported mobile session admin action/,
  );
});

test('session execution requires a mobile runtime and deployed account', async () => {
  await assert.rejects(prepareMobileSessionExecution420({}), /mobile runtime adapter required/);
  await assert.rejects(prepareMobileSessionExecution420({ runtime: runtime(), smartAccountState: { deployed: false } }), /deployed SmartAccount420 required/);
});

test('session send requires a broadcast-ready prepared operation', async () => {
  await assert.rejects(sendMobileSessionExecution420({ runtime: runtime(), prepared: { broadcastReady: false } }), /prepared mobile session execution required/);
});
