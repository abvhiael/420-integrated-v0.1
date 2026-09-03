import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCapabilityGrant, CANONICAL_CAPABILITY_REGISTRY_420 } from '../core/capabilities.js';

const account = '0x3333333333333333333333333333333333333333';
const principal = '0x7777777777777777777777777777777777777777';
const componentId = `0x${'11'.repeat(32)}`;
const capabilityId = `0x${'22'.repeat(32)}`;
const scopeHash = `0x${'33'.repeat(32)}`;
const grantId = `0x${'44'.repeat(32)}`;
const word = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
const uintWord = (n) => BigInt(n).toString(16).padStart(64, '0');

function grantResult({ component = componentId, revoked = false } = {}) {
  return `0x${[
    word(principal),
    word(component),
    word(capabilityId),
    word(scopeHash),
    uintWord(42),
    uintWord(420),
    uintWord(3600),
    uintWord(10),
    uintWord(999999),
    uintWord(revoked ? 1 : 0),
  ].join('')}`;
}

function providerFor({ component = componentId, revoked = false } = {}) {
  return { request: async (method, params) => {
    if (method === 'eth_getCode') return '0x6001';
    if (method !== 'eth_call') throw new Error(method);
    const data = params[0].data;
    if (data.startsWith('0x2b081d1d')) return `0x${word(componentId)}`;
    if (data.startsWith('0x918e9de3')) return grantResult({ component, revoked });
    if (data.startsWith('0x4a8f2a54')) return `0x${uintWord(7)}${uintWord(84)}`;
    throw new Error(`unexpected calldata ${data}`);
  } };
}

const smartAccountState = {
  deployed: true,
  smartAccount: account,
  capabilityRegistry: CANONICAL_CAPABILITY_REGISTRY_420,
};

test('capability inspection decodes canonical grant and usage state', async () => {
  const inspection = await inspectCapabilityGrant(providerFor(), smartAccountState, grantId);
  assert.equal(inspection.exists, true);
  assert.equal(inspection.belongsToAccount, true);
  assert.equal(inspection.grant.principal, principal);
  assert.equal(inspection.grant.capabilityId, capabilityId);
  assert.equal(inspection.grant.perCallLimit, 42n);
  assert.equal(inspection.grant.periodLimit, 420n);
  assert.equal(inspection.usage.used, 84n);
  assert.equal(inspection.grant.revoked, false);
});

test('capability inspection identifies revoked grants without mutating them', async () => {
  const inspection = await inspectCapabilityGrant(providerFor({ revoked: true }), smartAccountState, grantId);
  assert.equal(inspection.exists, true);
  assert.equal(inspection.grant.revoked, true);
});

test('capability inspection marks grants from another component as foreign', async () => {
  const foreign = `0x${'55'.repeat(32)}`;
  const inspection = await inspectCapabilityGrant(providerFor({ component: foreign }), smartAccountState, grantId);
  assert.equal(inspection.belongsToAccount, false);
});

test('capability inspection fails closed on noncanonical registry binding', async () => {
  await assert.rejects(
    inspectCapabilityGrant(providerFor(), { ...smartAccountState, capabilityRegistry: '0x9999999999999999999999999999999999999999' }, grantId),
    /canonical CapabilityRegistry420/,
  );
});

test('capability inspection rejects malformed grant ids', async () => {
  await assert.rejects(inspectCapabilityGrant(providerFor(), smartAccountState, '0x1234'), /invalid bytes32/);
});
