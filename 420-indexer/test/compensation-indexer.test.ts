import assert from 'node:assert/strict';
import test from 'node:test';
import { Interface, id, keccak256 } from 'ethers';
import type { Artifact420 } from '../src/abi-manifest.js';
import type { ChainSource420, Hex, IndexerLog } from '../src/chain-source.js';
import { createCompensationIndexer420, type CompensationDeployment420 } from '../src/compensation-indexer.js';
import type { TransactionalSql420 } from '../src/core-projections.js';
import { protocolEventsQuery420 } from '../src/query-layer.js';

const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const address = (n: number): Hex => `0x${n.toString(16).padStart(40, '0')}`;
const runtime = '0x6000';
const registry = { address: address(1), runtimeHash: keccak256(runtime) as Hex };
const vault = { ...registry, address: address(2) };
const splitter = { ...registry, address: address(3) };
const deployment: CompensationDeployment420 = {
  chainId: 420n, genesisHash: hash(1), deploymentBlock: 1n, deploymentBlockHash: hash(2),
  registry, vault, splitter
};
const vaultABI = new Interface([
  'function beneficiary() view returns (address)',
  'event DevelopmentCompensationForwarded(bytes32 indexed contributionId, bytes32 indexed sourceApplicationId, bytes32 indexed revenueRef, address source, address asset, address beneficiary, uint256 grossProtocolRevenue, uint16 compensationBps, uint256 compensationAmount, bytes32 policyRef)'
]);
const splitterABI = new Interface([
  'function compensationVault() view returns (address)',
  'event CompensationVaultBound(address indexed immutableVault)',
  'event FounderCompensationDeposited(address indexed sourceVault, uint256 amount)',
  'event FounderTokenCompensationCredited(address indexed sourceVault, address indexed token, bytes32 indexed contributionId, uint256 amount)',
  'event FounderCompensationClaimed(address indexed beneficiary, address indexed asset, uint256 amount)'
]);
const registryABI = new Interface(['function resolveActive(bytes32) view returns (address,uint32)']);
const artifacts = new Map<string, Artifact420>([
  ['DevelopmentCompensationVault420', { contractName: 'DevelopmentCompensationVault420', abi: JSON.parse(vaultABI.formatJson()) }],
  ['FoundingDeveloperCompensationSplitter420', {
    contractName: 'FoundingDeveloperCompensationSplitter420', abi: JSON.parse(splitterABI.formatJson())
  }]
]);
const contributionId = hash(100);
const amount = 10n ** 30n;
const event = vaultABI.getEvent('DevelopmentCompensationForwarded')!;
const encoded = vaultABI.encodeEventLog(event, [
  contributionId, hash(101), hash(102), address(4), address(0), splitter.address, amount * 10n, 1000,
  amount, id('420/REVENUE/POLICY/APPLICATION_REVENUE/V1')
]);
const canonicalLog: IndexerLog = {
  address: vault.address, blockHash: hash(2), blockNumber: 1n, transactionHash: hash(200),
  transactionIndex: 0, logIndex: 0, topics: encoded.topics as Hex[], data: encoded.data as Hex
};

function fixture() {
  let chain = 420n;
  let emitted = canonicalLog;
  let receiptLogs = [canonicalLog];
  const entries: Array<readonly unknown[]> = [];
  const query: TransactionalSql420['query'] = async (sql, params) => {
    if (sql.includes('insert into idx_protocol_events')) entries.push(params ?? []);
    return { rows: [] };
  };
  const db: TransactionalSql420 = { query, transaction: work => work({ query }) };
  const source: ChainSource420 = {
    sourceId: 'compensation-fixture',
    chainId: async () => chain,
    blockNumber: async () => 1n,
    getBlockByNumber: async number => ({ number, hash: hash(Number(number) + 1), parentHash: hash(Number(number)), timestamp: 1n }),
    getBlockByHash: async () => null,
    getTransactionByHash: async () => null,
    getTransactionReceipt: async () => ({
      transactionHash: hash(200), blockHash: hash(2), blockNumber: 1n, transactionIndex: 0,
      status: 1, contractAddress: null, logs: receiptLogs
    }),
    getLogs: async () => [emitted, emitted],
    call: async ({ to, data }) => {
      if (to === registry.address) {
        assert.equal(data, registryABI.encodeFunctionData('resolveActive', [id('420/service/development-compensation/v1')]));
        return registryABI.encodeFunctionResult('resolveActive', [vault.address, 1]) as Hex;
      }
      if (to === vault.address) return vaultABI.encodeFunctionResult('beneficiary', [splitter.address]) as Hex;
      return splitterABI.encodeFunctionResult('compensationVault', [vault.address]) as Hex;
    },
    getCode: async () => runtime
  };
  return {
    entries, setChain: (n: bigint) => { chain = n; },
    setLog: (log: IndexerLog) => { emitted = log; },
    emptyReceipt: () => { receiptLogs = []; },
    indexer: () => createCompensationIndexer420(source, db, deployment, artifacts, { finality: { mode: 'head' }, startBlock: 1n })
  };
}

test('projects an authenticated receipt once using exact amount strings', async () => {
  const { entries, indexer } = fixture();
  const result = await (await indexer()).runOnce();
  assert.equal(result.processed, 1);
  assert.equal(entries.length, 1);
  assert.equal(entries[0][8], 'DevelopmentCompensationForwarded');
  const fields = JSON.parse(String(entries[0][9]));
  assert.equal(fields.contributionId, contributionId);
  assert.equal(fields.grossProtocolRevenue, String(amount * 10n));
  assert.equal(fields.compensationAmount, String(amount));
});

test('ignores lookalikes and rejects malformed, unreceipted and wrong-chain events', async () => {
  const run = async (f: ReturnType<typeof fixture>) => (await f.indexer()).runOnce();
  const lookalike = fixture();
  lookalike.setLog({ ...canonicalLog, address: address(99) });
  assert.equal((await run(lookalike)).processed, 1);
  const malformed = fixture();
  malformed.setLog({ ...canonicalLog, data: '0x' });
  await assert.rejects(run(malformed), /malformed canonical compensation log/);
  const unreceipted = fixture();
  unreceipted.emptyReceipt();
  await assert.rejects(run(unreceipted), /receipt provenance mismatch/);
  const changedChain = fixture();
  const indexer = await changedChain.indexer();
  changedChain.setChain(421n);
  await assert.rejects(indexer.runOnce(), /compensation chain mismatch/);
  for (const f of [lookalike, malformed, unreceipted, changedChain]) assert.equal(f.entries.length, 0);
});

test('compensation API pagination reads the authenticated protocol event projection', () => {
  const query = protocolEventsQuery420(420n, {
    protocol: '420DevelopmentCompensation', objectKey: contributionId, limit: 10
  });
  assert.match(query.text, /from idx_protocol_events where/);
  assert.match(query.text, /fields->>'contributionId' = \$3/);
  assert.deepEqual(query.params, ['420', '420DevelopmentCompensation', contributionId, 11]);
});
