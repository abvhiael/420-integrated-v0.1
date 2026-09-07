import assert from 'node:assert/strict';
import test from 'node:test';
import { OriginPermissionStore420 } from '../core/extension-permissions.js';
import { createExtensionApprovalController420 } from '../core/extension-approval-controller.js';

class MemoryStorage {
  constructor() { this.data = {}; }
  async get(key) { return { [key]: this.data[key] }; }
  async set(value) { Object.assign(this.data, value); }
}

function controller(overrides = {}) {
  const permissionStore = overrides.permissionStore ?? new OriginPermissionStore420(new MemoryStorage());
  return {
    permissionStore,
    request: createExtensionApprovalController420({
      permissionStore,
      getAvailableAccounts: async () => ['0x0000000000000000000000000000000000000420'],
      promptApproval: async () => ({ approved: true }),
      executeApprovedRequest: async (request) => `executed:${request.method}`,
      ...overrides,
    }),
  };
}

test('eth_accounts is passive and empty before origin authorization', async () => {
  const { request } = controller();
  assert.deepEqual(await request({ method: 'eth_accounts', params: [] }, { origin: 'https://app.example' }), []);
});

test('eth_requestAccounts grants only after explicit approval', async () => {
  let prompts = 0;
  const { permissionStore, request } = controller({ promptApproval: async () => { prompts += 1; return { approved: true }; } });
  const accounts = await request({ method: 'eth_requestAccounts', params: [] }, { origin: 'https://app.example' });
  assert.deepEqual(accounts, ['0x0000000000000000000000000000000000000420']);
  assert.deepEqual(await permissionStore.accountsFor('https://app.example'), accounts);
  assert.equal(prompts, 1);
});

test('rejected connection returns EIP-1193 4001 and stores no grant', async () => {
  const { permissionStore, request } = controller({ promptApproval: async () => ({ approved: false }) });
  await assert.rejects(
    request({ method: 'eth_requestAccounts', params: [] }, { origin: 'https://app.example' }),
    (error) => error.code === 4001,
  );
  assert.deepEqual(await permissionStore.accountsFor('https://app.example'), []);
});

test('signing is blocked for unconnected origins', async () => {
  const { request } = controller();
  await assert.rejects(
    request({ method: 'personal_sign', params: ['0x01'] }, { origin: 'https://app.example' }),
    (error) => error.code === 4100,
  );
});

test('connected signing requires approval before execution', async () => {
  let executed = 0;
  const permissionStore = new OriginPermissionStore420(new MemoryStorage());
  await permissionStore.grant('https://app.example', ['0x0000000000000000000000000000000000000420']);
  const request = createExtensionApprovalController420({
    permissionStore,
    getAvailableAccounts: async () => [],
    promptApproval: async () => ({ approved: true }),
    executeApprovedRequest: async (rpcRequest, context) => {
      executed += 1;
      assert.deepEqual(context.accounts, ['0x0000000000000000000000000000000000000420']);
      return `ok:${rpcRequest.method}`;
    },
  });
  assert.equal(await request({ method: 'eth_sendTransaction', params: [{}] }, { origin: 'https://app.example' }), 'ok:eth_sendTransaction');
  assert.equal(executed, 1);
});
