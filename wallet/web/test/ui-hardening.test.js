import test from 'node:test';
import assert from 'node:assert/strict';
import { readErc20Balance, readNetwork } from '../core/portfolio.js';
import { resolveServices } from '../core/services.js';

const token = '0x2222222222222222222222222222222222222222';
const account = '0x3333333333333333333333333333333333333333';
const wordUint = (n) => `0x${BigInt(n).toString(16).padStart(64, '0')}`;
const bytes32Text = (text) => `0x${Buffer.from(text, 'utf8').toString('hex').padEnd(64, '0')}`;

test('network reads fail closed on malformed chain identifiers', async () => {
  const provider = { request: async (method) => method === 'eth_chainId' ? '420' : '0x2a' };
  await assert.rejects(readNetwork(provider), /invalid chain id/i);
});

test('ERC-20 reads reject hostile decimals returned by token contracts', async () => {
  const provider = { request: async (method, params) => {
    if (method !== 'eth_call') throw new Error(method);
    const selector = params[0].data.slice(0, 10);
    if (selector === '0x70a08231') return wordUint(1);
    if (selector === '0x313ce567') return wordUint(256);
    if (selector === '0x95d89b41') return bytes32Text('TEST');
    throw new Error(selector);
  } };
  await assert.rejects(readErc20Balance(provider, { address: token }, account), /invalid token decimals/i);
});

test('ERC-20 reads reject control-character and oversized token symbols', async () => {
  const makeProvider = (symbol) => ({ request: async (method, params) => {
    if (method !== 'eth_call') throw new Error(method);
    const selector = params[0].data.slice(0, 10);
    if (selector === '0x70a08231') return wordUint(1);
    if (selector === '0x313ce567') return wordUint(18);
    if (selector === '0x95d89b41') return bytes32Text(symbol);
    throw new Error(selector);
  } });
  await assert.rejects(readErc20Balance(makeProvider('BAD\n'), { address: token }, account), /invalid token symbol/i);
  await assert.rejects(readErc20Balance(makeProvider('OK'), { address: token, symbol: 'X'.repeat(33), decimals: 18 }, account), /invalid token symbol/i);
});

test('verified manifest rejects duplicate service IDs instead of allowing last-entry override', () => {
  const required = [{ id: 'swap', name: '420 Swap', serviceId: '420/service/swap/v1' }];
  assert.throws(() => resolveServices({
    schema: '420-ecosystem-manifest-v1',
    verified: true,
    services: [
      { serviceId: '420/service/swap/v1', name: '420 Swap', url: 'https://swap.example/' },
      { serviceId: '420/service/swap/v1', name: 'Fake Swap', url: 'https://evil.example/' },
    ],
  }, required), /duplicate ecosystem service id/i);
});

test('verified manifest cannot spoof canonical wallet app identity', () => {
  const required = [{ id: 'swap', name: '420 Swap', serviceId: '420/service/swap/v1' }];
  const [resolved] = resolveServices({
    schema: '420-ecosystem-manifest-v1',
    verified: true,
    services: [{ id: 'evil', serviceId: '420/service/swap/v1', name: 'Definitely Not Swap', url: 'https://swap.example/' }],
  }, required);
  assert.equal(resolved.id, 'swap');
  assert.equal(resolved.name, '420 Swap');
  assert.equal(resolved.serviceId, '420/service/swap/v1');
  assert.equal(resolved.url, 'https://swap.example/');
});

test('service discovery rejects credential-bearing launch URLs', () => {
  const required = [{ id: 'swap', name: '420 Swap', serviceId: '420/service/swap/v1' }];
  assert.throws(() => resolveServices({
    schema: '420-ecosystem-manifest-v1',
    verified: true,
    services: [{ serviceId: '420/service/swap/v1', name: '420 Swap', url: 'https://user:pass@swap.example/' }],
  }, required), /credentials are not permitted/i);
});
