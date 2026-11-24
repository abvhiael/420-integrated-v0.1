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
import { IndexerPublicApiAdapter420 } from '../dist/src/api-surface.js';
import { routeIndexerHttp420 } from '../dist/src/http-transport.js';
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
const wrapped = await deploy('Wrapped420', []);
const wrappedAddress = await wrapped.getAddress();
const exchangePolicy = await deploy('ExchangeFeePolicy420', [author]);
const exchange = await deploy('ExchangeFeeRouter420', [
  author,
  await exchangePolicy.getAddress()
]);
const exchangeAddress = await exchange.getAddress();
const exchangeApp = await exchange.SOURCE_APPLICATION_ID();
const exchangeScope = keccak256(
  AbiCoder.defaultAbiCoder().encode(
    ['string', 'bytes32'],
    ['420/REVENUE/DEVELOPMENT_COMPENSATION/SCOPE/SOURCE/V1', exchangeApp]
  )
);
await (
  await capabilities.createGrant(
    id('exchange-grant'),
    exchangeAddress,
    component,
    action,
    exchangeScope,
    0,
    0,
    0,
    0,
    head.timestamp + 3600n
  )
).wait();
await (await exchangePolicy.setFeeSplit([3000, 2500, 2000, 1500, 1000])).wait();
const recipients = await Promise.all(
  [4, 5, 6, 7].map(async (n) => (await provider.getSigner(n)).getAddress())
);
await (
  await exchangePolicy.setRecipients([...recipients, vaultAddress])
).wait();
await (await exchange.setCollector(author, true)).wait();
await (await wrapped.deposit({ value: 800n })).wait();
await (await wrapped.approve(exchangeAddress, 800n)).wait();
const tokenContribution = await (
  await exchange.routeTokenFee(id('canonical-token'), wrappedAddress, 800n)
).wait();
for (const [recipient, expected] of recipients.map((recipient, index) => [
  recipient,
  [240n, 200n, 160n, 120n][index]
])) {
  assert.equal(await wrapped.balanceOf(recipient), expected);
}
const tokenClaim = await (
  await splitter.connect(await provider.getSigner(2)).claimToken(wrappedAddress)
).wait();
assert.equal(await wrapped.balanceOf(founders[1]), 20n);
const snapshot = await provider.send('evm_snapshot', []);
const claim = await (
  await splitter.connect(await provider.getSigner(1)).claimNative()
).wait();
const schema = 'devcomp_receipts_' + process.pid;
const rebuildSchema = schema + '_rebuild';
const admin = new PostgresSql420({ connectionString });
const open = async (name) => {
  await admin.query(`create schema ${name}`);
  const store = new PostgresSql420({
    connectionString,
    options: `-c search_path=${name}`
  });
  for (const file of [
    '001-core-projections.sql',
    '003-genesis-projections.sql',
    '007-durable-recovery.sql',
    '008-finalized-recovery.sql'
  ]) {
    await store.query(
      await readFile(new URL('../sql/' + file, import.meta.url), 'utf8')
    );
  }
  return store;
};
const db = await open(schema);
let rebuild;
try {
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
    2
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
  assert(!events.some((r) => r.tx_hash === claim.hash));
  assert(
    events.some(
      (r) =>
        r.event_name === 'FounderCompensationClaimed' &&
        r.tx_hash === tokenClaim.hash
    )
  );
  assert(
    events.some(
      (r) =>
        r.event_name === 'FounderTokenCompensationCredited' &&
        r.tx_hash === tokenContribution.hash &&
        r.fields.token.toLowerCase() === wrappedAddress.toLowerCase() &&
        r.fields.amount === '80'
    )
  );
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
  const response = await routeIndexerHttp420(
    new IndexerPublicApiAdapter420(service),
    'GET',
    '/v1/protocols/events?chainId=420&protocol=420DevelopmentCompensation'
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.data.items.length, events.length);
  assert(
    response.body.data.items.some(
      (event) =>
        event.transactionHash === tokenContribution.hash &&
        event.fields.compensationAmount === '80' &&
        event.fields.sourceApplicationId === exchangeApp &&
        event.fields.source === exchangeAddress.toLowerCase()
    )
  );
  assert(
    !response.body.data.items.some(
      (event) => event.transactionHash === claim.hash
    )
  );
  const lookup = async (hash) => {
    const response = await routeIndexerHttp420(
      new IndexerPublicApiAdapter420(service), 'GET',
      '/v1/protocols/events?chainId=420&protocol=420DevelopmentCompensation&transactionHash=' + hash
    );
    assert.equal(response.status, 200);
    assert(response.body.data.items.every(event => event.transactionHash === hash));
    return response.body.data.items;
  };
  const exchangeEvents = await lookup(tokenContribution.hash);
  assert(exchangeEvents.some(event => event.eventName === 'DevelopmentCompensationForwarded'));
  assert(exchangeEvents.some(event => event.eventName === 'FounderTokenCompensationCredited'));
  assert((await lookup(tokenClaim.hash)).some(event => event.eventName === 'FounderCompensationClaimed'));
  assert.deepEqual(await lookup(claim.hash), []);
  rebuild = await open(rebuildSchema);
  await (
    await createCompensationIndexer420(source, rebuild, pins, artifacts, opts)
  ).runOnce();
  assert.deepEqual(
    (
      await new IndexerQueryService420(rebuild).protocolEvents(420n, {
        protocol: '420DevelopmentCompensation'
      })
    ).items,
    events
  );
  console.log(
    JSON.stringify({
      first: first.hash,
      orphanedClaim: claim.hash,
      replacement: replacement.hash,
      tokenContribution: tokenContribution.hash,
      tokenClaim: tokenClaim.hash,
      eventCount: events.length,
      recoveredDepth: reorg.recoveredReorgDepth
    })
  );
} finally {
  await db.close();
  await rebuild?.close();
  await admin.query(
    `drop schema if exists ${schema}, ${rebuildSchema} cascade`
  );
  await admin.close();
  provider.destroy();
}
