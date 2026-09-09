import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMobileExecution420, prepareMobileRecoveryAction420 } from '../core/wallet-surfaces.js';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const OWNER = '0x2222222222222222222222222222222222222222';
const RECOVERY = '0x3333333333333333333333333333333333333333';

const state = {
  deployed: true,
  smartAccount: ACCOUNT,
  owner: OWNER,
  controllerIsOwner: true,
  entryPoint: '0x4444444444444444444444444444444444444444',
  capabilityRegistry: '0x5555555555555555555555555555555555555555',
  recoveryAuthority: RECOVERY,
  pendingRecoveryOwner: '0x0000000000000000000000000000000000000000',
  recoveryExecutableAt: 0n,
  authorizationEpoch: 3n,
};

function runtimeWith(results = {}) {
  return {
    async request(request) {
      const { method } = request;
      const queue = results[method] ?? [];
      if (!queue.length) throw new Error(`unexpected RPC method: ${method}`);
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

test('owner mobile execution fails closed without controller', async () => {
  await assert.rejects(
    prepareMobileExecution420({ runtime: runtimeWith(), smartAccountState: state, request: { target: RECOVERY } }),
    /owner controller required/,
  );
});

test('unsupported execution mode is rejected', async () => {
  await assert.rejects(
    prepareMobileExecution420({ runtime: runtimeWith(), mode: 'raw-key', controller: OWNER, smartAccountState: state, request: {} }),
    /unsupported mobile execution mode/,
  );
});

test('owner execution preserves SmartAccount simulation boundary', async () => {
  const target = '0x6666666666666666666666666666666666666666';
  const runtime = runtimeWith({
    eth_call: ['0x'],
    eth_estimateGas: ['0x5208'],
  });
  const prepared = await prepareMobileExecution420({
    runtime,
    mode: 'owner',
    controller: OWNER,
    smartAccountState: state,
    request: { target, value: 0n, data: '0x' },
  });
  assert.equal(prepared.smartAccount, ACCOUNT);
  assert.equal(prepared.target, target);
  assert.equal(prepared.simulation.passed, true);
});

test('recovery proposal enforces recovery authority role before RPC', async () => {
  await assert.rejects(
    prepareMobileRecoveryAction420({
      runtime: runtimeWith(),
      action: 'proposeRecovery',
      actor: OWNER,
      smartAccountState: state,
      value: '0x7777777777777777777777777777777777777777',
    }),
    /configured recovery authority/,
  );
});

test('recovery finalization is blocked before the timelock is ready', async () => {
  const pending = {
    ...state,
    pendingRecoveryOwner: '0x7777777777777777777777777777777777777777',
    recoveryExecutableAt: 2000n,
  };
  await assert.rejects(
    prepareMobileRecoveryAction420({
      runtime: runtimeWith(),
      action: 'finalizeRecovery',
      actor: RECOVERY,
      smartAccountState: pending,
      nowSeconds: 1999,
    }),
    /not ready to finalize/,
  );
});

test('recovery cancel keeps owner authority boundary', async () => {
  const pending = {
    ...state,
    pendingRecoveryOwner: '0x7777777777777777777777777777777777777777',
    recoveryExecutableAt: 2000n,
  };
  const runtime = runtimeWith({ eth_call: ['0x'], eth_estimateGas: ['0x5208'] });
  const prepared = await prepareMobileRecoveryAction420({
    runtime,
    action: 'cancelRecovery',
    actor: OWNER,
    smartAccountState: pending,
    nowSeconds: 1000,
  });
  assert.equal(prepared.action, 'cancelRecovery');
  assert.equal(prepared.actor, OWNER);
});
