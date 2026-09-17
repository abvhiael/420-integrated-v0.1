import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BONG_GOGGLES_NOTIFICATION_SOURCE,
  createBongGogglesSubscriptionPreference,
  bongGogglesDeliveryHandoff,
} from '../src/notificationDeliveryPreferences.js';

function candidate(overrides = {}) {
  return {
    notificationId: 'n-1',
    serviceId: '420/service/notifications/v1',
    appId: 'bong-goggles',
    authoritative: false,
    sourceKey: '420:100:1:2',
    recipient: '0x00000000000000000000000000000000000000aa',
    actor: '0x00000000000000000000000000000000000000bb',
    kind: 'COMMENT_CREATED',
    topic: 'interactions',
    subjectId: 'object-1',
    metadata: { parentId: 'object-0' },
    provenance: {
      chainId: 420,
      blockNumber: 100,
      blockHash: '0xblock',
      transactionHash: '0xtx',
      transactionIndex: 1,
      logIndex: 2,
      eventName: 'SocialObjectPublished',
    },
    ...overrides,
  };
}

test('subscription preference requires explicit opt-in and maps Bong Goggles vocabulary to 420Notifications filters', () => {
  assert.throws(() => createBongGogglesSubscriptionPreference({ id: 'bg', topics: ['interactions'], active: false, operationalConsent: true }), /explicitly active/);
  assert.throws(() => createBongGogglesSubscriptionPreference({ id: 'bg', topics: ['interactions'], active: true, operationalConsent: false }), /consent must be explicit/);

  const preference = createBongGogglesSubscriptionPreference({
    id: ' bg-social ',
    topics: ['Interactions', 'groups', 'interactions'],
    kinds: ['COMMENT_CREATED', 'MENTIONED'],
    channels: ['push', 'in_app', 'push'],
    minimumSeverity: 'info',
    active: true,
    operationalConsent: true,
  });

  assert.equal(preference.id, 'bg-social');
  assert.deepEqual(preference.filters.sources, [BONG_GOGGLES_NOTIFICATION_SOURCE]);
  assert.deepEqual(preference.filters.topics, ['groups', 'interactions']);
  assert.deepEqual(preference.filters.events, ['comment_created', 'mentioned']);
  assert.deepEqual(preference.channels, ['in_app', 'push']);
  assert.equal(preference.promotionalConsent, false);
  assert.equal(preference.authoritative, false);
});

test('granular topic/kind filters suppress unmatched candidates', () => {
  const preference = createBongGogglesSubscriptionPreference({
    id: 'comments-only',
    topics: ['interactions'],
    kinds: ['COMMENT_CREATED'],
    channels: ['in_app'],
    active: true,
    operationalConsent: true,
  });

  const destinations = { in_app: 'acct:aa' };
  assert.equal(bongGogglesDeliveryHandoff(candidate(), preference, destinations).length, 1);
  assert.deepEqual(bongGogglesDeliveryHandoff(candidate({ kind: 'MENTIONED' }), preference, destinations), []);
  assert.deepEqual(bongGogglesDeliveryHandoff(candidate({ kind: 'GROUP_ACTIVITY', topic: 'groups' }), preference, destinations), []);
});

test('mute and operational unsubscribe state suppress delivery without mutating canonical truth', () => {
  const base = createBongGogglesSubscriptionPreference({
    id: 'ops',
    topics: ['interactions'],
    channels: ['in_app'],
    active: true,
    operationalConsent: true,
  });

  assert.deepEqual(bongGogglesDeliveryHandoff(candidate(), { ...base, muted: true }, { in_app: 'acct:aa' }), []);
  assert.deepEqual(bongGogglesDeliveryHandoff(candidate(), { ...base, operationalConsent: false }, { in_app: 'acct:aa' }), []);
  assert.equal(candidate().authoritative, false);
});

test('delivery handoff uses Genesis provider kinds and leaves retry/rate state to 420Notifications', () => {
  const preference = createBongGogglesSubscriptionPreference({
    id: 'all-channels',
    topics: ['interactions'],
    channels: ['in_app', 'web', 'push'],
    active: true,
    operationalConsent: true,
  });

  const handoffs = bongGogglesDeliveryHandoff(candidate(), preference, {
    in_app: 'acct:aa',
    web: 'web-session:aa',
    push: 'push-endpoint:aa',
  });

  assert.deepEqual(handoffs.map((item) => item.providerId), ['genesis-in-app', 'genesis-web', 'genesis-push']);
  assert.ok(handoffs.every((item) => item.classification === 'operational' && item.authoritative === false));
  assert.ok(handoffs.every((item) => !('attempt' in item) && !('retryAt' in item) && !('rateLimit' in item)));
  assert.ok(handoffs.every((item) => item.payload.authoritative === false));
});

test('promotional consent remains separate and off by default', () => {
  const operational = createBongGogglesSubscriptionPreference({
    id: 'default-consent',
    topics: ['interactions'],
    channels: ['in_app'],
    active: true,
    operationalConsent: true,
  });
  assert.equal(operational.promotionalConsent, false);

  const explicitlyPromotional = createBongGogglesSubscriptionPreference({
    id: 'promo-opt-in',
    topics: ['interactions'],
    channels: ['in_app'],
    active: true,
    operationalConsent: true,
    promotionalConsent: true,
  });
  assert.equal(explicitlyPromotional.promotionalConsent, true);
  assert.equal(bongGogglesDeliveryHandoff(candidate(), explicitlyPromotional, { in_app: 'acct:aa' })[0].classification, 'operational');
});

test('private Messenger payload protection is still enforced before delivery handoff', () => {
  const preference = createBongGogglesSubscriptionPreference({
    id: 'messages',
    topics: ['messages'],
    channels: ['push'],
    active: true,
    operationalConsent: true,
  });

  const message = candidate({
    kind: 'MESSAGE_RECEIVED',
    topic: 'messages',
    metadata: { messageId: 'm1', conversationId: 'c1', ciphertext: 'forbidden' },
  });

  assert.throws(() => bongGogglesDeliveryHandoff(message, preference, { push: 'push-endpoint:aa' }), /private notification metadata field forbidden/);
});
