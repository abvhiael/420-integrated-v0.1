import type { IndexerEventEnvelope420 } from './event-stream.js';

export interface IndexerEventSubscription420 {
  id: string;
  enabled: boolean;
  chainIds?: string[];
  protocols?: string[];
  eventNames?: string[];
  topics?: string[];
  objectKeys?: string[];
  lifecycleStates?: string[];
  contractAddresses?: string[];
}

export interface IndexerEventMatch420 {
  subscriptionId: string;
  eventId: string;
  matched: true;
}

function requiredSubscriptionId420(value: string): string {
  const id = value.trim();
  if (!id) throw new Error('subscription id must not be empty');
  return id;
}

function normalizedValues420(values: string[] | undefined, name: string, lower = false): string[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${name} must not be empty`);
  const normalized = values.map((value) => {
    if (typeof value !== 'string') throw new Error(`invalid ${name}`);
    const item = value.trim();
    if (!item) throw new Error(`invalid ${name}`);
    return lower ? item.toLowerCase() : item;
  });
  return [...new Set(normalized)];
}

export function normalizeIndexerEventSubscription420(subscription: IndexerEventSubscription420): IndexerEventSubscription420 {
  const normalized: IndexerEventSubscription420 = {
    id: requiredSubscriptionId420(subscription.id),
    enabled: subscription.enabled,
    chainIds: normalizedValues420(subscription.chainIds, 'chainIds'),
    protocols: normalizedValues420(subscription.protocols, 'protocols'),
    eventNames: normalizedValues420(subscription.eventNames, 'eventNames'),
    topics: normalizedValues420(subscription.topics, 'topics'),
    objectKeys: normalizedValues420(subscription.objectKeys, 'objectKeys'),
    lifecycleStates: normalizedValues420(subscription.lifecycleStates, 'lifecycleStates'),
    contractAddresses: normalizedValues420(subscription.contractAddresses, 'contractAddresses', true)
  };

  const selectors = [
    normalized.chainIds,
    normalized.protocols,
    normalized.eventNames,
    normalized.topics,
    normalized.objectKeys,
    normalized.lifecycleStates,
    normalized.contractAddresses
  ];
  if (!selectors.some((selector) => selector !== undefined)) {
    throw new Error('subscription must define at least one selector');
  }
  return normalized;
}

function includes420(values: string[] | undefined, value: string | null): boolean {
  return values === undefined || (value !== null && values.includes(value));
}

export function indexerEventMatchesSubscription420(
  subscription: IndexerEventSubscription420,
  event: IndexerEventEnvelope420
): boolean {
  const normalized = normalizeIndexerEventSubscription420(subscription);
  if (!normalized.enabled) return false;
  if (!includes420(normalized.chainIds, event.provenance.chainId)) return false;
  if (!includes420(normalized.protocols, event.protocol)) return false;
  if (!includes420(normalized.eventNames, event.eventName)) return false;
  if (!includes420(normalized.topics, event.topic)) return false;
  if (!includes420(normalized.objectKeys, event.objectKey)) return false;
  if (!includes420(normalized.lifecycleStates, event.lifecycleState)) return false;
  if (!includes420(normalized.contractAddresses, event.provenance.contractAddress.toLowerCase())) return false;
  return true;
}

export function matchIndexerEventSubscriptions420(
  subscriptions: IndexerEventSubscription420[],
  event: IndexerEventEnvelope420
): IndexerEventMatch420[] {
  const seen = new Set<string>();
  const matches: IndexerEventMatch420[] = [];
  for (const subscription of subscriptions) {
    const normalized = normalizeIndexerEventSubscription420(subscription);
    if (seen.has(normalized.id)) throw new Error(`duplicate subscription id: ${normalized.id}`);
    seen.add(normalized.id);
    if (indexerEventMatchesSubscription420(normalized, event)) {
      matches.push({ subscriptionId: normalized.id, eventId: event.id, matched: true });
    }
  }
  return matches;
}

export function filterIndexerEventsForSubscription420(
  subscription: IndexerEventSubscription420,
  events: IndexerEventEnvelope420[]
): IndexerEventEnvelope420[] {
  const normalized = normalizeIndexerEventSubscription420(subscription);
  return events.filter((event) => indexerEventMatchesSubscription420(normalized, event));
}
