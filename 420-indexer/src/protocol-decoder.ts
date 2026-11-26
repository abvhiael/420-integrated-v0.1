import type { Hex, IndexerLog } from './chain-source.js';

export type ProtocolFieldKind420 =
  | 'bytes4' | 'bytes8' | 'bytes16' | 'bytes32'
  | 'address' | 'bool'
  | 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'uint256'
  | 'int256';

export interface ProtocolField420 {
  name: string;
  kind: ProtocolFieldKind420;
  indexed: boolean;
}

export interface ProtocolEventDescriptor420 {
  protocol: string;
  eventName: string;
  topic0: Hex;
  contractAddress?: Hex;
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
const int256FromWord420 = (value: Hex): bigint => { const n=BigInt(value); return n >= (1n<<255n) ? n-(1n<<256n) : n; };

function decodeValue420(kind: ProtocolFieldKind420, value: Hex): string | bigint | boolean {
  if (kind === 'address') return addressFromWord(value).toLowerCase() as Hex;
  if (isUintKind420(kind)) return BigInt(value);
  if (kind === 'int256') return int256FromWord420(value);
  if (kind === 'bool') return BigInt(value) !== 0n;
  return value.toLowerCase();
}

const MODERN_TREASURY_EVENTS_420 = new Set(['AssetPolicySet','ControllerSet','BudgetCreated','BudgetCommitmentChanged','DisbursementScheduled','DisbursementExecuted','DisbursementCancelled']);

export class ProtocolDecoderRegistry420 {
  private readonly byTopic = new Map<string, ProtocolEventDescriptor420[]>();

  constructor(descriptors: readonly ProtocolEventDescriptor420[] = []) {
    for (const descriptor of descriptors) this.register(descriptor);
  }

  register(descriptor: ProtocolEventDescriptor420): void {
    if ((descriptor.protocol === '420DevelopmentCompensation' || descriptor.protocol === '420Resource')
      && (!descriptor.contractAddress || !/^0x[0-9a-f]{40}$/i.test(descriptor.contractAddress)
        || BigInt(descriptor.contractAddress) === 0n)) {
      throw new Error('protocol descriptor requires deployment address');
    }
    if ((descriptor.protocol === '420Launchpad' || descriptor.protocol === '420Arbitration' || descriptor.protocol === '420Treasury' && MODERN_TREASURY_EVENTS_420.has(descriptor.eventName)) && (!descriptor.contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(descriptor.contractAddress) || /^0x0{40}$/.test(descriptor.contractAddress))) throw new Error(descriptor.protocol === '420Launchpad' ? 'Launchpad descriptor requires deployment address' : 'Treasury descriptor requires deployment address');
    const key = descriptor.topic0.toLowerCase();
    const existing = this.byTopic.get(key) ?? [];
    const normalizedAddress = descriptor.contractAddress?.toLowerCase();
    const duplicate = existing.find(candidate => candidate.protocol === descriptor.protocol && candidate.eventName === descriptor.eventName && candidate.contractAddress?.toLowerCase() === normalizedAddress);
    if (duplicate) {
      if (JSON.stringify(duplicate.fields) !== JSON.stringify(descriptor.fields)) throw new Error('protocol descriptor ABI drift: ' + descriptor.eventName);
      return;
    }
    if (existing.some((candidate) => {
      const candidateAddress = candidate.contractAddress?.toLowerCase();
      if (candidateAddress !== normalizedAddress) return false;
      return candidate.protocol !== descriptor.protocol || candidate.eventName !== descriptor.eventName;
    })) {
      throw new Error(`protocol topic collision: ${descriptor.topic0}`);
    }
    if (existing.some((candidate) => candidate.contractAddress === undefined) && normalizedAddress !== undefined) {
      throw new Error(`protocol topic wildcard collision: ${descriptor.topic0}`);
    }
    if (normalizedAddress === undefined && existing.length !== 0) {
      throw new Error(`protocol topic wildcard collision: ${descriptor.topic0}`);
    }
    existing.push(descriptor);
    this.byTopic.set(key, existing);
  }

  decode(log: IndexerLog): DecodedProtocolEvent420 | null {
    if (log.removed) return null;
    const topic0 = log.topics[0]?.toLowerCase();
    if (!topic0) return null;
    const candidates = this.byTopic.get(topic0);
    if (!candidates) return null;
    const address = log.address.toLowerCase();
    const descriptor = candidates.find((candidate) => candidate.contractAddress?.toLowerCase() === address)
      ?? candidates.find((candidate) => candidate.contractAddress === undefined);
    if (!descriptor) {
      // Anyone can emit a matching topic. Ignore unrelated addresses without halting canonical ingestion.
      if (candidates.every(candidate => candidate.protocol === '420DevelopmentCompensation' || candidate.protocol === '420Resource')) return null;
      const names = [...new Set(candidates.map((candidate) => candidate.protocol + '.' + candidate.eventName))].join(',');
      throw new Error('protocol descriptor contract mismatch: ' + names);
    }

    const strictTreasury = descriptor.protocol === '420Treasury' && MODERN_TREASURY_EVENTS_420.has(descriptor.eventName);
    const strictLaunchpad = descriptor.protocol === '420Launchpad';
    const strictArbitration = descriptor.protocol === '420Arbitration';
    const strictCompensation = descriptor.protocol === '420DevelopmentCompensation';
    const strict = strictTreasury || strictLaunchpad || strictArbitration || strictCompensation || descriptor.protocol === '420Resource';
    if (strict && (!/^0x[0-9a-fA-F]{64}$/.test(log.blockHash) || !/^0x[0-9a-fA-F]{64}$/.test(log.transactionHash) || log.blockNumber < 0n || !Number.isSafeInteger(log.transactionIndex) || log.transactionIndex < 0 || !Number.isSafeInteger(log.logIndex) || log.logIndex < 0)) throw new Error(strictCompensation ? 'malformed canonical compensation log' : strictLaunchpad ? 'malformed canonical Launchpad provenance' : strictArbitration ? 'malformed canonical Arbitration provenance' : 'malformed canonical Treasury provenance');
    if (descriptor.protocol === '420Bridge' || strict) {
      const indexed = descriptor.fields.filter(field => field.indexed).length;
      const dataWords = descriptor.fields.length - indexed;
      if (log.topics.length !== indexed + 1 || !/^0x[0-9a-fA-F]*$/.test(log.data) || log.data.length !== 2 + dataWords * 64) throw new Error(strictCompensation ? 'malformed canonical compensation log' : strictLaunchpad ? 'malformed canonical Launchpad log' : strictArbitration ? 'malformed canonical Arbitration log' : strictTreasury ? 'malformed canonical Treasury log' : 'malformed canonical bridge log');
    }
    const fields: Record<string, string | bigint | boolean> = {};
    let indexedIndex = 1;
    let dataIndex = 0;
    for (const field of descriptor.fields) {
      const encoded = field.indexed ? log.topics[indexedIndex++] : word(log.data, dataIndex++);
      if (!encoded || encoded.length !== 66) throw new Error(`malformed ${descriptor.protocol}.${descriptor.eventName} log`);
      if (descriptor.protocol === '420Bridge' || strict) {
        if (!/^0x[0-9a-fA-F]{64}$/.test(encoded)) throw new Error(strictCompensation ? 'malformed canonical compensation log' : strictLaunchpad ? 'malformed canonical Launchpad word' : strictArbitration ? 'malformed canonical Arbitration word' : strictTreasury ? 'malformed canonical Treasury word' : 'malformed canonical bridge word');
        if (field.kind === 'bool' && BigInt(encoded) > 1n) throw new Error(strictCompensation ? 'noncanonical compensation field' : strictLaunchpad ? 'noncanonical Launchpad boolean' : strictArbitration ? 'noncanonical Arbitration boolean' : strictTreasury ? 'noncanonical Treasury boolean' : 'noncanonical bridge boolean');
        if (field.kind.startsWith('uint') && BigInt(encoded) >= (1n << BigInt(field.kind.slice(4)))) throw new Error(strictCompensation ? 'noncanonical compensation field' : strictLaunchpad ? 'noncanonical Launchpad integer' : strictArbitration ? 'noncanonical Arbitration integer' : strictTreasury ? 'noncanonical Treasury integer' : 'noncanonical bridge integer');
        if (field.kind === 'address' && BigInt(encoded) >= (1n << 160n)) throw new Error(strictCompensation ? 'noncanonical compensation field' : strictLaunchpad ? 'noncanonical Launchpad address' : strictArbitration ? 'noncanonical Arbitration address' : strictTreasury ? 'noncanonical Treasury address' : 'noncanonical bridge address');
      }
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
  '420Registry','420Names','420Identity','420Stake','420Governance','420Treasury','420Grants','420Pay','420Swap','420Exchange','420Bridge','420Rights','420Randomness','420AI','420Launchpad','420Arbitration'
] as const;
