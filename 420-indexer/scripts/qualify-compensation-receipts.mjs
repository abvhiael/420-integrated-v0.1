import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ContractFactory,
  JsonRpcProvider,
  id,
  keccak256,
  AbiCoder
} from 'ethers';
import { join } from 'node:path';
import { PostgresSql420 } from '../dist/src/postgres.js';
import { createCompensationIndexer420 } from '../dist/src/compensation-indexer.js';
import {
  EvmJsonRpcSource420,
  HttpJsonRpcTransport420
} from '../dist/src/rpc-source.js';
import { IndexerQueryService420 } from '../dist/src/query-service.js';
const rpc = process.env.DEVCOMP_LOCAL_RPC;
const artifactsPath = process.env.DEVCOMP_FOUNDRY_OUT;
const connectionString = process.env.INDEXER_PG_URL;
assert(
  rpc && artifactsPath && connectionString,
  'Set DEVCOMP_LOCAL_RPC, DEVCOMP_FOUNDRY_OUT and INDEXER_PG_URL'
);
assert.equal(
  new URL(rpc).hostname,
  '127.0.0.1',
  'Qualification uses a fresh local EVM'
);
const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
const source = new EvmJsonRpcSource420(new HttpJsonRpcTransport420(rpc));
const owner = await provider.getSigner(0);
const author = await owner.getAddress();
const founders = await Promise.all(
  [1, 2, 3].map(async (n) => (await provider.getSigner(n)).getAddress())
);
const artifacts = new Map();
const deploy = async (name, args) => {
  const raw = JSON.parse(
    await readFile(join(artifactsPath, name + '.sol', name + '.json'), 'utf8')
  );
  artifacts.set(name, { contractName: name, abi: raw.abi });
  const c = await new ContractFactory(
    raw.abi,
    raw.bytecode.object,
    owner
  ).deploy(...args);
  await c.waitForDeployment();
  return c;
};
const registry = await deploy('ProtocolRegistry', [author]);
const capabilities = await deploy('CapabilityRegistry420', []);
const splitter = await deploy(
  'FoundingDeveloperCompensationSplitter420',
  founders
);
const vault = await deploy('DevelopmentCompensationVault420', [
  await capabilities.getAddress(),
  await splitter.getAddress()
]);
const vaultAddress = await vault.getAddress();
const splitterAddress = await splitter.getAddress();
await (await splitter.bindCompensationVault(vaultAddress)).wait();
const app = id('DEVCOMP/LOCAL/INDEXER');
const component = id('420/REVENUE/DEVELOPMENT_COMPENSATION/COMPONENT/V1');
const action = id('420/REVENUE/DEVELOPMENT_COMPENSATION/ACTION/CONTRIBUTE/V1');
const scope = keccak256(
  AbiCoder.defaultAbiCoder().encode(
    ['string', 'bytes32'],
    ['420/REVENUE/DEVELOPMENT_COMPENSATION/SCOPE/SOURCE/V1', app]
  )
);
await (await capabilities.registerProtocolComponent(component, author)).wait();
const height = await source.blockNumber();
const head = await source.getBlockByNumber(height);
await (
  await capabilities.createGrant(
    id('grant'),
    author,
    component,
    action,
    scope,
    0,
    0,
    0,
    0,
    head.timestamp + 3600n
  )
).wait();
const filePins = async (c) => {
  const address = await c.getAddress();
  return { address, runtimeHash: keccak256(await source.getCode(address)) };
};
const publish = await (
  await registry.publishService(
    id('420/service/development-compensation/v1'),
    vaultAddress,
    (await filePins(vault)).runtimeHash,
    id('metadata'),
    1,
    true
  )
).wait();
const pins = {
  chainId: 420n,
  genesisHash: (await source.getBlockByNumber(0n)).hash,
  deploymentBlock: BigInt(publish.blockNumber),
  deploymentBlockHash: publish.blockHash,
  registry: await filePins(registry),
  vault: await filePins(vault),
  splitter: await filePins(splitter)
};
const send = async (ref, value) =>
  await (
    await vault.contributeNative(
      app,
      id(ref),
      await vault.policyId(),
      value * 10n,
      1000,
      { value }
    )
  ).wait();
const first = await send('canonical', 100n);
const snapshot = await provider.send('evm_snapshot', []);
const claim = await (
  await splitter.connect(await provider.getSigner(1)).claimNative()
).wait();
const schema = 'devcomp_receipts_' + process.pid;
const admin = new PostgresSql420({ connectionString });
await admin.query(`create schema ${schema}`);
const db = new PostgresSql420({
  connectionString,
  options: `-c search_path=${schema}`
});
try {
  for (const name of [
    '001-core-projections.sql',
    '003-genesis-projections.sql',
    '007-durable-recovery.sql',
    '008-finalized-recovery.sql'
  ]) {
    await db.query(
      await readFile(new URL('../sql/' + name, import.meta.url), 'utf8')
    );
  }
  const service = new IndexerQueryService420(db);
  const opts = { finality: { mode: 'head' } };
  const run = async () =>
    (
      await createCompensationIndexer420(source, db, pins, artifacts, opts)
    ).runOnce();
  const read = async () =>
    (
      await service.protocolEvents(420n, {
        protocol: '420DevelopmentCompensation'
      })
    ).items;
  await run();
  assert.equal(
    (await read()).filter(
      (r) => r.event_name === 'DevelopmentCompensationForwarded'
    ).length,
    1
  );
  assert(
    (await read()).some(
      (r) =>
        r.event_name === 'FounderCompensationClaimed' &&
        r.tx_hash === claim.hash
    )
  );
  assert.equal((await run()).processed, 0);
  assert(await provider.send('evm_revert', [snapshot]));
  const replacement = await send('replacement', 40n);
  const reorg = await run();
  assert.equal(reorg.recoveredReorgDepth, 1);
  const events = await read();
  assert(!events.some((r) => r.event_name === 'FounderCompensationClaimed'));
  assert(
    events.some(
      (r) =>
        r.event_name === 'DevelopmentCompensationForwarded' &&
        r.tx_hash === first.hash
    )
  );
  assert(
    events.some(
      (r) =>
        r.event_name === 'DevelopmentCompensationForwarded' &&
        r.tx_hash === replacement.hash
    )
  );
  console.log(
    JSON.stringify({
      first: first.hash,
      orphanedClaim: claim.hash,
      replacement: replacement.hash,
      eventCount: events.length,
      recoveredDepth: reorg.recoveredReorgDepth
    })
  );
} finally {
  await db.close();
  await admin.query(`drop schema ${schema} cascade`);
  await admin.close();
  provider.destroy();
}
