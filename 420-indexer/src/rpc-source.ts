import type {
  ChainSource420,
  Hex,
  IndexerBlock,
  IndexerLog,
  IndexerReceipt,
  IndexerTransaction,
  LogFilter420
} from './chain-source.js';

export interface JsonRpcTransport420 {
  request<T>(method: string, params?: readonly unknown[]): Promise<T>;
}

interface JsonRpcEnvelope420<T> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class HttpJsonRpcTransport420 implements JsonRpcTransport420 {
  private requestId = 0;

  constructor(readonly url: string, private readonly headers: Record<string, string> = {}) {}

  async request<T>(method: string, params: readonly unknown[] = []): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.requestId, method, params })
    });
    if (!response.ok) throw new Error(`rpc http ${response.status} for ${method}`);
    const payload = (await response.json()) as JsonRpcEnvelope420<T>;
    if (payload.error) throw new Error(`rpc ${method} failed (${payload.error.code}): ${payload.error.message}`);
    if (!('result' in payload)) throw new Error(`rpc ${method} returned no result`);
    return payload.result as T;
  }
}

type RpcBlock420 = { number: Hex; hash: Hex; parentHash: Hex; timestamp: Hex; };
type RpcTransaction420 = { hash: Hex; blockHash: Hex; blockNumber: Hex; transactionIndex: Hex; from: Hex; to: Hex | null; input: Hex; value: Hex; };
type RpcLog420 = { address: Hex; blockHash: Hex; blockNumber: Hex; transactionHash: Hex; transactionIndex: Hex; logIndex: Hex; topics: Hex[]; data: Hex; removed?: boolean; };
type RpcReceipt420 = { transactionHash: Hex; blockHash: Hex; blockNumber: Hex; transactionIndex: Hex; status: Hex; contractAddress: Hex | null; logs: RpcLog420[]; };

export function quantity420(value: Hex): bigint {
  if (!/^0x[0-9a-f]+$/i.test(value)) throw new Error(`invalid rpc quantity: ${value}`);
  return BigInt(value);
}

export function quantityNumber420(value: Hex): number {
  const n = quantity420(value);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`rpc quantity exceeds safe integer: ${value}`);
  return Number(n);
}

export function quantityHex420(value: bigint): Hex {
  if (value < 0n) throw new Error('rpc quantity cannot be negative');
  return `0x${value.toString(16)}`;
}

function block420(value: RpcBlock420 | null): IndexerBlock | null {
  if (!value) return null;
  return { number: quantity420(value.number), hash: value.hash, parentHash: value.parentHash, timestamp: quantity420(value.timestamp) };
}

function transaction420(value: RpcTransaction420 | null): IndexerTransaction | null {
  if (!value) return null;
  return { hash: value.hash, blockHash: value.blockHash, blockNumber: quantity420(value.blockNumber), transactionIndex: quantityNumber420(value.transactionIndex), from: value.from, to: value.to, input: value.input, value: quantity420(value.value) };
}

function log420(value: RpcLog420): IndexerLog {
  return { address: value.address, blockHash: value.blockHash, blockNumber: quantity420(value.blockNumber), transactionHash: value.transactionHash, transactionIndex: quantityNumber420(value.transactionIndex), logIndex: quantityNumber420(value.logIndex), topics: value.topics, data: value.data, removed: value.removed };
}

function receipt420(value: RpcReceipt420 | null): IndexerReceipt | null {
  if (!value) return null;
  const status = quantity420(value.status);
  if (status !== 0n && status !== 1n) throw new Error(`invalid receipt status: ${value.status}`);
  return { transactionHash: value.transactionHash, blockHash: value.blockHash, blockNumber: quantity420(value.blockNumber), transactionIndex: quantityNumber420(value.transactionIndex), status: Number(status) as 0 | 1, contractAddress: value.contractAddress, logs: value.logs.map(log420) };
}

function blockTag420(blockNumber?: bigint): Hex | 'latest' {
  return blockNumber === undefined ? 'latest' : quantityHex420(blockNumber);
}

export class EvmJsonRpcSource420 implements ChainSource420 {
  constructor(readonly transport: JsonRpcTransport420, readonly sourceId = 'evm-json-rpc') {}

  async chainId(): Promise<bigint> { return quantity420(await this.transport.request<Hex>('eth_chainId')); }
  async blockNumber(): Promise<bigint> { return quantity420(await this.transport.request<Hex>('eth_blockNumber')); }

  async finalizedBlockNumber(): Promise<bigint> {
    const block = block420(await this.transport.request<RpcBlock420 | null>('eth_getBlockByNumber', ['finalized', false]));
    if (!block) throw new Error('rpc returned no finalized block');
    return block.number;
  }

  async getBlockByNumber(blockNumber: bigint): Promise<IndexerBlock | null> {
    return block420(await this.transport.request<RpcBlock420 | null>('eth_getBlockByNumber', [quantityHex420(blockNumber), false]));
  }
  async getBlockByHash(blockHash: Hex): Promise<IndexerBlock | null> { return block420(await this.transport.request<RpcBlock420 | null>('eth_getBlockByHash', [blockHash, false])); }
  async getTransactionByHash(transactionHash: Hex): Promise<IndexerTransaction | null> { return transaction420(await this.transport.request<RpcTransaction420 | null>('eth_getTransactionByHash', [transactionHash])); }
  async getTransactionReceipt(transactionHash: Hex): Promise<IndexerReceipt | null> { return receipt420(await this.transport.request<RpcReceipt420 | null>('eth_getTransactionReceipt', [transactionHash])); }

  async getLogs(filter: LogFilter420): Promise<IndexerLog[]> {
    const rpcFilter: Record<string, unknown> = { fromBlock: quantityHex420(filter.fromBlock), toBlock: quantityHex420(filter.toBlock) };
    if (filter.addresses?.length === 1) rpcFilter.address = filter.addresses[0];
    else if (filter.addresses?.length) rpcFilter.address = filter.addresses;
    if (filter.topics) rpcFilter.topics = filter.topics;
    return (await this.transport.request<RpcLog420[]>('eth_getLogs', [rpcFilter])).map(log420);
  }

  call(request: { to: Hex; data: Hex }, blockNumber?: bigint): Promise<Hex> { return this.transport.request<Hex>('eth_call', [request, blockTag420(blockNumber)]); }
  getCode(address: Hex, blockNumber?: bigint): Promise<Hex> { return this.transport.request<Hex>('eth_getCode', [address, blockTag420(blockNumber)]); }
}
