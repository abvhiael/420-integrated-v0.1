import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bindExchangeRuntime,
  inspectExchangeTestnetDeployment,
  REQUIRED_EXCHANGE_CONTRACTS,
} from '../core/deployment.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..', '..');
const unresolved = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deployments/exchange/testnet.runtime.json'), 'utf8'));
const template = JSON.parse(fs.readFileSync(path.join(root, 'runtime-config.json'), 'utf8'));

function resolvedFixture() {
  const contracts = Object.fromEntries(
    REQUIRED_EXCHANGE_CONTRACTS.map((name, index) => [
      name,
      '0x' + (index + 1).toString(16).padStart(40, '0'),
    ]),
  );
  return {
    ...structuredClone(unresolved),
    status: 'RESOLVED',
    network: {
      name: '420 Integrated Testnet',
      chainId: '0x420',
      rpcUrl: 'https://rpc.testnet.example.invalid',
      explorerUrl: 'https://explorer.testnet.example.invalid',
    },
    services: {
      exchangeApiUrl: 'https://api.testnet.example.invalid/exchange',
      exchangeStreamUrl: 'wss://api.testnet.example.invalid/exchange/stream',
    },
    contracts,
    marketSubjects: ['market/420-usdc'],
  };
}

test('checked-in testnet deployment remains explicitly unresolved until real deployment evidence exists', () => {
  const result = inspectExchangeTestnetDeployment(unresolved);
  assert.equal(result.resolved, false);
  assert.equal(result.status, 'UNRESOLVED_UNTIL_DEPLOYMENT');
  assert.ok(result.blockers.includes('Exchange contract addresses'));
});

test('resolved deployment binds network, services, contracts and subjects into V14 runtime', () => {
  const deployment = resolvedFixture();
  const runtime = bindExchangeRuntime(template, deployment);
  assert.equal(runtime.network.chainId, '0x420');
  assert.equal(runtime.network.rpcUrl, deployment.network.rpcUrl);
  assert.equal(runtime.api.baseUrl, deployment.services.exchangeApiUrl);
  assert.equal(runtime.api.streamUrl, deployment.services.exchangeStreamUrl);
  assert.equal(runtime.contracts.ExchangeAtomicRouter420, deployment.contracts.ExchangeAtomicRouter420);
  assert.deepEqual(runtime.api.marketSubjects, deployment.marketSubjects);
  assert.equal(runtime.deployment.environment, 'testnet');
});

test('resolved deployment rejects zero contract addresses', () => {
  const deployment = resolvedFixture();
  deployment.contracts.ExchangeAtomicRouter420 = '0x0000000000000000000000000000000000000000';
  assert.throws(() => inspectExchangeTestnetDeployment(deployment), /zero ExchangeAtomicRouter420/);
});

test('resolved deployment rejects insecure endpoints', () => {
  const deployment = resolvedFixture();
  deployment.network.rpcUrl = 'http://rpc.testnet.example.invalid';
  assert.throws(() => inspectExchangeTestnetDeployment(deployment), /insecure RPC URL/);
});

test('runtime binding refuses unresolved testnet metadata', () => {
  assert.throws(() => bindExchangeRuntime(template, unresolved), /testnet deployment is unresolved/);
});
