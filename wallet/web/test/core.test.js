import test from 'node:test';
import assert from 'node:assert/strict';
import { JsonRpcProvider420 } from '../core/provider.js';
import { CORE_SERVICES, validateRuntimeConfig } from '../core/config.js';
import { resolveServices } from '../core/services.js';

test('runtime config accepts deferred production endpoints', () => {
  assert.equal(validateRuntimeConfig({ network: { rpcUrl: null }, services: [] }), true);
});

test('verified manifest resolves known core services and leaves missing services unavailable', () => {
  const services = resolveServices({
    schema: '420-ecosystem-manifest-v1',
    verified: true,
    services: [{ serviceId: '420/service/search/v1', name: '420 Search', url: 'https://search.example/' }],
  }, CORE_SERVICES);
  const search = services.find((service) => service.id === 'search');
  const ai = services.find((service) => service.id === 'ai');
  assert.equal(search.available, true);
  assert.equal(search.url, 'https://search.example/');
  assert.equal(ai.available, false);
});

test('unverified ecosystem manifest fails closed', () => {
  assert.throws(() => resolveServices({ schema: '420-ecosystem-manifest-v1', verified: false, services: [] }, CORE_SERVICES));
});

test('json rpc provider sends standard JSON-RPC request', async () => {
  let body;
  const provider = new JsonRpcProvider420({
    rpcUrl: 'https://rpc.example/',
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ jsonrpc: '2.0', id: body.id, result: '0x420' }) };
    },
  });
  assert.equal(await provider.request('eth_chainId'), '0x420');
  assert.equal(body.method, 'eth_chainId');
  assert.deepEqual(body.params, []);
});
