import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import type { Artifact420 } from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { ProtocolProjection420 } from '../src/protocol-projections.js';
import type { SqlExecutor420, TransactionalSql420 } from '../src/core-projections.js';
import {
  TREASURY_EVENT_CONTRACTS_420,
  bindTreasuryDescriptors420,
  treasuryDescriptorsFromArtifacts420,
  type TreasuryArtifactManifest420,
  type TreasuryEventContract420
} from '../src/treasury-descriptors.js';
import { treasuryBudgetState420, treasuryDisbursementState420 } from '../src/treasury-read-model.js';

const manifest = JSON.parse(
  readFileSync(new URL('../../descriptors/treasury420-v1.json', import.meta.url), 'utf8')
) as TreasuryArtifactManifest420;

function artifactsFromManifest420(): ReadonlyMap<string, Artifact420> {
  return new Map(manifest.contracts.map((contract) => [
    contract.contractName,
    {
      contractName: contract.contractName,
      abi: contract.events.map((event) => ({
        type: 'event' as const,
        name: event.name,
        anonymous: false,
        inputs: event.inputs.map((input) => ({ ...input }))
      }))
    }
  ]));
}

class QueueDb420 implements TransactionalSql420 {
  queue: unknown[] = [];
  calls: Array<{ sql: string; params?: readonly unknown[] }> = [];
  async query(sql: string, params?: readonly unknown[]): Promise<unknown> {
    this.calls.push({ sql, params });
    return this.queue.shift() ?? { rows: [] };
  }
  async transaction<T>(work: (tx: SqlExecutor420) => Promise<T>): Promise<T> { return work(this); }
}

const h = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;

test('Treasury descriptor covers the complete modern event-emitting contract family and remains address-unbound', () => {
  const descriptors = treasuryDescriptorsFromArtifacts420(manifest, artifactsFromManifest420());
  assert.equal(descriptors.length, 7);
  assert.deepEqual([...new Set(descriptors.map((d) => d.contractName))].sort(), [...TREASURY_EVENT_CONTRACTS_420].sort());
  assert.equal(descriptors.every((d) => d.protocol === '420Treasury'), true);
  assert.equal(descriptors.every((d) => !('contractAddress' in d)), true);

  const budget = descriptors.find((d) => d.eventName === 'BudgetCreated')!;
  assert.equal(budget.fields.some((f) => f.name === 'metadataHash' && f.kind === 'bytes32'), true);
  const scheduled = descriptors.find((d) => d.eventName === 'DisbursementScheduled')!;
  assert.equal(scheduled.fields.some((f) => f.name === 'purposeHash' && f.kind === 'bytes32'), true);
});

test('Treasury deployment binding fails closed until valid registry-resolved identities are supplied', () => {
  const descriptors = treasuryDescriptorsFromArtifacts420(manifest, artifactsFromManifest420());
  const addresses = Object.fromEntries(
    TREASURY_EVENT_CONTRACTS_420.map((name, index) => [name, `0x${(index + 101).toString(16).padStart(40, '0')}` as Hex])
  ) as Record<TreasuryEventContract420, Hex>;
  const bound = bindTreasuryDescriptors420(descriptors, addresses);
  assert.equal(bound.length, descriptors.length);
  assert.equal(bound.every((d) => /^0x[0-9a-f]{40}$/.test(d.contractAddress)), true);
  assert.throws(
    () => bindTreasuryDescriptors420(descriptors, { ...addresses, TreasuryBudgetRegistry420: '0x1234' as Hex }),
    /deployment address invalid/
  );
});

test('Treasury descriptor generation rejects ABI/indexing drift', () => {
  const artifacts = new Map(artifactsFromManifest420());
  const original = artifacts.get('TreasuryDisbursementRegistry420')!;
  artifacts.set('TreasuryDisbursementRegistry420', {
    ...original,
    abi: original.abi.map((item) => {
      if ((item as { name?: string }).name !== 'DisbursementScheduled') return item;
      const event = item as { type: 'event'; name: string; inputs: Array<{ name: string; type: string; indexed?: boolean }> };
      return { ...event, inputs: event.inputs.map((input, i) => i === 0 ? { ...input, indexed: false } : input) };
    })
  });
  assert.throws(() => treasuryDescriptorsFromArtifacts420(manifest, artifacts), /artifact input drift/);
});

test('Treasury budget read model rebuilds complete state from creation and accounting events', async () => {
  const db = new QueueDb420();
  db.queue.push({ rows: [
    {
      chain_id:'420', protocol:'420Treasury', event_name:'BudgetCreated',
      fields:{ budgetId:h(1), vaultId:h(2), category:h(3), asset:'0x0000000000000000000000000000000000000420', ceiling:'2000', validFrom:'10', validUntil:'1000', civicActionHash:h(4), metadataHash:h(5) },
      block_number:'10', block_hash:h(10), tx_hash:h(11), tx_index:0, log_index:1
    },
    {
      chain_id:'420', protocol:'420Treasury', event_name:'BudgetCommitmentChanged',
      fields:{ budgetId:h(1), committed:'500', executed:'0' },
      block_number:'11', block_hash:h(12), tx_hash:h(13), tx_index:0, log_index:2
    },
    {
      chain_id:'420', protocol:'420Treasury', event_name:'BudgetCommitmentChanged',
      fields:{ budgetId:h(1), committed:'500', executed:'500' },
      block_number:'12', block_hash:h(14), tx_hash:h(15), tx_index:0, log_index:3
    }
  ]});
  const state = await treasuryBudgetState420(db, 420n, h(1));
  assert.equal(state?.ceiling, '2000');
  assert.equal(state?.committed, '500');
  assert.equal(state?.executed, '500');
  assert.equal(state?.metadataHash, h(5));
  assert.equal(state?.blockNumber, '12');
  assert.equal(state?.authoritative, false);
});

test('Treasury disbursement read model preserves schedule fields and terminal release evidence', async () => {
  const db = new QueueDb420();
  db.queue.push({ rows: [
    {
      event_name:'DisbursementScheduled',
      fields:{ disbursementId:h(21), budgetId:h(1), recipient:'0x00000000000000000000000000000000000000aa', asset:'0x0000000000000000000000000000000000000420', amount:'300', notBefore:'20', expiresAt:'50', civicActionHash:h(4), purposeHash:h(22) },
      block_number:'20', block_hash:h(23), tx_hash:h(24), tx_index:0, log_index:0
    },
    {
      event_name:'DisbursementExecuted',
      fields:{ disbursementId:h(21), vaultReleaseHash:h(25), executor:'0x00000000000000000000000000000000000000ee' },
      block_number:'21', block_hash:h(26), tx_hash:h(27), tx_index:1, log_index:1
    }
  ]});
  const state = await treasuryDisbursementState420(db, 420n, h(21));
  assert.equal(state?.state, 'EXECUTED');
  assert.equal(state?.purposeHash, h(22));
  assert.equal(state?.vaultReleaseHash, h(25));
  assert.equal(state?.executor, '0x00000000000000000000000000000000000000ee');
  assert.equal(state?.authoritative, false);
});

test('Treasury read model rejects terminal replay and accounting corruption', async () => {
  const disb = new QueueDb420();
  disb.queue.push({ rows: [
    { event_name:'DisbursementScheduled', fields:{ disbursementId:h(31), budgetId:h(1), recipient:'0x00000000000000000000000000000000000000aa', asset:'0x0000000000000000000000000000000000000420', amount:'1', notBefore:'1', expiresAt:'2', civicActionHash:h(2), purposeHash:h(3) }, block_number:'1', block_hash:h(1), tx_hash:h(2), tx_index:0, log_index:0 },
    { event_name:'DisbursementCancelled', fields:{ disbursementId:h(31) }, block_number:'2', block_hash:h(3), tx_hash:h(4), tx_index:0, log_index:0 },
    { event_name:'DisbursementExecuted', fields:{ disbursementId:h(31), vaultReleaseHash:h(5), executor:'0x00000000000000000000000000000000000000ee' }, block_number:'3', block_hash:h(6), tx_hash:h(7), tx_index:0, log_index:0 }
  ]});
  await assert.rejects(() => treasuryDisbursementState420(disb, 420n, h(31)), /terminal replay/);

  const budget = new QueueDb420();
  budget.queue.push({ rows: [
    { event_name:'BudgetCreated', fields:{ budgetId:h(41), vaultId:h(2), category:h(3), asset:'0x0000000000000000000000000000000000000420', ceiling:'100', validFrom:'1', validUntil:'10', civicActionHash:h(4), metadataHash:h(5) }, block_number:'1', block_hash:h(1), tx_hash:h(2), tx_index:0, log_index:0 },
    { event_name:'BudgetCommitmentChanged', fields:{ budgetId:h(41), committed:'101', executed:'0' }, block_number:'2', block_hash:h(3), tx_hash:h(4), tx_index:0, log_index:0 }
  ]});
  await assert.rejects(() => treasuryBudgetState420(budget, 420n, h(41)), /ceiling violated/);
});

test('Treasury event projection is replay-safe and reorg rollback permits canonical replay', async () => {
  const db = new QueueDb420();
  const topic0 = h(420);
  const projection = new ProtocolProjection420(db, new ProtocolDecoderRegistry420([{
    protocol:'420Treasury',
    eventName:'BudgetCommitmentChanged',
    topic0,
    fields:[{name:'budgetId',kind:'bytes32',indexed:true},{name:'committed',kind:'uint128',indexed:false},{name:'executed',kind:'uint128',indexed:false}]
  }]));
  const data = `0x${BigInt(500).toString(16).padStart(64,'0')}${BigInt(0).toString(16).padStart(64,'0')}` as Hex;
  const log: IndexerLog = { address:h(50), blockHash:h(51), blockNumber:25n, transactionHash:h(52), transactionIndex:0, logIndex:1, topics:[topic0,h(53)], data };
  await projection.applyLogs(420n,[log]);
  await projection.applyLogs(420n,[log]);
  assert.equal(db.calls.filter((call) => /on conflict/.test(call.sql)).length, 2);
  await projection.rollbackTo(24n);
  assert.match(db.calls.at(-1)!.sql,/delete from idx_protocol_events where block_number > \$1/);
  await projection.applyLogs(420n,[{...log,blockHash:h(54),transactionHash:h(55)}]);
  assert.equal(db.calls.filter((call) => /insert into idx_protocol_events/.test(call.sql)).length,3);
});
