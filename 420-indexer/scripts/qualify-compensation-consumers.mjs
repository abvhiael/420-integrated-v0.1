import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { routeIndexerHttp420 } from '../dist/src/http-transport.js';

// Adapt the local receipt fixture to the Go Indexer read contract. The
// authenticated compensation and report routes use the real SQL-backed API.
export async function withCompensationConsumers({ api, db, provider, chainId = 420 }, verify) {
  const serve = async (handler) => {
    const server = createServer(async (req, res) => {
      try {
        const result = await handler(req.url);
        res.writeHead(result.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch {
        res.writeHead(503);
        res.end('{}');
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return server;
  };
  const origin = server => 'http://127.0.0.1:' + server.address().port;
  const protocols = await serve(url => routeIndexerHttp420(api, 'GET', url));
  const canonical = await serve(async (url) => {
    const parts = url.split('/');
    const height = await provider.getBlockNumber();
    const finality = 'HEAD';
    if (url === '/v1/health') return { status: 200, body: { health: {
      chainId, indexedHeight: height, safeHeight: 0, finalizedHeight: 0, state: 'READY', lastIngestAt: new Date()
    } } };
    if (parts[2] === 'blocks') {
      const block = await provider.getBlock(Number(parts[3]));
      const indexed = await db.query('select block_hash from idx_blocks where chain_id = $1 and block_number = $2', [chainId, parts[3]]);
      assert.equal(indexed.rows[0]?.block_hash, block?.hash);
      if (parts[4] === 'logs') {
        const logs = await provider.getLogs({ fromBlock: block.number, toBlock: block.number });
        return { status: 200, body: { data: logs.map(log => ({
          chainId, blockNumber: log.blockNumber, blockHash: log.blockHash, transactionHash: log.transactionHash,
          transactionIndex: log.transactionIndex, logIndex: log.index, address: log.address, topics: log.topics, data: log.data
        })) } };
      }
      return { status: 200, body: { chainId, number: block.number, hash: block.hash, finality } };
    }
    const hash = parts[3];
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) return { status: 404, body: { error: 'receipt unavailable' } };
    const data = { chainId, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
    if (parts[2] === 'receipts') {
      Object.assign(data, { transactionHash: hash, transactionIndex: receipt.index, status: receipt.status,
        gasUsed: Number(receipt.gasUsed), effectiveGasPriceWei: receipt.gasPrice.toString(),
        actualFeeWei: (receipt.gasUsed * receipt.gasPrice).toString() });
    } else {
      const tx = await provider.getTransaction(hash);
      Object.assign(data, { hash, index: tx.index, from: tx.from, to: tx.to, input: tx.data, valueWei: tx.value.toString() });
    }
    return { status: 200, body: { data } };
  });
  const processes = [];
  const launch = async (bin, name, port) => {
    const child = spawn(bin, [], { stdio: ['ignore', process.stderr, process.stderr], env: { ...process.env,
      [name + '_LISTEN_ADDR']: '127.0.0.1:' + port,
      [name + '_INDEXER_URL']: origin(canonical),
      [name + '_COMPENSATION_INDEXER_URL']: origin(protocols),
      [name + '_CHAIN_ID']: String(chainId)
    } });
    processes.push(child);
    const url = 'http://127.0.0.1:' + port;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) break;
      if (await fetch(url + (name === 'EXPLORER' ? '/v1/health' : '/health')).then(r => r.ok).catch(() => false)) return url;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(name + ' did not start');
  };
  try {
    const explorer = await launch(process.env.DEVCOMP_EXPLORER_BIN, 'EXPLORER', 19551);
    const analytics = await launch(process.env.DEVCOMP_ANALYTICS_BIN, 'ANALYTICS', 19552);
    const read = async url => {
      const response = await fetch(url);
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    await verify({
      details: hash => read(explorer + '/v1/transactions/' + hash + '/compensation'),
      report: () => read(analytics + '/v1/development-compensation?from=0&to=9999999999')
    });
  } finally {
    for (const child of processes) child.kill();
    protocols.close();
    canonical.close();
  }
}

export async function qualifyConsumers({ contribution, claim, orphan, asset, ...runtime }) {
  await withCompensationConsumers(runtime, async ({ details, report }) => {
    const tx = await details(contribution.hash);
    assert.equal(tx.finality, 'HEAD');
    assert(tx.confirmations > 0);
    assert(tx.events.some(event => event.eventName === 'DevelopmentCompensationForwarded' &&
      event.blockHash === contribution.blockHash && event.fields.compensationAmount === '80'));
    assert(tx.events.some(event => event.eventName === 'FounderTokenCompensationCredited'));
    assert((await details(claim.hash)).events.some(event => event.eventName === 'FounderCompensationClaimed'));
    assert.deepEqual((await details(orphan.hash)).events, []);
    const totals = await report();
    assert.equal(totals.contributions.find(row => row.asset === asset)?.eligibleRevenue, '800');
    assert.equal(totals.entitlements.filter(row => row.asset === asset)
      .reduce((sum, row) => sum + BigInt(row.outstanding), 0n), 60n);
    console.log(JSON.stringify({ explorer: 'PASS', analytics: 'PASS', originTransaction: contribution.hash }));
  });
}
