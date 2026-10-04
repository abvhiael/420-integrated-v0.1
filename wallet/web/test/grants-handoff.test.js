import test from 'node:test';
import assert from 'node:assert/strict';
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../core/abi.js';
import { GRANTS_SERVICE_ID_420, prepareGrantsSmartAccountHandoff420 } from '../core/grants-handoff.js';

const controller = '0x1111111111111111111111111111111111111111';
const account = '0x3333333333333333333333333333333333333333';
const target = '0x6666666666666666666666666666666666666666';
const state = {
  controller,
  factoryAddress: '0x2222222222222222222222222222222222222222',
  smartAccount: account,
  deployed: true,
  owner: controller,
  controllerIsOwner: true,
  recoveryAuthority: ZERO_ADDRESS,
  entryPoint: '0x5555555555555555555555555555555555555555',
  capabilityRegistry: '0x4444444444444444444444444444444444444444',
  salt: ZERO_BYTES32,
};

test('Grants handoff preserves SmartAccount420 as execution authority', async () => {
  const calls = [];
  const provider = { request: async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_call') return '0x';
    if (method === 'eth_estimateGas') return '0x5208';
    throw new Error(method);
  }};
  const prepared = await prepareGrantsSmartAccountHandoff420(provider, controller, state, {
    serviceId: GRANTS_SERVICE_ID_420,
    target,
    data: '0x1234',
  });
  assert.equal(prepared.authority, 'SmartAccount420');
  assert.equal(prepared.serviceId, GRANTS_SERVICE_ID_420);
  assert.equal(prepared.transaction.to, account);
  assert.equal(prepared.target, target);
  assert.equal(prepared.value, 0n);
  assert.equal(prepared.transaction.value, '0x0');
  assert.equal(calls[0][0], 'eth_call');
  assert.equal(calls[1][0], 'eth_estimateGas');
});

test('Grants handoff fails closed on wrong service identity or native value', async () => {
  const provider = { request: async () => { throw new Error('should not call provider'); } };
  await assert.rejects(
    prepareGrantsSmartAccountHandoff420(provider, controller, state, { serviceId: '420/service/not-grants/v1', target, data: '0x1234' }),
    /canonical 420Grants service id/i
  );
  await assert.rejects(
    prepareGrantsSmartAccountHandoff420(provider, controller, state, { serviceId: GRANTS_SERVICE_ID_420, target, data: '0x1234', value: 1n }),
    /must not transfer native value/i
  );
});

test('Grants handoff rejects empty calldata rather than inventing an operation', async () => {
  const provider = { request: async () => { throw new Error('should not call provider'); } };
  await assert.rejects(
    prepareGrantsSmartAccountHandoff420(provider, controller, state, { serviceId: GRANTS_SERVICE_ID_420, target, data: '0x' }),
    /calldata required/i
  );
});
