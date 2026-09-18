import {
  BONG_GOGGLES_NOTIFICATION_KINDS,
  bongGogglesNotificationDescriptor,
  bongGogglesNotificationTopics,
  validateBongGogglesNotificationCandidate,
} from './notificationCatalog.js';

export const BONG_GOGGLES_NOTIFICATION_SOURCE = 'bong-goggles';
export const BONG_GOGGLES_NOTIFICATION_CHANNELS = Object.freeze(['in_app', 'web', 'push']);

const PROVIDER_BY_CHANNEL = Object.freeze({
  in_app: 'genesis-in-app',
  web: 'genesis-web',
  push: 'genesis-push',
});

const SEVERITY_VALUE = Object.freeze({ info: 1, warning: 2, critical: 3 });
const TOPICS = new Set(bongGogglesNotificationTopics());
const KINDS = new Set(BONG_GOGGLES_NOTIFICATION_KINDS);

function uniqueNormalized(values, field, normalize) {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  const set = new Set();
  for (const value of values) {
    const normalized = normalize(String(value).trim());
    if (normalized) set.add(normalized);
  }
  return [...set];
}

function normalizeChannels(channels) {
  const normalized = uniqueNormalized(channels, 'channels', (value) => value.toLowerCase());
  if (normalized.length === 0) throw new Error('at least one notification channel is required');
  for (const channel of normalized) {
    if (!BONG_GOGGLES_NOTIFICATION_CHANNELS.includes(channel)) throw new Error(`unsupported notification channel: ${channel}`);
  }
  const selected = new Set(normalized);
  return BONG_GOGGLES_NOTIFICATION_CHANNELS.filter((channel) => selected.has(channel));
}

function normalizeTopics(topics) {
  const normalized = uniqueNormalized(topics, 'topics', (value) => value.toLowerCase()).sort();
  for (const topic of normalized) {
    if (!TOPICS.has(topic)) throw new Error(`unsupported Bong Goggles notification topic: ${topic}`);
  }
  return normalized;
}

function normalizeKinds(kinds) {
  const normalized = uniqueNormalized(kinds, 'kinds', (value) => value.toUpperCase()).sort();
  for (const kind of normalized) {
    if (!KINDS.has(kind)) throw new Error(`unsupported Bong Goggles notification kind: ${kind}`);
  }
  return normalized;
}

export function createBongGogglesSubscriptionPreference({
  id,
  topics = [],
  kinds = [],
  channels = ['in_app'],
  minimumSeverity = 'info',
  active,
  muted = false,
  operationalConsent,
  promotionalConsent = false,
} = {}) {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) throw new Error('subscription id is required');
  if (active !== true) throw new Error('subscription must be explicitly active');
  if (operationalConsent !== true) throw new Error('operational notification consent must be explicit');
  if (!(minimumSeverity in SEVERITY_VALUE)) throw new Error('invalid minimum severity');

  const normalizedTopics = normalizeTopics(topics);
  const normalizedKinds = normalizeKinds(kinds);
  if (normalizedTopics.length === 0 && normalizedKinds.length === 0) {
    throw new Error('Bong Goggles subscription requires at least one topic or kind');
  }

  return Object.freeze({
    id: normalizedId,
    filters: Object.freeze({
      sources: Object.freeze([BONG_GOGGLES_NOTIFICATION_SOURCE]),
      topics: Object.freeze(normalizedTopics),
      events: Object.freeze(normalizedKinds.map((kind) => kind.toLowerCase())),
    }),
    minimumSeverity: SEVERITY_VALUE[minimumSeverity],
    channels: Object.freeze(normalizeChannels(channels)),
    muted: muted === true,
    active: true,
    promotionalConsent: promotionalConsent === true,
    operationalConsent: true,
    authoritative: false,
  });
}

function subscriptionMatches(candidate, subscription) {
  if (!subscription || subscription.authoritative !== false) throw new Error('non-authoritative subscription preference required');
  if (subscription.active !== true || subscription.muted === true || subscription.operationalConsent !== true) return false;
  const sourceFilters = subscription.filters?.sources ?? [];
  const topicFilters = subscription.filters?.topics ?? [];
  const eventFilters = subscription.filters?.events ?? [];
  if (sourceFilters.length > 0 && !sourceFilters.includes(BONG_GOGGLES_NOTIFICATION_SOURCE)) return false;
  if (topicFilters.length > 0 && !topicFilters.includes(candidate.topic.toLowerCase())) return false;
  if (eventFilters.length > 0 && !eventFilters.includes(candidate.kind.toLowerCase())) return false;

  const severity = bongGogglesNotificationDescriptor(candidate.kind).severity;
  return SEVERITY_VALUE[severity] >= subscription.minimumSeverity;
}

export function bongGogglesDeliveryHandoff(candidate, subscription, destinations = {}) {
  const validated = validateBongGogglesNotificationCandidate(candidate);
  if (!subscriptionMatches(validated, subscription)) return [];

  return subscription.channels.map((channel) => {
    const destination = String(destinations[channel] ?? '').trim();
    if (!destination) throw new Error(`notification destination required for channel: ${channel}`);
    return Object.freeze({
      providerId: PROVIDER_BY_CHANNEL[channel],
      channel,
      eventId: validated.notificationId,
      destination,
      severity: SEVERITY_VALUE[validated.severity],
      classification: 'operational',
      authoritative: false,
      payload: Object.freeze({
        notificationId: validated.notificationId,
        appId: validated.appId,
        recipient: validated.recipient,
        actor: validated.actor,
        kind: validated.kind,
        topic: validated.topic,
        subjectId: validated.subjectId,
        metadata: Object.freeze({ ...(validated.metadata ?? {}) }),
        provenance: Object.freeze({ ...validated.provenance }),
        authoritative: false,
      }),
    });
  });
}
