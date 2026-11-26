import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AbiCoder, id, JsonRpcProvider, keccak256 } from 'ethers';
import { PostgresSql420 } from '../dist/src/postgres.js';
import { createCompensationIndexer420 } from '../dist/src/compensation-indexer.js';
import { EvmJsonRpcSource420, HttpJsonRpcTransport420 } from '../dist/src/rpc-source.js';
import { IndexerPublicApiAdapter420 } from '../dist/src/api-surface.js';
import { IndexerQueryService420 } from '../dist/src/query-service.js';
import { withCompensationConsumers } from './qualify-compensation-consumers.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { rpc, founders, asset, claims, credited, forwards, ...pins } = JSON.parse(input);
assert.equal(new URL(rpc).hostname, '127.0.0.1');
assert.equal(pins.chainId, 31337);
assert(process.env.INDEXER_PG_URL && process.env.DEVCOMP_FOUNDRY_OUT);
assert(process.env.DEVCOMP_EXPLORER_BIN && process.env.DEVCOMP_ANALYTICS_BIN);
assert(forwards.length > 0);
const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
const source = new EvmJsonRpcSource420(new HttpJsonRpcTransport420(rpc));
const artifacts = new Map();
for (const name of ['DevelopmentCompensationVault420', 'FoundingDeveloperCompensationSplitter420']) {
  const raw = JSON.parse(await readFile(join(process.env.DEVCOMP_FOUNDRY_OUT, name + '.sol', name + '.json'), 'utf8'));
  artifacts.set(name, { contractName: name, abi: raw.abi });
}
const schema = 'devcomp_fantasy_' + process.pid;
const admin = new PostgresSql420({ connectionString: process.env.INDEXER_PG_URL });
const db = new PostgresSql420({ connectionString: process.env.INDEXER_PG_URL, options: '-c search_path=' + schema });
const sum = values => values.reduce((a, v) => a + BigInt(v), 0n);
try {
  await admin.query('create schema ' + schema);
  for (const file of ['001-core-projections.sql', '003-genesis-projections.sql', '007-durable-recovery.sql', '008-finalized-recovery.sql']) {
    await db.query(await readFile(new URL('../sql/' + file, import.meta.url), 'utf8'));
  }
  const indexer = await createCompensationIndexer420(source, db, {
    ...pins, chainId: BigInt(pins.chainId), deploymentBlock: BigInt(pins.deploymentBlock)
  }, artifacts, { finality: { mode: 'head' }, maxBlocksPerRun: 10000 });
  await indexer.runOnce();
  assert.equal((await indexer.runOnce()).processed, 0);
  process.env.INDEXER_COMPENSATION_REPORT_BINDING = JSON.stringify({
    chainId: String(pins.chainId), vault: pins.vault.address, splitter: pins.splitter.address, founders
  });
  const api = new IndexerPublicApiAdapter420(new IndexerQueryService420(db));
  await withCompensationConsumers({ api, db, provider, chainId: pins.chainId }, async ({ details, report }) => {
    for (const forward of forwards) {
      const receipt = await provider.getTransactionReceipt(forward.tx);
      const policy = id('420/REVENUE/POLICY/BET_FANTASY_ENTRY_V1');
      const revenueRef = keccak256(AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'bytes32', 'uint256'], [policy, asset, forward.pool, forward.gross]
      ));
      assert(forward.origins.length > 0);
      for (const hash of forward.origins) {
        const entry = await provider.getTransaction(hash);
        assert.equal(entry.to.toLowerCase(), forward.source.toLowerCase());
        assert.equal('0x' + entry.data.slice(10, 74), forward.pool);
        const origin = await provider.getTransactionReceipt(hash);
        assert(origin.status === 1 && origin.blockNumber < receipt.blockNumber);
      }
      const tx = await details(forward.tx);
      const emitted = tx.events.filter(event => event.eventName === 'DevelopmentCompensationForwarded');
      assert(emitted.length > 0, forward.case);
      assert(emitted.every(event => event.blockHash === receipt.blockHash &&
        event.fields.source.toLowerCase() === forward.source.toLowerCase() &&
        event.fields.revenueRef === revenueRef), forward.case);
      assert.equal(sum(emitted.map(event => event.fields.grossProtocolRevenue)), BigInt(forward.gross), forward.case);
      assert.equal(sum(emitted.map(event => event.fields.compensationAmount)), BigInt(forward.fee), forward.case);
      assert(tx.events.some(event => event.eventName === 'FounderTokenCompensationCredited'), forward.case);
    }
    for (const claim of claims) {
      const tx = await details(claim.tx);
      assert(tx.events.some(event => event.eventName === 'FounderCompensationClaimed' &&
        event.fields.beneficiary.toLowerCase() === claim.founder.toLowerCase() &&
        event.fields.amount === claim.amount), claim.founder);
    }
    const totals = await report();
    const policy = id('420/REVENUE/POLICY/BET_FANTASY_ENTRY_V1');
    const application = id('420/BET/FANTASY/APPLICATION/V1');
    const sources = new Set(forwards.map(row => row.source.toLowerCase()));
    assert.equal(totals.contributions.length, sources.size);
    for (const row of totals.contributions) {
      assert.equal(row.asset, asset);
      assert.equal(row.policy, policy);
      assert.equal(row.application, application);
      assert(sources.delete(row.source));
      const basis = forwards.filter(forward => forward.source.toLowerCase() === row.source);
      assert.equal(BigInt(row.eligibleRevenue), sum(basis.map(forward => forward.gross)));
      assert.equal(BigInt(row.compensation), sum(basis.map(forward => forward.fee)));
    }
    assert.equal(totals.entitlements.length, claims.length);
    for (const claim of claims) {
      const entitlement = totals.entitlements.find(row => row.asset === asset && row.founder === claim.founder.toLowerCase());
      assert.equal(entitlement?.claimed, claim.amount);
    }
    assert.equal(sum(totals.contributions.map(row => row.eligibleRevenue)), sum(forwards.map(row => row.gross)));
    assert.equal(sum(totals.contributions.map(row => row.compensation)), BigInt(credited));
    assert.equal(sum(totals.entitlements.map(row => row.claimed)), BigInt(credited));
    assert.equal(sum(totals.entitlements.map(row => row.outstanding)), 0n);
    console.log(JSON.stringify({ chainId: pins.chainId, asset, forwards, claims, credited }));
  });
} finally {
  await db.close();
  await admin.query('drop schema if exists ' + schema + ' cascade');
  await admin.close();
  provider.destroy();
}
