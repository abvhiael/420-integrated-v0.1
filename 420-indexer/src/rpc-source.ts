import type { ChainSource420, Hex, IndexerBlock, IndexerLog, IndexerReceipt, IndexerTransaction, LogFilter420 } from './chain-source.js';

export interface JsonRpcTransport420 { request<T>(method: string, params?: readonly unknown[]): Promise<T>; }
interface JsonRpcEnvelope420<T> { jsonrpc: '2.0'; id: number; result?: T; error?: { code: number; message: string; data?: unknown }; }
export class HttpJsonRpcTransport420 implements JsonRpcTransport420 {
  private requestId = 0;
  constructor(readonly url: string, private readonly headers: Record<string, string> | (() => Record<string, string>) = {}) {}
  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    const response = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json', ...(typeof this.headers === 'function' ? this.headers() : this.headers) }, body: JSON.stringify({ jsonrpc: '2.0', id: ++this.requestId, method, params }) });
    if (!response.ok) throw new Error(`rpc http ${response.status} for ${method}`);
    const payload = (await response.json()) as JsonRpcEnvelope420<T>;
    if (payload.error) throw new Error(`rpc ${method} failed (${payload.error.code}): ${payload.error.message}`);
    if (!('result' in payload)) throw new Error(`rpc ${method} returned no result`);
    return payload.result as T;
  }
}

type RpcBlock420 = { number: Hex; hash: Hex; parentHash: Hex; timestamp: Hex; extraData?: Hex; transactions?: RpcTransaction420[] };
type RpcTransaction420 = { hash: Hex; blockHash: Hex; blockNumber: Hex; transactionIndex: Hex; from: Hex; to: Hex | null; input: Hex; value: Hex; };
type RpcLog420 = { address: Hex; blockHash: Hex; blockNumber: Hex; transactionHash: Hex; transactionIndex: Hex; logIndex: Hex; topics: Hex[]; data: Hex; removed?: boolean; };
type RpcReceipt420 = { transactionHash: Hex; blockHash: Hex; blockNumber: Hex; transactionIndex: Hex; status: Hex; contractAddress: Hex | null; logs: RpcLog420[]; };

export function quantity420(value: Hex): bigint { if (!/^0x[0-9a-f]+$/i.test(value)) throw new Error(`invalid rpc quantity: ${value}`); return BigInt(value); }
export function quantityNumber420(value: Hex): number { const n = quantity420(value); if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`rpc quantity exceeds safe integer: ${value}`); return Number(n); }
export function quantityHex420(value: bigint): Hex { if (value < 0n) throw new Error('rpc quantity cannot be negative'); return `0x${value.toString(16)}`; }
function block420(value: RpcBlock420 | null): IndexerBlock | null { return value ? { number: quantity420(value.number), hash: value.hash, parentHash: value.parentHash, timestamp: quantity420(value.timestamp), ...(value.extraData === undefined ? {} : { extraData: value.extraData }) } : null; }
function transaction420(value: RpcTransaction420 | null): IndexerTransaction | null { return value ? { hash: value.hash, blockHash: value.blockHash, blockNumber: quantity420(value.blockNumber), transactionIndex: quantityNumber420(value.transactionIndex), from: value.from, to: value.to, input: value.input, value: quantity420(value.value) } : null; }
function log420(value: RpcLog420): IndexerLog { return { address: value.address, blockHash: value.blockHash, blockNumber: quantity420(value.blockNumber), transactionHash: value.transactionHash, transactionIndex: quantityNumber420(value.transactionIndex), logIndex: quantityNumber420(value.logIndex), topics: value.topics, data: value.data, removed: value.removed }; }
function receipt420(value: RpcReceipt420 | null): IndexerReceipt | null { if (!value) return null; const status = quantity420(value.status); if (status !== 0n && status !== 1n) throw new Error(`invalid receipt status: ${value.status}`); return { transactionHash: value.transactionHash, blockHash: value.blockHash, blockNumber: quantity420(value.blockNumber), transactionIndex: quantityNumber420(value.transactionIndex), status: Number(status) as 0 | 1, contractAddress: value.contractAddress, logs: value.logs.map(log420) }; }
function blockTag420(blockNumber?: bigint): Hex | 'latest' { return blockNumber === undefined ? 'latest' : quantityHex420(blockNumber); }

export class EvmJsonRpcSource420 implements ChainSource420 {
  constructor(readonly transport: JsonRpcTransport420, readonly sourceId = 'evm-json-rpc') {}
  async chainId(): Promise<bigint> { return quantity420(await this.transport.request<Hex>('eth_chainId')); }
  async blockNumber(): Promise<bigint> { return quantity420(await this.transport.request<Hex>('eth_blockNumber')); }
  async finalizedBlockNumber(): Promise<bigint> { const block = block420(await this.transport.request<RpcBlock420 | null>('eth_getBlockByNumber', ['finalized', false])); if (!block) throw new Error('rpc returned no finalized block'); return block.number; }
  async getBlockByNumber(blockNumber: bigint): Promise<IndexerBlock | null> { return block420(await this.transport.request<RpcBlock420 | null>('eth_getBlockByNumber', [quantityHex420(blockNumber), false])); }
  async getBlockByHash(blockHash: Hex): Promise<IndexerBlock | null> { return block420(await this.transport.request<RpcBlock420 | null>('eth_getBlockByHash', [blockHash, false])); }
  async getBlockTransactionsByNumber(blockNumber: bigint): Promise<IndexerTransaction[]> { const block = await this.transport.request<RpcBlock420 | null>('eth_getBlockByNumber', [quantityHex420(blockNumber), true]); if (!block) throw new Error(`missing block ${blockNumber}`); return (block.transactions ?? []).map((tx) => transaction420(tx)!).sort((a,b) => a.transactionIndex-b.transactionIndex); }
  async getTransactionByHash(transactionHash: Hex): Promise<IndexerTransaction | null> { return transaction420(await this.transport.request<RpcTransaction420 | null>('eth_getTransactionByHash', [transactionHash])); }
  async getTransactionReceipt(transactionHash: Hex): Promise<IndexerReceipt | null> { return receipt420(await this.transport.request<RpcReceipt420 | null>('eth_getTransactionReceipt', [transactionHash])); }
  async getLogs(filter: LogFilter420): Promise<IndexerLog[]> { const rpcFilter: Record<string, unknown> = { fromBlock: quantityHex420(filter.fromBlock), toBlock: quantityHex420(filter.toBlock) }; if (filter.addresses?.length === 1) rpcFilter.address = filter.addresses[0]; else if (filter.addresses?.length) rpcFilter.address = filter.addresses; if (filter.topics) rpcFilter.topics = filter.topics; return (await this.transport.request<RpcLog420[]>('eth_getLogs', [rpcFilter])).map(log420); }
  call(request: { to: Hex; data: Hex }, blockNumber?: bigint): Promise<Hex> { return this.transport.request<Hex>('eth_call', [request, blockTag420(blockNumber)]); }
  getCode(address: Hex, blockNumber?: bigint): Promise<Hex> { return this.transport.request<Hex>('eth_getCode', [address, blockTag420(blockNumber)]); }
}

const NO_TRANSACTION = `0x${'0'.repeat(64)}`;
const HASH = /^0x[0-9a-f]{64}$/;
type NativeArchive420 = { blockHash: Hex; blockNumber: Hex; batchRoot: Hex; logs: RpcLog420[] };

/** Use an authenticated node420 Engine transport for both canonical reads and native logs. */
export class Node420EngineSource extends EvmJsonRpcSource420 {
  async getNativeLogs(block: IndexerBlock): Promise<IndexerLog[]> {
    if (block.number === 0n) return [];
    const height = quantityHex420(block.number);
    if (!HASH.test(block.hash) || !block.extraData || !HASH.test(block.extraData)) {
      throw new Error('missing native batch commitment');
    }
    const archive = await this.transport.request<NativeArchive420>('engine420_getSystemCallLogsV1', [block.hash]);
    if (!archive || archive.blockHash !== block.hash || archive.blockNumber !== height ||
        archive.batchRoot !== block.extraData || !Array.isArray(archive.logs)) {
      throw new Error('native archive checkpoint mismatch');
    }
    let previous = -1;
    return archive.logs.map((log) => {
      const index = quantityNumber420(log.logIndex);
      if (log.removed !== false || log.blockHash !== block.hash || log.blockNumber !== height ||
          log.transactionHash !== NO_TRANSACTION || index <= previous ||
          !/^0x[0-9a-f]{40}$/.test(log.address) || !Array.isArray(log.topics) ||
          !log.topics.every((topic) => HASH.test(topic)) || !/^0x(?:[0-9a-f]{2})*$/.test(log.data)) {
        throw new Error('native log provenance mismatch');
      }
      previous = index;
      return log420(log);
    });
  }
}
