import type { CanonicalEvent } from './types.js';

export interface JsonRpcLog420 {
  address: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
  data: string;
  topics: string[];
  removed?: boolean;
}

export interface JsonRpcBlock420 {
  number: string;
  hash: string;
  parentHash: string;
}

export type JsonRpcRequest420 = (method: string, params: unknown[]) => Promise<unknown>;

export type CanonicalLogDecoder420 = (
  log: JsonRpcLog420,
  block: JsonRpcBlock420,
) => Omit<
  CanonicalEvent,
  'eventKey' | 'blockNumber' | 'blockHash' | 'parentHash' | 'transactionIndex' | 'txHash' | 'logIndex' | 'finalized'
> | null;

export class RpcCanonicalEventSource420 {
  constructor(
    private readonly request: JsonRpcRequest420,
    private readonly decode: CanonicalLogDecoder420,
  ) {}

  async load(fromBlock: number, toBlock: number, addresses: string[] = []): Promise<CanonicalEvent[]> {
    if (!Number.isSafeInteger(fromBlock) || !Number.isSafeInteger(toBlock) || fromBlock < 0 || toBlock < fromBlock) {
      throw new Error('invalid RPC block range');
    }

    const filter: Record<string, unknown> = {
      fromBlock: toQuantity(fromBlock),
      toBlock: toQuantity(toBlock),
    };
    if (addresses.length === 1) filter.address = addresses[0];
    if (addresses.length > 1) filter.address = addresses;

    const rawLogs = await this.request('eth_getLogs', [filter]);
    if (!Array.isArray(rawLogs)) throw new Error('eth_getLogs returned a non-array result');

    const finalizedRaw = await this.request('eth_getBlockByNumber', ['finalized', false]);
    const finalizedBlock = isBlock(finalizedRaw) ? fromQuantity(finalizedRaw.number) : -1;

    const blocks = new Map<number, JsonRpcBlock420>();
    const events: CanonicalEvent[] = [];

    for (const raw of rawLogs) {
      if (!isLog(raw)) throw new Error('eth_getLogs returned a malformed log');
      if (raw.removed) throw new Error('RPC returned a removed log; canonical reload required');

      const blockNumber = fromQuantity(raw.blockNumber);
      let block = blocks.get(blockNumber);
      if (block == null) {
        const fetched = await this.request('eth_getBlockByNumber', [raw.blockNumber, false]);
        if (!isBlock(fetched)) throw new Error(`missing block header for ${raw.blockNumber}`);
        block = fetched;
        blocks.set(blockNumber, block);
      }
      if (block.hash.toLowerCase() !== raw.blockHash.toLowerCase()) {
        throw new Error(`log block hash does not match canonical header at ${blockNumber}`);
      }

      const decoded = this.decode(raw, block);
      if (decoded == null) continue;

      events.push({
        ...decoded,
        eventKey: `${raw.blockHash.toLowerCase()}:${raw.transactionHash.toLowerCase()}:${fromQuantity(raw.logIndex)}`,
        blockNumber,
        blockHash: raw.blockHash.toLowerCase(),
        parentHash: block.parentHash.toLowerCase(),
        transactionIndex: fromQuantity(raw.transactionIndex),
        txHash: raw.transactionHash.toLowerCase(),
        logIndex: fromQuantity(raw.logIndex),
        finalized: finalizedBlock >= 0 && blockNumber <= finalizedBlock,
      });
    }

    events.sort((a, b) =>
      a.blockNumber - b.blockNumber ||
      (a.transactionIndex ?? 0) - (b.transactionIndex ?? 0) ||
      a.logIndex - b.logIndex ||
      a.eventKey.localeCompare(b.eventKey)
    );
    return events;
  }
}

function toQuantity(value: number): string {
  return `0x${value.toString(16)}`;
}

function fromQuantity(value: string): number {
  if (!/^0x[0-9a-f]+$/i.test(value)) throw new Error(`invalid RPC quantity: ${value}`);
  const parsed = Number.parseInt(value.slice(2), 16);
  if (!Number.isSafeInteger(parsed)) throw new Error(`RPC quantity exceeds safe integer range: ${value}`);
  return parsed;
}

function isLog(value: unknown): value is JsonRpcLog420 {
  if (value == null || typeof value !== 'object') return false;
  const log = value as Partial<JsonRpcLog420>;
  return typeof log.address === 'string'
    && typeof log.blockNumber === 'string'
    && typeof log.blockHash === 'string'
    && typeof log.transactionHash === 'string'
    && typeof log.transactionIndex === 'string'
    && typeof log.logIndex === 'string'
    && typeof log.data === 'string'
    && Array.isArray(log.topics)
    && log.topics.every((topic) => typeof topic === 'string');
}

function isBlock(value: unknown): value is JsonRpcBlock420 {
  if (value == null || typeof value !== 'object') return false;
  const block = value as Partial<JsonRpcBlock420>;
  return typeof block.number === 'string' && typeof block.hash === 'string' && typeof block.parentHash === 'string';
}
