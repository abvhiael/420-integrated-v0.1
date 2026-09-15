import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RPC0_ARCHITECTURE_420,
  assertRpcArchitecture420,
  validateRpcArchitecture420,
  type RpcArchitecture420,
} from '../src/architecture.js';

function withArchitecture(overrides: Partial<RpcArchitecture420>): RpcArchitecture420 {
  return { ...RPC0_ARCHITECTURE_420, ...overrides };
}

test('RPC-0 default architecture satisfies the authority and isolation contract', () => {
  const result = validateRpcArchitecture420(RPC0_ARCHITECTURE_420);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.doesNotThrow(() => assertRpcArchitecture420(RPC0_ARCHITECTURE_420));
});

test('RPC-0 fails closed if Engine API or signing authority is introduced', () => {
  const unsafe = withArchitecture({
    engineApiExposed: true as never,
    signsTransactions: true as never,
    storesWalletKeys: true as never,
    decidesFinality: true as never,
    rewritesSignedTransactions: true as never,
  });
  const result = validateRpcArchitecture420(unsafe);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /Engine API/);
  assert.match(result.errors.join('\n'), /sign transactions/);
  assert.match(result.errors.join('\n'), /wallet signing keys/);
  assert.match(result.errors.join('\n'), /finality/);
  assert.match(result.errors.join('\n'), /rewrite signed transaction/);
});

test('RPC-0 rejects wrong-chain and authoritative Indexer upstreams', () => {
  const unsafe = withArchitecture({
    upstreams: [
      {
        id: 'node420-wrong-chain',
        class: 'execution-rpc',
        transport: 'http',
        expectedChainId: 1n,
        authoritative: true,
        allowsTransactionSubmission: true,
      },
      {
        id: '420indexer-unsafe',
        class: 'indexer-api',
        transport: 'http',
        expectedChainId: 420n,
        authoritative: true,
        allowsTransactionSubmission: true,
      },
    ],
  });
  const result = validateRpcArchitecture420(unsafe);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /wrong chain ID/);
  assert.match(result.errors.join('\n'), /must be non-authoritative/);
  assert.match(result.errors.join('\n'), /must not accept transaction submission/);
});

test('RPC-0 requires TLS on public transports and a canonical execution upstream', () => {
  const unsafe = withArchitecture({
    publicTransports: ['http'],
    upstreams: [
      {
        id: '420indexer-only',
        class: 'indexer-api',
        transport: 'http',
        expectedChainId: 420n,
        authoritative: false,
        allowsTransactionSubmission: false,
      },
    ],
  });
  const result = validateRpcArchitecture420(unsafe);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /TLS-protected/);
  assert.match(result.errors.join('\n'), /execution-rpc upstream is required/);
});

test('RPC-0 requires finalized disagreement to fail closed', () => {
  const unsafe = withArchitecture({ finalizedDisagreementPolicy: 'prefer-fastest' as never });
  assert.throws(() => assertRpcArchitecture420(unsafe), /finalized-state disagreement must fail closed/);
});
