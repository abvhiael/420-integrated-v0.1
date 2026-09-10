import type { Hex, IndexerLog } from './chain-source.js';

export type ProtocolFieldKind420 =
  | 'bytes4' | 'bytes8' | 'bytes16' | 'bytes32'
  | 'address' | 'bool'
  | 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'uint256';

export interface ProtocolField420 {
  name: string;
  kind: ProtocolFieldKind420;
  indexed: boolean;
}

export interface ProtocolEventDescriptor420 {
  protocol: string;
  eventName: string;
  topic0: Hex;
  fields: ProtocolField420[];
}

export interface DecodedProtocolEvent420 {
  protocol: string;
  eventName: string;
  contractAddress: Hex;
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  transactionIndex: number;
  logIndex: number;
  fields: Record<string, string | bigint | boolean>;
}

const word = (hex: Hex, index: number): Hex => `0x${hex.slice(2 + index * 64, 2 + (index + 1) * 64)}` as Hex;
const addressFromWord = (value: Hex): Hex => `0x${value.slice(-40)}` as Hex;
const isUintKind420 = (kind: ProtocolFieldKind420): boolean => kind.startsWith('uint');

function decodeValue420(kind: ProtocolFieldKind420, value: Hex): string | bigint | boolean {
  if (kind === 'address') return addressFromWord(value).toLowerCase() as Hex;
  if (isUintKind420(kind)) return BigInt(value);
  if (kind === 'bool') return BigInt(value) !== 0n;
  return value.toLowerCase();
}

export class ProtocolDecoderRegistry420 {
  private readonly byTopic = new Map<string, ProtocolEventDescriptor420>();

  constructor(descriptors: readonly ProtocolEventDescriptor420[] = []) {
    for (const descriptor of descriptors) this.register(descriptor);
  }

  register(descriptor: ProtocolEventDescriptor420): void {
    const key = descriptor.topic0.toLowerCase();
    const existing = this.byTopic.get(key);
    if (existing && (existing.protocol !== descriptor.protocol || existing.eventName !== descriptor.eventName)) {
      throw new Error(`protocol topic collision: ${descriptor.topic0}`);
    }
    this.byTopic.set(key, descriptor);
  }

  decode(log: IndexerLog): DecodedProtocolEvent420 | null {
    const topic0 = log.topics[0]?.toLowerCase();
    if (!topic0) return null;
    const descriptor = this.byTopic.get(topic0);
    if (!descriptor) return null;

    const fields: Record<string, string | bigint | boolean> = {};
    let indexedIndex = 1;
    let dataIndex = 0;
    for (const field of descriptor.fields) {
      const encoded = field.indexed ? log.topics[indexedIndex++] : word(log.data, dataIndex++);
      if (!encoded || encoded.length !== 66) throw new Error(`malformed ${descriptor.protocol}.${descriptor.eventName} log`);
      fields[field.name] = decodeValue420(field.kind, encoded);
    }

    return {
      protocol: descriptor.protocol,
      eventName: descriptor.eventName,
      contractAddress: log.address.toLowerCase() as Hex,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex,
      logIndex: log.logIndex,
      fields
    };
  }
}

export const GENESIS_PROTOCOLS_420 = [
  '420Registry','420Names','420Identity','420Stake','420Governance','420Treasury','420Pay','420Swap','420Exchange','420Bridge','420Rights','420Randomness'
] as const;
