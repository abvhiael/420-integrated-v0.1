import type { IndexerEventEnvelope420 } from './event-stream.js';

export type IndexerEventCanonicalState420 = 'observed' | 'finalized' | 'retracted' | 'superseded';
export type IndexerEventCanonicalSignalKind420 = 'finalized' | 'retracted' | 'superseded';

export interface IndexerEventCanonicalRecord420 {
  event: IndexerEventEnvelope420;
  state: IndexerEventCanonicalState420;
  replacementEventId: string | null;
}

export interface IndexerEventCanonicalSignal420 {
  id: string;
  kind: IndexerEventCanonicalSignalKind420;
  eventId: string;
  replacementEventId: string | null;
  reason: string | null;
  chainId: string;
  blockNumber: string;
  blockHash: string;
  authoritative: false;
}

function requiredReason420(value: string): string {
  const reason = value.trim();
  if (!reason) throw new Error('canonicality reason must not be empty');
  return reason.slice(0, 256);
}

function signalId420(kind: IndexerEventCanonicalSignalKind420, eventId: string, replacementEventId: string | null): string {
  return [
    '420eventchange',
    'v1',
    kind,
    encodeURIComponent(eventId),
    replacementEventId === null ? '-' : encodeURIComponent(replacementEventId)
  ].join(':');
}

function sameEnvelopeIdentity420(left: IndexerEventEnvelope420, right: IndexerEventEnvelope420): boolean {
  return left.id === right.id
    && left.provenance.chainId === right.provenance.chainId
    && left.provenance.blockNumber === right.provenance.blockNumber
    && left.provenance.blockHash === right.provenance.blockHash
    && left.provenance.transactionHash === right.provenance.transactionHash
    && left.provenance.transactionIndex === right.provenance.transactionIndex
    && left.provenance.logIndex === right.provenance.logIndex
    && left.provenance.contractAddress === right.provenance.contractAddress
    && left.protocol === right.protocol
    && left.eventName === right.eventName
    && left.objectKey === right.objectKey;
}

/**
 * Tracks delivery-time canonicality only. This is rebuildable presentation state
 * and never becomes authority for the underlying protocol event.
 */
export class IndexerEventCanonicality420 {
  readonly records = new Map<string, IndexerEventCanonicalRecord420>();
  readonly signals = new Map<string, IndexerEventCanonicalSignal420>();

  observe(event: IndexerEventEnvelope420): IndexerEventCanonicalRecord420 {
    if (!event.id || event.authoritative !== false) throw new Error('invalid event envelope');
    const existing = this.records.get(event.id);
    if (existing) {
      if (!sameEnvelopeIdentity420(existing.event, event)) throw new Error('event identity collision');
      return existing;
    }
    const record: IndexerEventCanonicalRecord420 = {
      event,
      state: 'observed',
      replacementEventId: null
    };
    this.records.set(event.id, record);
    return record;
  }

  finalize(eventId: string): IndexerEventCanonicalSignal420 {
    const record = this.requiredRecord(eventId);
    if (record.state === 'finalized') return this.requiredSignal('finalized', eventId, null);
    if (record.state !== 'observed') throw new Error('non-canonical event cannot be finalized');
    record.state = 'finalized';
    return this.appendSignal(record, 'finalized', null, null);
  }

  retract(eventId: string, reason: string): IndexerEventCanonicalSignal420 {
    const record = this.requiredRecord(eventId);
    if (record.state === 'finalized') throw new Error('finalized event history is immutable');
    if (record.state === 'superseded') throw new Error('superseded event cannot be retracted');
    if (record.state === 'retracted') return this.requiredSignal('retracted', eventId, null);
    record.state = 'retracted';
    return this.appendSignal(record, 'retracted', null, requiredReason420(reason));
  }

  supersede(eventId: string, replacement: IndexerEventEnvelope420, reason: string): IndexerEventCanonicalSignal420 {
    const record = this.requiredRecord(eventId);
    if (record.state === 'finalized') throw new Error('finalized event history is immutable');
    if (record.state === 'retracted') throw new Error('retracted event cannot be superseded');
    if (replacement.id === eventId) throw new Error('replacement event must have a distinct identity');
    if (replacement.provenance.chainId !== record.event.provenance.chainId) {
      throw new Error('replacement event must remain on the same chain');
    }

    const replacementRecord = this.observe(replacement);
    if (replacementRecord.state === 'retracted' || replacementRecord.state === 'superseded') {
      throw new Error('replacement event is not canonical');
    }

    if (record.state === 'superseded') {
      if (record.replacementEventId !== replacement.id) throw new Error('event already superseded by another replacement');
      return this.requiredSignal('superseded', eventId, replacement.id);
    }

    record.state = 'superseded';
    record.replacementEventId = replacement.id;
    return this.appendSignal(record, 'superseded', replacement.id, requiredReason420(reason));
  }

  private requiredRecord(eventId: string): IndexerEventCanonicalRecord420 {
    const id = eventId.trim();
    if (!id) throw new Error('event id must not be empty');
    const record = this.records.get(id);
    if (!record) throw new Error('event canonicality record not found');
    return record;
  }

  private requiredSignal(
    kind: IndexerEventCanonicalSignalKind420,
    eventId: string,
    replacementEventId: string | null
  ): IndexerEventCanonicalSignal420 {
    const signal = this.signals.get(signalId420(kind, eventId, replacementEventId));
    if (!signal) throw new Error('canonicality signal not found');
    return signal;
  }

  private appendSignal(
    record: IndexerEventCanonicalRecord420,
    kind: IndexerEventCanonicalSignalKind420,
    replacementEventId: string | null,
    reason: string | null
  ): IndexerEventCanonicalSignal420 {
    const id = signalId420(kind, record.event.id, replacementEventId);
    const existing = this.signals.get(id);
    if (existing) return existing;
    const signal: IndexerEventCanonicalSignal420 = {
      id,
      kind,
      eventId: record.event.id,
      replacementEventId,
      reason,
      chainId: record.event.provenance.chainId,
      blockNumber: record.event.provenance.blockNumber,
      blockHash: record.event.provenance.blockHash,
      authoritative: false
    };
    this.signals.set(id, signal);
    return signal;
  }
}
