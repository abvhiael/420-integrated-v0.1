import test from 'node:test';
import assert from 'node:assert/strict';
import type { SqlExecutor420 } from '../src/core-projections.js';
import { IndexerPublicApiAdapter420 } from '../src/api-surface.js';
import { IndexerQueryService420 } from '../src/query-service.js';
import { logDto420, receiptDto420 } from '../src/receipt-log-dto.js';

class FakeDb420 implements SqlExecutor420 {
  queue: unknown[] = [];
  calls: Array<{ text: string; params?: readonly unknown[] }> = [];
  async query(text: string, params?: readonly unknown[]): Promise<unknown> {
    this.calls.push({ text, params });
    return this.queue.shift() ?? { rows: [] };
  }
}

test('receipt DTO maps transport-safe receipt fields', () => {
  assert.deepEqual(receiptDto420({
    chain_id: '420', tx_hash: '0xabc', block_number: '12', block_hash: '0x12', tx_index: 1,
    status: 1, contract_address: null
  }), {
    chainId: '420', transactionHash: '0xabc', blockNumber: '12', blockHash: '0x12', transactionIndex: 1,
    status: 1, contractAddress: null
  });
});

test('log DTO maps topics and indexed log position', () => {
  assert.deepEqual(logDto420({
    chain_id: '420', block_number: '12', block_hash: '0x12', tx_hash: '0xabc', tx_index: 1,
    log_index: 2, address: '0xcontract', topics: ['0x01', '0x02'], data: '0xdeadbeef'
  }), {
    chainId: '420', blockNumber: '12', blockHash: '0x12', transactionHash: '0xabc', transactionIndex: 1,
    logIndex: 2, address: '0xcontract', topics: ['0x01', '0x02'], data: '0xdeadbeef'
  });
});

test('public API retrieves receipts and paged logs without leaking query rows', async () => {
  const db = new FakeDb420();
  const api = new IndexerPublicApiAdapter420(new IndexerQueryService420(db));

  db.queue.push({ rows: [{
    chain_id: '420', tx_hash: '0xabc', block_number: '12', block_hash: '0x12', tx_index: 1,
    status: 1, contract_address: '0xcreated'
  }] });
  const receipt = await api.receipt(420n, '0xABC');
  assert.equal(receipt?.transactionHash, '0xabc');
  assert.equal(receipt?.contractAddress, '0xcreated');
  assert.deepEqual(db.calls[0]?.params, ['420', '0xabc']);

  db.queue.push({ rows: [{
    chain_id: '420', block_number: '12', block_hash: '0x12', tx_hash: '0xabc', tx_index: 1,
    log_index: 2, address: '0xcontract', topics: ['0x01'], data: '0xdata'
  }] });
  const logs = await api.logs(420n, { address: '0xcontract', limit: 10 });
  assert.equal(logs.items[0]?.logIndex, 2);
  assert.deepEqual(logs.items[0]?.topics, ['0x01']);
});

test('receipt/log DTOs fail closed on malformed projection rows', () => {
  assert.throws(() => receiptDto420({
    chain_id: '420', tx_hash: '0xabc', block_number: '12', block_hash: '0x12', tx_index: 1,
    status: 9, contract_address: null
  }), /invalid status/);

  assert.throws(() => logDto420({
    chain_id: '420', block_number: '12', block_hash: '0x12', tx_hash: '0xabc', tx_index: 1,
    log_index: 2, address: '0xcontract', topics: [123], data: '0xdata'
  }), /invalid topics/);
});
