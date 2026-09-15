import assert from 'node:assert/strict';
import test from 'node:test';

import {
  discoverExecutionUpstream420,
  discoverIndexerUpstream420,
  eligibleUpstreams420,
  validateUpstreamDescriptor420,
  validateUpstreamRegistry420,
  type IndexerMetadataReader420,
  type JsonRpcRequester420,
  type RpcUpstreamDescriptor420,
} from '../src/upstreams.js';

const execution: RpcUpstreamDescriptor420 = {
  id: 'node420-a',
  class: 'execution-rpc',
  endpoint: 'http://node420-a.internal:8545',
  transport: 'http',
  expectedChainId: 420n,
  authoritative: true,
  allowsTransactionSubmission: true,
  enabled: true,
  priority: 10,
};

const indexer: RpcUpstreamDescriptor420 = {
  id: '420indexer-a',
  class: 'indexer-api',
  endpoint: 'http://420indexer-a.internal:4201',
  transport: 'http',
  expectedChainId: 420n,
  authoritative: false,
  allowsTransactionSubmission: false,
  enabled: true,
  priority: 20,
};

class MockExecutionRequester implements JsonRpcRequester420 {
  constructor(private readonly chainId = '0x1a4', private readonly fail = false) {}

  async request(method: string, params: readonly unknown[] = []): Promise<unknown> {
    if (this.fail) throw new Error('unreachable');
    if (method === 'eth_chainId') return this.chainId;
    if (method === 'web3_clientVersion') return 'node420/test';
    if (method === 'eth_blockNumber') return '0x2a';
    if (method === 'eth_getBlockByNumber') {
      const tag = params[0];
      if (tag === 'safe' || tag === 'finalized') return { number: '0x20', hash: '0xabc' };
    }
    throw new Error(`unsupported ${method}`);
  }
}

test('registry accepts separated execution and derived indexer upstreams', () => {
  assert.deepEqual(validateUpstreamRegistry420({ expectedChainId: 420n, upstreams: [execution, indexer] }), []);
});

test('registry rejects duplicate IDs and missing enabled execution provider', () => {
  const disabled = { ...execution, enabled: false };
  const errors = validateUpstreamRegistry420({ expectedChainId: 420n, upstreams: [disabled, { ...disabled }] });
  assert(errors.some((error) => error.includes('duplicate upstream ID')));
  assert(errors.some((error) => error.includes('at least one enabled execution-rpc upstream')));
});

test('descriptor validation rejects wrong-chain, endpoint mismatch and authoritative indexer', () => {
  const hostile: RpcUpstreamDescriptor420 = {
    ...indexer,
    endpoint: 'ws://indexer.internal:4201',
    transport: 'http',
    expectedChainId: 1n,
    authoritative: true,
    allowsTransactionSubmission: true,
    priority: -1,
  };
  const errors = validateUpstreamDescriptor420(hostile);
  assert(errors.some((error) => error.includes('wrong chain ID')));
  assert(errors.some((error) => error.includes('endpoint scheme')));
  assert(errors.some((error) => error.includes('non-authoritative')));
  assert(errors.some((error) => error.includes('must not accept transaction submission')));
  assert(errors.some((error) => error.includes('non-negative integer')));
});

test('execution discovery proves identity and runtime capabilities', async () => {
  const report = await discoverExecutionUpstream420(execution, new MockExecutionRequester());
  assert.equal(report.reachable, true);
  assert.equal(report.eligible, true);
  assert.equal(report.observedChainId, 420n);
  assert.equal(report.clientVersion, 'node420/test');
  assert(report.capabilities.includes('chain-identity'));
  assert(report.capabilities.includes('head-read'));
  assert(report.capabilities.includes('safe-read'));
  assert(report.capabilities.includes('finalized-read'));
  assert(report.capabilities.includes('transaction-submission'));
});

test('wrong-chain execution provider is reachable but never eligible', async () => {
  const report = await discoverExecutionUpstream420(execution, new MockExecutionRequester('0x1'));
  assert.equal(report.reachable, true);
  assert.equal(report.eligible, false);
  assert.equal(report.observedChainId, 1n);
  assert(report.reasons.some((reason) => reason.includes('wrong chain ID')));
});

test('unreachable execution provider fails closed', async () => {
  const report = await discoverExecutionUpstream420(execution, new MockExecutionRequester('0x1a4', true));
  assert.equal(report.reachable, false);
  assert.equal(report.eligible, false);
  assert(report.reasons.some((reason) => reason.includes('discovery failed')));
});

test('indexer discovery proves chain identity, readiness and derived semantics', async () => {
  const reader: IndexerMetadataReader420 = {
    async metadata() {
      return { chainId: 420n, service: '420Indexer', ready: true, authoritative: false };
    },
  };
  const report = await discoverIndexerUpstream420(indexer, reader);
  assert.equal(report.reachable, true);
  assert.equal(report.eligible, true);
  assert(report.capabilities.includes('chain-identity'));
  assert(report.capabilities.includes('derived-read'));
});

test('wrong-chain or unready indexer never enters eligible pool', async () => {
  const wrongChain = await discoverIndexerUpstream420(indexer, {
    async metadata() {
      return { chainId: 1n, service: '420Indexer', ready: true, authoritative: false };
    },
  });
  const unready = await discoverIndexerUpstream420(indexer, {
    async metadata() {
      return { chainId: 420n, service: '420Indexer', ready: false, authoritative: false };
    },
  });
  assert.equal(wrongChain.eligible, false);
  assert.equal(unready.eligible, false);
  assert.deepEqual(eligibleUpstreams420([wrongChain, unready]), []);
});

test('eligible pool can be filtered by upstream class', async () => {
  const executionReport = await discoverExecutionUpstream420(execution, new MockExecutionRequester());
  const indexerReport = await discoverIndexerUpstream420(indexer, {
    async metadata() {
      return { chainId: 420n, service: '420Indexer', ready: true, authoritative: false };
    },
  });
  assert.deepEqual(eligibleUpstreams420([executionReport, indexerReport], 'execution-rpc').map((item) => item.id), ['node420-a']);
  assert.deepEqual(eligibleUpstreams420([executionReport, indexerReport], 'indexer-api').map((item) => item.id), ['420indexer-a']);
});
