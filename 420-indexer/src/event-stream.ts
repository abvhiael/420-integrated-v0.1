import type { IndexerPublicApi420, ProtocolEventPageRequest420 } from './api-surface.js';
import type { JsonValue420, ProtocolEventDto420 } from './public-dto.js';

export const INDEXER_EVENT_STREAM_VERSION_420 = 'v1' as const;

export interface IndexerEventProvenance420 {
  chainId: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  contractAddress: string;
}

export interface IndexerEventEnvelope420 {
  streamVersion: typeof INDEXER_EVENT_STREAM_VERSION_420;
  id: string;
  source: 'protocol';
  topic: string;
  protocol: string;
  eventName: string;
  objectKey: string | null;
  lifecycleState: string | null;
  fields: { [key: string]: JsonValue420 };
  provenance: IndexerEventProvenance420;
  authoritative: false;
}

export interface IndexerEventBatch420 {
  streamVersion: typeof INDEXER_EVENT_STREAM_VERSION_420;
  events: IndexerEventEnvelope420[];
  nextCursor: string | null;
  authoritative: false;
}

export interface IndexerEventStreamRequest420 {
  cursor?: string;
  limit?: number;
  direction?: 'asc' | 'desc';
  protocol?: string;
  objectKey?: string;
}

function encodedPart420(value: string): string {
  return encodeURIComponent(value.toLowerCase());
}

/**
 * Stable event identity includes the canonical block hash so an event replayed on
 * a replacement fork cannot collide with the event it superseded.
 */
export function indexerEventId420(event: ProtocolEventDto420): string {
  if (!event.chainId || !event.blockHash || !event.transactionHash || event.logIndex < 0) {
    throw new Error('invalid protocol event identity');
  }
  return [
    '420evt',
    INDEXER_EVENT_STREAM_VERSION_420,
    encodedPart420(event.chainId),
    encodedPart420(event.blockHash),
    encodedPart420(event.transactionHash),
    String(event.logIndex)
  ].join(':');
}

export function indexerEventEnvelope420(event: ProtocolEventDto420): IndexerEventEnvelope420 {
  if (!event.protocol || !event.eventName) throw new Error('invalid protocol event topic');
  return {
    streamVersion: INDEXER_EVENT_STREAM_VERSION_420,
    id: indexerEventId420(event),
    source: 'protocol',
    topic: `${event.protocol}.${event.eventName}`,
    protocol: event.protocol,
    eventName: event.eventName,
    objectKey: event.objectKey,
    lifecycleState: event.lifecycleState,
    fields: event.fields,
    provenance: {
      chainId: event.chainId,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      transactionHash: event.transactionHash,
      transactionIndex: event.transactionIndex,
      logIndex: event.logIndex,
      contractAddress: event.contractAddress
    },
    authoritative: false
  };
}

/**
 * Consumer-facing replayable event stream. It deliberately depends on the
 * stable public API rather than query services or database rows.
 */
export class IndexerEventStream420 {
  constructor(readonly api: Pick<IndexerPublicApi420, 'protocolEvents'>) {}

  async protocolEvents(chainId: bigint, request: IndexerEventStreamRequest420 = {}): Promise<IndexerEventBatch420> {
    const pageRequest: ProtocolEventPageRequest420 = {
      cursor: request.cursor,
      limit: request.limit,
      direction: request.direction,
      protocol: request.protocol,
      objectKey: request.objectKey
    };
    const page = await this.api.protocolEvents(chainId, pageRequest);
    return {
      streamVersion: INDEXER_EVENT_STREAM_VERSION_420,
      events: page.items.map(indexerEventEnvelope420),
      nextCursor: page.nextCursor,
      authoritative: false
    };
  }
}
