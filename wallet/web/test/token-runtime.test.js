import test from 'node:test';
import assert from 'node:assert/strict';
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../core/abi.js';
import {
  TOKEN_CREATION_FEE_WEI_420,
  TOKEN_SERVICE_ID_420,
  TOKEN_COMMUNITY_VAULT_ID_420,
  validateTokenRuntime420,
} from '../core/token-runtime.js';
import { prepareTokenDeploymentHandoff420 } from '../core/token-handoff.js';

const addr = (n) => `0x${String(n).padStart(40, '0')}`;
const hash = (n) => `0x${String(n).padStart(64, '0')}`;
const controller = addr(11);
const account = addr(12);
const state = {
  controller,
  factoryAddress: addr(13),
  smartAccount: account,
  deployed: true,
  owner: controller,
  controllerIsOwner: true,
  recoveryAuthority: ZERO_ADDRESS,
  entryPoint: addr(14),
  capabilityRegistry: addr(15),
  salt: ZERO_BYTES32,
};
const binding = () => ({
  serviceId: TOKEN_SERVICE_ID_420,
  chainId: 420,
  version: 1,
  factory: {address: addr(21), codeHash: hash(21)},
  templateRegistry: {address: addr(22), codeHash: hash(22)},
  communityTreasuryVault: {address: addr(23), codeHash: hash(23)},
  communityTreasuryVaultId: TOKEN_COMMUNITY_VAULT_ID_420,
});

test('420Token runtime requires distinct verified factory, registry and Vault identities', () => {
  const r = validateTokenRuntime420(binding());
  assert.equal(r.factory.address, addr(21));
  const bad = binding();
  bad.communityTreasuryVault.address = bad.factory.address;
  assert.throws(() => validateTokenRuntime420(bad), /dependency alias/);
  const zeroHash = binding();
  zeroHash.templateRegistry.codeHash = `0x${'0'.repeat(64)}`;
  assert.throws(() => validateTokenRuntime420(zeroHash), /unverified/);
});

test('420Token runtime fails closed on wrong service, version or Vault identity', () => {
  const wrongService = binding();
  wrongService.serviceId = '420/service/not-token/v1';
  assert.throws(() => validateTokenRuntime420(wrongService), /service id/);
  const wrongVersion = binding();
  wrongVersion.version = 2;
  assert.throws(() => validateTokenRuntime420(wrongVersion), /version/);
  const wrongVault = binding();
  wrongVault.communityTreasuryVaultId = 'wrong';
  assert.throws(() => validateTokenRuntime420(wrongVault), /vault id/);
});

test('420Token handoff preserves SmartAccount420 authority and exact fee', async () => {
  const calls = [];
  const provider = { request: async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_call') return '0x';
    if (method === 'eth_estimateGas') return '0x5208';
    throw new Error(method);
  }};
  const prepared = await prepareTokenDeploymentHandoff420(provider, controller, state, binding(), {
    serviceId: TOKEN_SERVICE_ID_420,
    target: addr(21),
    value: TOKEN_CREATION_FEE_WEI_420,
    data: '0x1234',
  });
  assert.equal(prepared.authority, 'SmartAccount420');
  assert.equal(prepared.transaction.to, account);
  assert.equal(prepared.target, addr(21));
  assert.equal(prepared.value, TOKEN_CREATION_FEE_WEI_420);
  assert.equal(calls[0][0], 'eth_call');
  assert.equal(calls[1][0], 'eth_estimateGas');
});

test('420Token handoff rejects wrong factory, fee and empty calldata before wallet execution', async () => {
  const provider = { request: async () => { throw new Error('provider must not be called'); } };
  await assert.rejects(prepareTokenDeploymentHandoff420(provider, controller, state, binding(), {
    serviceId: TOKEN_SERVICE_ID_420, target: addr(99), value: TOKEN_CREATION_FEE_WEI_420, data: '0x1234',
  }), /factory target/);
  await assert.rejects(prepareTokenDeploymentHandoff420(provider, controller, state, binding(), {
    serviceId: TOKEN_SERVICE_ID_420, target: addr(21), value: 41n * 10n ** 18n, data: '0x1234',
  }), /exactly 42/);
  await assert.rejects(prepareTokenDeploymentHandoff420(provider, controller, state, binding(), {
    serviceId: TOKEN_SERVICE_ID_420, target: addr(21), value: TOKEN_CREATION_FEE_WEI_420, data: '0x',
  }), /calldata/);
});
