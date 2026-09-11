import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { IndexerQueryService420 } from '../src/query-service.js';
import { protocolObjectState420 } from '../src/protocol-object-service.js';

class FakeDb420 implements SqlExecutor420 {
  calls: Array<{ text: string; params: readonly unknown[] }> = [];
  queue: unknown[] = [];

  async query(text: string, params: readonly unknown[] = []): Promise<unknown> {
    this.calls.push({ text, params });
    return this.queue.shift() ?? { rows: [] };
  }
}

test('protocol object state lookup queries the canonical latest-state projection and maps a stable DTO', async () => {
  const db = new FakeDb420();
  const service = new IndexerQueryService420(db);
  db.queue.push({
    rows: [{
      chain_id: '420',
      protocol: '420Governance',
      object_key: 'proposal:0xabc',
      contract_address: '0xcontract',
      event_name: 'ProposalActivated',
      lifecycle_state: 'ACTIVE',
      fields: { proposalId: 'proposal:0xabc', nested: { quorum: 42 } },
      block_number: '88',
      block_hash: '0xblock',
      tx_hash: '0xtx',
      tx_index: 2,
      log_index: 7
    }]
  });

  const result = await protocolObjectState420(service, 420n, '420Governance', 'proposal:0xabc');

  assert.match(db.calls[0]!.text, /idx_protocol_latest_object_state/);
  assert.deepEqual(db.calls[0]!.params, ['420', '420Governance', 'proposal:0xabc']);
  assert.deepEqual(result, {
    chainId: '420',
    protocol: '420Governance',
    objectKey: 'proposal:0xabc',
    contractAddress: '0xcontract',
    eventName: 'ProposalActivated',
    lifecycleState: 'ACTIVE',
    fields: { proposalId: 'proposal:0xabc', nested: { quorum: 42 } },
    blockNumber: '88',
    blockHash: '0xblock',
    transactionHash: '0xtx',
    transactionIndex: 2,
    logIndex: 7
  });
});

test('protocol object state lookup returns null when the object is absent and fails closed on empty identifiers', async () => {
  const db = new FakeDb420();
  const service = new IndexerQueryService420(db);
  db.queue.push({ rows: [] });

  assert.equal(await protocolObjectState420(service, 420n, '420Names', 'name:alice'), null);
  await assert.rejects(() => protocolObjectState420(service, 420n, '', 'name:alice'), /protocol is required/);
  await assert.rejects(() => protocolObjectState420(service, 420n, '420Names', ''), /object key is required/);
});
