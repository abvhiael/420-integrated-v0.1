import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import type { Artifact420 } from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420, type DecodedProtocolEvent420 } from '../src/protocol-decoder.js';
import {
  GRANTS_EVENT_CONTRACTS_420,
  bindGrantsDescriptors420,
  grantsDescriptorsFromArtifacts420,
  type GrantsArtifactManifest420,
  type GrantsEventContract420
} from '../src/grants-descriptors.js';
import {
  grantsApplicationState420,
  grantsAwardState420,
  grantsMilestoneState420,
  grantsProgramState420
} from '../src/grants-read-model.js';
import { reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';
import { routeIndexerHttp420 } from '../src/http-transport.js';
import type { IndexerPublicApi420 } from '../src/api-surface.js';
import type { SqlExecutor420, TransactionalSql420 } from '../src/core-projections.js';

const manifest = JSON.parse(
  readFileSync(new URL('../../descriptors/grants420-v1.json', import.meta.url), 'utf8')
) as GrantsArtifactManifest420;

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
const a = (n: number): Hex => `0x${n.toString(16).padStart(40, '0')}`;

test('Grants descriptor covers every event-emitting Grants registry and remains deployment-address unbound', () => {
  const descriptors = grantsDescriptorsFromArtifacts420(manifest, artifactsFromManifest420());
  assert.equal(descriptors.length, 12);
  assert.deepEqual([...new Set(descriptors.map((d) => d.contractName))].sort(), [...GRANTS_EVENT_CONTRACTS_420].sort());
  assert.equal(descriptors.every((d) => d.protocol === '420Grants'), true);
  assert.equal(descriptors.every((d) => !('contractAddress' in d)), true);

  const created = descriptors.find((d) => d.eventName === 'ProgramCreated')!;
  assert.equal(created.fields.filter((f) => f.indexed).length, 3);
  const claim = descriptors.find((d) => d.eventName === 'MilestoneClaimed')!;
  assert.equal(claim.fields.find((f) => f.name === 'submitter')?.indexed, true);
});

test('Grants descriptor binding fails closed until all registry-resolved deployment identities are supplied', () => {
  const descriptors = grantsDescriptorsFromArtifacts420(manifest, artifactsFromManifest420());
  const addresses = Object.fromEntries(
    GRANTS_EVENT_CONTRACTS_420.map((name, index) => [name, a(index + 101)])
  ) as Record<GrantsEventContract420, Hex>;
  const bound = bindGrantsDescriptors420(descriptors, addresses);
  assert.equal(bound.length, descriptors.length);
  assert.equal(bound.every((d) => /^0x[0-9a-f]{40}$/.test(d.contractAddress)), true);
  assert.throws(
    () => bindGrantsDescriptors420(descriptors, { ...addresses, GrantAwardRegistry420: '0x1234' as Hex }),
    /deployment address invalid/
  );
});

test('Grants descriptor generation rejects ABI/indexing drift', () => {
  const artifacts = new Map(artifactsFromManifest420());
  const original = artifacts.get('GrantMilestoneRegistry420')!;
  artifacts.set('GrantMilestoneRegistry420', {
    ...original,
    abi: original.abi.map((item) => {
      if ((item as { name?: string }).name !== 'MilestoneApproved') return item;
      const event = item as { type: 'event'; name: string; inputs: Array<{ name: string; type: string; indexed?: boolean }> };
      return { ...event, inputs: event.inputs.map((input, i) => i === 1 ? { ...input, indexed: false } : input) };
    })
  });
  assert.throws(() => grantsDescriptorsFromArtifacts420(manifest, artifacts), /artifact input drift/);
});

test('Grants program read model reconstructs active and awarded state without claiming authority', async () => {
  const db = new QueueDb420();
  db.queue.push({ rows: [
    {
      event_name:'ProgramCreated',
      fields:{ programId:h(1), treasuryBudgetId:h(2), programType:h(3), totalCap:'1000', maxAward:'400', opensAt:'10', closesAt:'100', civicActionHash:h(4) },
      block_number:'10', block_hash:h(10), tx_hash:h(11), tx_index:0, log_index:0
    },
    {
      event_name:'ProgramAwardedChanged', fields:{ programId:h(1), awarded:'300' },
      block_number:'11', block_hash:h(12), tx_hash:h(13), tx_index:0, log_index:1
    },
    {
      event_name:'ProgramActiveChanged', fields:{ programId:h(1), active:false },
      block_number:'12', block_hash:h(14), tx_hash:h(15), tx_index:0, log_index:2
    }
  ]});
  const state = await grantsProgramState420(db, 420n, h(1));
  assert.equal(state?.awarded, '300');
  assert.equal(state?.active, false);
  assert.equal(state?.treasuryBudgetId, h(2));
  assert.equal(state?.blockNumber, '12');
  assert.equal(state?.authoritative, false);
});

test('Grants application read model rejects replay and preserves immutable submission view', async () => {
  const db = new QueueDb420();
  const row = {
    event_name:'ApplicationSubmitted',
    fields:{ applicationId:h(20), programId:h(1), applicant:a(9), requestedAmount:'350', contentHash:h(21) },
    block_number:'20', block_hash:h(22), tx_hash:h(23), tx_index:1, log_index:0
  };
  db.queue.push({ rows:[row] });
  const state = await grantsApplicationState420(db, 420n, h(20));
  assert.equal(state?.requestedAmount, '350');
  assert.equal(state?.applicant, a(9));
  assert.equal(state?.authoritative, false);

  db.queue.push({ rows:[row, { ...row, log_index:1 }] });
  await assert.rejects(grantsApplicationState420(db, 420n, h(20)), /replay detected/);
});

test('Grants award read model reconstructs terminal state and rejects terminal replay', async () => {
  const db = new QueueDb420();
  const created = {
    event_name:'AwardCreated',
    fields:{ awardId:h(30), programId:h(1), applicationId:h(20), recipient:a(9), amount:'300', termsHash:h(31) },
    block_number:'30', block_hash:h(32), tx_hash:h(33), tx_index:0, log_index:0
  };
  const cancelled = {
    event_name:'AwardStateChanged', fields:{ awardId:h(30), state:'2' },
    block_number:'31', block_hash:h(34), tx_hash:h(35), tx_index:0, log_index:1
  };
  db.queue.push({ rows:[created, cancelled] });
  const state = await grantsAwardState420(db, 420n, h(30));
  assert.equal(state?.state, 'CANCELLED');
  assert.equal(state?.applicationId, h(20));
  assert.equal(state?.authoritative, false);

  db.queue.push({ rows:[created, cancelled, { ...cancelled, block_number:'32', log_index:2 }] });
  await assert.rejects(grantsAwardState420(db, 420n, h(30)), /terminal replay/);
});

test('Grants milestone read model reconstructs claim, Treasury binding and PAID terminal state', async () => {
  const db = new QueueDb420();
  db.queue.push({ rows:[
    {
      event_name:'MilestoneCreated', fields:{ milestoneId:h(40), awardId:h(30), amount:'300', purposeHash:h(41) },
      block_number:'40', block_hash:h(42), tx_hash:h(43), tx_index:0, log_index:0
    },
    {
      event_name:'MilestoneClaimed', fields:{ milestoneId:h(40), claimHash:h(44), submitter:a(9) },
      block_number:'41', block_hash:h(45), tx_hash:h(46), tx_index:0, log_index:1
    },
    {
      event_name:'MilestoneApproved', fields:{ milestoneId:h(40), treasuryDisbursementId:h(47) },
      block_number:'42', block_hash:h(48), tx_hash:h(49), tx_index:0, log_index:2
    },
    {
      event_name:'MilestonePaid', fields:{ milestoneId:h(40), treasuryDisbursementId:h(47) },
      block_number:'43', block_hash:h(50), tx_hash:h(51), tx_index:0, log_index:3
    }
  ]});
  const state = await grantsMilestoneState420(db, 420n, h(40));
  assert.equal(state?.state, 'PAID');
  assert.equal(state?.claimHash, h(44));
  assert.equal(state?.treasuryDisbursementId, h(47));
  assert.equal(state?.authoritative, false);
});

test('generic lifecycle reduction recognizes Grants object identities and terminal states', () => {
  const base = {
    protocol:'420Grants',
    contractAddress:a(1),
    blockHash:h(100),
    transactionHash:h(101),
    transactionIndex:0
  };
  const events: DecodedProtocolEvent420[] = [
    { ...base, eventName:'AwardCreated', blockNumber:1n, logIndex:0, fields:{ awardId:h(30) } },
    { ...base, eventName:'AwardStateChanged', blockNumber:2n, logIndex:0, fields:{ awardId:h(30), state:3n } },
    { ...base, eventName:'MilestoneCreated', blockNumber:3n, logIndex:0, fields:{ milestoneId:h(40) } },
    { ...base, eventName:'MilestoneCancelled', blockNumber:4n, logIndex:0, fields:{ milestoneId:h(40) } }
  ];
  const states = reduceProtocolLifecycle420(events);
  assert.equal(states.find((s) => s.objectKey === `awardId:${h(30)}`)?.state, 'COMPLETED');
  assert.equal(states.find((s) => s.objectKey === `milestoneId:${h(40)}`)?.state, 'CANCELLED');
});

test('Grants HTTP read routes expose non-authoritative client views', async () => {
  const calls:string[] = [];
  const api = {
    version:'v1',
    grantsProgram:async () => { calls.push('program'); return { programId:h(1), authoritative:false }; },
    grantsApplication:async () => { calls.push('application'); return { applicationId:h(20), authoritative:false }; },
    grantsAward:async () => { calls.push('award'); return { awardId:h(30), authoritative:false }; },
    grantsMilestone:async () => { calls.push('milestone'); return { milestoneId:h(40), authoritative:false }; }
  } as unknown as IndexerPublicApi420;

  for (const [path, expected] of [
    [`/v1/grants/programs/${h(1)}?chainId=420`, 'program'],
    [`/v1/grants/applications/${h(20)}?chainId=420`, 'application'],
    [`/v1/grants/awards/${h(30)}?chainId=420`, 'award'],
    [`/v1/grants/milestones/${h(40)}?chainId=420`, 'milestone']
  ] as const) {
    const result = await routeIndexerHttp420(api, 'GET', path);
    assert.equal(result.status, 200);
    assert.equal(calls.at(-1), expected);
  }
});
