import type { Hex, IndexerLog, IndexerTransaction } from './chain-source.js';

export const ZERO_ADDRESS_420 = '0x0000000000000000000000000000000000000000' as Hex;
export const NATIVE_TRANSFER_LOG_INDEX_420 = -1;
export const ERC_TRANSFER_TOPIC_420 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as Hex;
export const ERC1155_TRANSFER_SINGLE_TOPIC_420 = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62' as Hex;
export const ERC1155_TRANSFER_BATCH_TOPIC_420 = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb' as Hex;

export type AssetKind420 = 'native' | 'erc20' | 'erc721' | 'erc1155';

export interface AssetTransfer420 {
  kind: AssetKind420;
  contractAddress: Hex | null;
  tokenId: bigint | null;
  from: Hex;
  to: Hex;
  amount: bigint;
  transactionHash: Hex;
  blockNumber: bigint;
  logIndex: number;
}

function word(data: Hex, index: number): bigint {
  const start = 2 + index * 64;
  const chunk = data.slice(start, start + 64);
  if (chunk.length !== 64 || !/^[0-9a-f]{64}$/i.test(chunk)) throw new Error(`invalid ABI word ${index}`);
  return BigInt(`0x${chunk}`);
}

function addressTopic(topic: Hex): Hex {
  if (!/^0x[0-9a-f]{64}$/i.test(topic)) throw new Error(`invalid address topic: ${topic}`);
  return `0x${topic.slice(-40)}` as Hex;
}

function decodeDynamicUintArray(data: Hex, offsetBytes: bigint): bigint[] {
  if (offsetBytes % 32n !== 0n) throw new Error('unaligned ABI array offset');
  const offsetWords = Number(offsetBytes / 32n);
  if (!Number.isSafeInteger(offsetWords)) throw new Error('ABI array offset exceeds safe integer');
  const length = word(data, offsetWords);
  if (length > 100000n) throw new Error('ABI array length exceeds safety bound');
  const out: bigint[] = [];
  for (let i = 0; i < Number(length); i += 1) out.push(word(data, offsetWords + 1 + i));
  return out;
}

export function decodeAssetLog420(log: IndexerLog): AssetTransfer420[] {
  const topic0 = log.topics[0]?.toLowerCase();
  if (!topic0) return [];

  if (topic0 === ERC_TRANSFER_TOPIC_420) {
    if (log.topics.length === 4) {
      return [{ kind: 'erc721', contractAddress: log.address, tokenId: BigInt(log.topics[3]), from: addressTopic(log.topics[1]), to: addressTopic(log.topics[2]), amount: 1n, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex }];
    }
    if (log.topics.length === 3) {
      return [{ kind: 'erc20', contractAddress: log.address, tokenId: null, from: addressTopic(log.topics[1]), to: addressTopic(log.topics[2]), amount: word(log.data, 0), transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex }];
    }
    throw new Error('malformed ERC Transfer event');
  }

  if (topic0 === ERC1155_TRANSFER_SINGLE_TOPIC_420) {
    if (log.topics.length !== 4) throw new Error('malformed ERC1155 TransferSingle event');
    return [{ kind: 'erc1155', contractAddress: log.address, tokenId: word(log.data, 0), from: addressTopic(log.topics[2]), to: addressTopic(log.topics[3]), amount: word(log.data, 1), transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex }];
  }

  if (topic0 === ERC1155_TRANSFER_BATCH_TOPIC_420) {
    if (log.topics.length !== 4) throw new Error('malformed ERC1155 TransferBatch event');
    const ids = decodeDynamicUintArray(log.data, word(log.data, 0));
    const values = decodeDynamicUintArray(log.data, word(log.data, 1));
    if (ids.length !== values.length) throw new Error('ERC1155 batch ids/values length mismatch');
    return ids.map((tokenId, i) => ({ kind: 'erc1155' as const, contractAddress: log.address, tokenId, from: addressTopic(log.topics[2]), to: addressTopic(log.topics[3]), amount: values[i], transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex }));
  }

  return [];
}

export function decodeNativeTransfer420(transaction: IndexerTransaction): AssetTransfer420 | null {
  if (transaction.value === 0n || transaction.to === null) return null;
  return { kind: 'native', contractAddress: null, tokenId: null, from: transaction.from, to: transaction.to, amount: transaction.value, transactionHash: transaction.hash, blockNumber: transaction.blockNumber, logIndex: NATIVE_TRANSFER_LOG_INDEX_420 };
}
