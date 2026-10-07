import test from 'node:test';
import assert from 'node:assert/strict';
import { RpcCanonicalEventSource420, type JsonRpcRequest420 } from '../src/rpc-log-source.js';

test('HZ-AUDIT-6 RPC source emits canonically ordered events with block lineage and finality', async () => {
  const calls: Array<[string, unknown[]]> = [];
  const request: JsonRpcRequest420 = async (method, params) => {
    calls.push([method, params]);
    if (method === 'eth_getLogs') {
      return [
        {
          address: '0xabc',
          blockNumber: '0x66',
          blockHash: '0xblock102',
          transactionHash: '0xtx2',
          transactionIndex: '0x1',
          logIndex: '0x0',
          data: '0x02',
          topics: ['0xtopic'],
          removed: false,
        },
        {
          address: '0xabc',
          blockNumber: '0x65',
          blockHash: '0xblock101',
          transactionHash: '0xtx1',
          transactionIndex: '0x0',
          logIndex: '0x2',
          data: '0x01',
          topics: ['0xtopic'],
          removed: false,
        },
      ];
    }
    if (method === 'eth_getBlockByNumber') {
      const [tag] = params;
      if (tag === 'finalized') return { number: '0x65', hash: '0xfinalized', parentHash: '0xfinalized-parent' };
      if (tag === '0x65') return { number: '0x65', hash: '0xblock101', parentHash: '0xblock100' };
      if (tag === '0x66') return { number: '0x66', hash: '0xblock102', parentHash: '0xblock101' };
    }
    throw new Error(`unexpected RPC request ${method}`);
  };

  const source = new RpcCanonicalEventSource420(
    request,
    (log) => ({
      moduleKey: 'CATALOG',
      eventType: 'RELEASE_CREATED',
      payload: { releaseId: Number.parseInt(log.data.slice(2), 16) },
    }),
  );

  const events = await source.load(101, 102, ['0xabc']);

  assert.equal(events.length, 2);
  assert.equal(events[0].blockNumber, 101);
  assert.equal(events[0].parentHash, '0xblock100');
  assert.equal(events[0].transactionIndex, 0);
  assert.equal(events[0].logIndex, 2);
  assert.equal(events[0].finalized, true);
  assert.equal(events[1].blockNumber, 102);
  assert.equal(events[1].parentHash, '0xblock101');
  assert.equal(events[1].transactionIndex, 1);
  assert.equal(events[1].finalized, false);
  assert.equal(events[0].eventKey, '0xblock101:0xtx1:2');
  assert.equal(events[1].eventKey, '0xblock102:0xtx2:0');

  const getLogs = calls.find(([method]) => method === 'eth_getLogs');
  assert.ok(getLogs);
  assert.deepEqual(getLogs[1], [{ fromBlock: '0x65', toBlock: '0x66', address: '0xabc' }]);
});

test('HZ-AUDIT-6 RPC source rejects removed logs and header/hash disagreement', async () => {
  const removedSource = new RpcCanonicalEventSource420(
    async (method) => {
      if (method === 'eth_getLogs') {
        return [{
          address: '0xabc',
          blockNumber: '0x1',
          blockHash: '0xblock1',
          transactionHash: '0xtx',
          transactionIndex: '0x0',
          logIndex: '0x0',
          data: '0x',
          topics: [],
          removed: true,
        }];
      }
      if (method === 'eth_getBlockByNumber') return null;
      throw new Error('unexpected');
    },
    () => ({ moduleKey: 'X', eventType: 'CREATOR_CREATED', payload: {} }),
  );
  await assert.rejects(removedSource.load(1, 1), /removed log/);

  const mismatchSource = new RpcCanonicalEventSource420(
    async (method, params) => {
      if (method === 'eth_getLogs') {
        return [{
          address: '0xabc',
          blockNumber: '0x2',
          blockHash: '0xlog-hash',
          transactionHash: '0xtx',
          transactionIndex: '0x0',
          logIndex: '0x0',
          data: '0x',
          topics: [],
          removed: false,
        }];
      }
      if (method === 'eth_getBlockByNumber') {
        if (params[0] === 'finalized') return null;
        return { number: '0x2', hash: '0xcanonical-hash', parentHash: '0xparent' };
      }
      throw new Error('unexpected');
    },
    () => ({ moduleKey: 'X', eventType: 'CREATOR_CREATED', payload: {} }),
  );
  await assert.rejects(mismatchSource.load(2, 2), /does not match canonical header/);
});
