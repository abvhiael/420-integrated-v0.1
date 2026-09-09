import assert from 'node:assert/strict';
import test from 'node:test';
import { createExtensionApprovalController420 } from '../core/extension-approval-controller.js';
import { OriginPermissionStore420 } from '../core/extension-permissions.js';
import { createExtensionRpcRouter420 } from '../core/extension-rpc-router.js';

class MemoryStorage {
  constructor() { this.value = {}; }
  async get(key) { return { [key]: this.value[key] }; }
  async set(entries) { Object.assign(this.value, entries); }
}

function envelope(id, method, params = []) {
  return {
    source: '420-wallet-content',
    channel: '420-wallet-provider-v1',
    kind: 'rpc',
    origin: 'https://dapp.example',
    request: { id, method, params },
  };
}

const sender = { url: 'https://dapp.example/app', frameId: 0, tab: { id: 42, url: 'https://dapp.example/app' } };

test('dapp connection lifecycle is fail-closed before approval and persistent after approval', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  let prompts = 0;
  const approval = createExtensionApprovalController420({
    permissionStore: store,
    getAvailableAccounts: async () => ['0x0000000000000000000000000000000000000420'],
    promptApproval: async ({ type }) => {
      prompts += 1;
      return type === 'connect' ? { approved: true } : { approved: true };
    },
    executeApprovedRequest: async (request) => `executed:${request.method}`,
  });
  const router = createExtensionRpcRouter420({
    rpcRequest: async (method) => method === 'eth_chainId' ? '0x1a4' : null,
    requestApproval: approval,
  });

  const before = await router(envelope('1', 'eth_accounts'), sender);
  assert.deepEqual(before.result, []);

  const connected = await router(envelope('2', 'eth_requestAccounts'), sender);
  assert.deepEqual(connected.result, ['0x0000000000000000000000000000000000000420']);
  assert.equal(prompts, 1);

  const after = await router(envelope('3', 'eth_accounts'), sender);
  assert.deepEqual(after.result, connected.result);

  const signed = await router(envelope('4', 'personal_sign', ['0x6869', connected.result[0]]), sender);
  assert.equal(signed.result, 'executed:personal_sign');
  assert.equal(prompts, 2);
});

test('a different origin cannot inherit another origin connection grant', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  await store.grant('https://dapp.example', ['0x0000000000000000000000000000000000000420']);
  const approval = createExtensionApprovalController420({
    permissionStore: store,
    getAvailableAccounts: async () => [],
    promptApproval: async () => ({ approved: false }),
    executeApprovedRequest: async () => { throw new Error('must not execute'); },
  });
  const router = createExtensionRpcRouter420({ rpcRequest: async () => null, requestApproval: approval });
  const otherSender = { url: 'https://other.example', frameId: 0, tab: { id: 43, url: 'https://other.example' } };
  const otherEnvelope = { ...envelope('5', 'eth_accounts'), origin: 'https://other.example' };
  const result = await router(otherEnvelope, otherSender);
  assert.deepEqual(result.result, []);
});
