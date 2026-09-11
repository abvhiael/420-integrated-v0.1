import type { IndexerPublicApi420 } from './api-surface.js';
import { IndexerEventStream420 } from './event-stream.js';

export interface TestnetConsumerWitnesses420 {
  blockNumber: string;
  transactionHash: string;
  address: string;
  assetKey: string;
  protocol: string;
  objectKey: string;
  searchTerm?: string;
}

export interface TestnetConsumerQualificationReport420 {
  chainId: string;
  indexedHead: string;
  blockNumber: string;
  transactionHash: string;
  address: string;
  logCount: number;
  assetTransferCount: number;
  protocolEventCount: number;
  streamEventCount: number;
  searchResultCount: number;
}

function same420(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function requirePositiveDecimal420(name: string, value: string): void {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${name} must be a base-10 block number`);
}

export async function runTestnetConsumerQualification420(
  api: IndexerPublicApi420,
  chainId: bigint,
  witnesses: TestnetConsumerWitnesses420,
): Promise<TestnetConsumerQualificationReport420> {
  requirePositiveDecimal420('IDX-10.4 block witness', witnesses.blockNumber);

  const health = await api.health();
  if (health.status !== 'ok' || health.apiVersion !== 'v1' || api.version !== 'v1') {
    throw new Error('IDX-10.4 health/API version qualification failed');
  }

  const readiness = await api.readiness(chainId);
  if (!readiness.ready || !readiness.databaseReady || readiness.chainId !== chainId.toString() || readiness.indexedHead === null) {
    throw new Error('IDX-10.4 readiness qualification failed');
  }

  const status = await api.status(chainId);
  if (status.chainId !== chainId.toString() || status.indexedHead === null || status.authoritative !== false) {
    throw new Error('IDX-10.4 status qualification failed');
  }
  if (BigInt(status.indexedHead) < BigInt(witnesses.blockNumber)) {
    throw new Error(`IDX-10.4 indexed head ${status.indexedHead} has not reached block witness ${witnesses.blockNumber}`);
  }

  const block = await api.block(chainId, witnesses.blockNumber);
  if (!block || block.chainId !== chainId.toString() || block.number !== witnesses.blockNumber) {
    throw new Error('IDX-10.4 block witness was not available through the public API');
  }

  const transaction = await api.transaction(chainId, witnesses.transactionHash);
  if (!transaction || transaction.chainId !== chainId.toString() || !same420(transaction.hash, witnesses.transactionHash)) {
    throw new Error('IDX-10.4 transaction witness was not available through the public API');
  }

  const receipt = await api.receipt(chainId, witnesses.transactionHash);
  if (!receipt || receipt.chainId !== chainId.toString() || !same420(receipt.transactionHash, witnesses.transactionHash)) {
    throw new Error('IDX-10.4 receipt witness was not available through the public API');
  }

  const address = await api.address(chainId, witnesses.address);
  if (!address || address.chainId !== chainId.toString() || !same420(address.address, witnesses.address)) {
    throw new Error('IDX-10.4 address witness was not available through the public API');
  }

  const blockPage = await api.blocks(chainId, { limit: 1, direction: 'desc' });
  if (blockPage.items.length !== 1 || blockPage.items[0]!.chainId !== chainId.toString()) {
    throw new Error('IDX-10.4 block feed qualification failed');
  }

  const transactionPage = await api.transactions(chainId, { address: witnesses.address, limit: 1, direction: 'desc' });
  if (transactionPage.items.length < 1) throw new Error('IDX-10.4 address transaction feed returned no witness data');

  const logs = await api.logs(chainId, { address: witnesses.address, limit: 1, direction: 'desc' });
  if (logs.items.length < 1) throw new Error('IDX-10.4 log feed returned no witness data');

  const assetTransfers = await api.assetTransfers(chainId, { assetKey: witnesses.assetKey, address: witnesses.address, limit: 1, direction: 'desc' });
  if (assetTransfers.items.length < 1) throw new Error('IDX-10.4 asset transfer feed returned no witness data');

  const protocolEvents = await api.protocolEvents(chainId, { protocol: witnesses.protocol, objectKey: witnesses.objectKey, limit: 1, direction: 'desc' });
  if (protocolEvents.items.length < 1) throw new Error('IDX-10.4 protocol event feed returned no witness data');

  const protocolObject = await api.protocolObject(chainId, witnesses.protocol, witnesses.objectKey);
  if (!protocolObject || protocolObject.chainId !== chainId.toString() || protocolObject.protocol !== witnesses.protocol || protocolObject.objectKey !== witnesses.objectKey) {
    throw new Error('IDX-10.4 protocol object witness was not available through the public API');
  }

  const search = await api.search(chainId, witnesses.searchTerm ?? witnesses.transactionHash, 5);
  if (search.length < 1) throw new Error('IDX-10.4 search qualification returned no witness data');

  const stream = new IndexerEventStream420(api);
  const streamed = await stream.protocolEvents(chainId, {
    protocol: witnesses.protocol,
    objectKey: witnesses.objectKey,
    limit: 1,
    direction: 'desc',
  });
  if (streamed.authoritative !== false || streamed.streamVersion !== 'v1' || streamed.events.length < 1) {
    throw new Error('IDX-10.4 notification/event-stream replay qualification returned no witness data');
  }
  const event = streamed.events[0]!;
  if (event.authoritative !== false || event.provenance.chainId !== chainId.toString() || event.protocol !== witnesses.protocol) {
    throw new Error('IDX-10.4 notification/event-stream canonicality metadata was invalid');
  }

  return {
    chainId: chainId.toString(),
    indexedHead: status.indexedHead,
    blockNumber: block.number,
    transactionHash: transaction.hash,
    address: address.address,
    logCount: logs.items.length,
    assetTransferCount: assetTransfers.items.length,
    protocolEventCount: protocolEvents.items.length,
    streamEventCount: streamed.events.length,
    searchResultCount: search.length,
  };
}
