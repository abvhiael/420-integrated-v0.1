import test from 'node:test';
import assert from 'node:assert/strict';
import { protocolEventDto420, protocolObjectStateDto420 } from '../src/public-dto.js';

test('protocol event DTO maps protocol projection rows into transport-safe typed output', () => {
  const dto = protocolEventDto420({
    chain_id: '420',
    block_number: '77',
    block_hash: '0xblock',
    tx_hash: '0xtx',
    tx_index: 2,
    log_index: 4,
    contract_address: '0xcontract',
    protocol: '420Governance',
    event_name: 'ProposalCreated',
    object_key: 'proposal:42',
    lifecycle_state: 'PENDING',
    fields: { proposalId: '42', active: true, nested: { count: 2 } }
  });

  assert.deepEqual(dto, {
    chainId: '420',
    blockNumber: '77',
    blockHash: '0xblock',
    transactionHash: '0xtx',
    transactionIndex: 2,
    logIndex: 4,
    contractAddress: '0xcontract',
    protocol: '420Governance',
    eventName: 'ProposalCreated',
    objectKey: 'proposal:42',
    lifecycleState: 'PENDING',
    fields: { proposalId: '42', active: true, nested: { count: 2 } }
  });
});

test('protocol object state DTO requires stable object identity and preserves null lifecycle state', () => {
  const dto = protocolObjectStateDto420({
    chain_id: 420n,
    protocol: '420Names',
    object_key: 'name:alice',
    contract_address: '0xnames',
    event_name: 'NameRegistered',
    lifecycle_state: null,
    fields: { labelHash: '0xabc', owner: '0xdef' },
    block_number: 88n,
    block_hash: '0x88',
    tx_hash: '0xtx88',
    tx_index: '1',
    log_index: '0'
  });

  assert.equal(dto.chainId, '420');
  assert.equal(dto.objectKey, 'name:alice');
  assert.equal(dto.lifecycleState, null);
  assert.equal(dto.blockNumber, '88');
  assert.deepEqual(dto.fields, { labelHash: '0xabc', owner: '0xdef' });
});

test('protocol DTO mapping fails closed on non-JSON field values', () => {
  assert.throws(() => protocolEventDto420({
    chain_id: '420',
    block_number: '1',
    block_hash: '0x1',
    tx_hash: '0xtx',
    tx_index: 0,
    log_index: 0,
    contract_address: '0xcontract',
    protocol: '420Pay',
    event_name: 'PaymentCreated',
    object_key: null,
    lifecycle_state: null,
    fields: { bad: 1n }
  }), /invalid fields/);
});
