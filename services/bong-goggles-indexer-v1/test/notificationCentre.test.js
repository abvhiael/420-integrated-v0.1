import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BONG_GOGGLES_CANONICALITY_STATES,
  bongGogglesCanonicalSubjectLink,
  notificationCentreFallbacks,
  notificationCentreItem,
  notificationCentrePage,
} from '../src/notificationCentre.js';

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

test('notification centre item preserves non-authority and canonical deep link', () => {
  const item = notificationCentreItem(candidate(), {
    createdAt: '2026-09-17T12:00:00Z',
    canonicality: 'finalized',
    title: 'New comment',
    body: 'Someone commented on your post.',
  });

  assert.equal(item.notificationId, 'n-1');
  assert.equal(item.canonicality, 'finalized');
  assert.equal(item.read, false);
  assert.equal(item.authoritative, false);
  assert.match(item.deepLink, /^https:\/\/bonggoggles\.420integrated\.org\/notifications\/resolve\?/);
  assert.match(item.deepLink, /kind=COMMENT_CREATED/);
  assert.match(item.deepLink, /subjectId=object-1/);
  assert.equal(item.provenance.transactionHash, '0xtx');
});

test('notification centre accepts only append-only presentation canonicality states', () => {
  assert.deepEqual(BONG_GOGGLES_CANONICALITY_STATES, ['pending', 'finalized', 'retracted', 'superseded']);
  assert.throws(() => notificationCentreItem(candidate(), {
    createdAt: '2026-09-17T12:00:00Z',
    canonicality: 'rewritten',
  }), /invalid canonicality state/);
});

test('canonical subject deep links are https-only and carry opaque subject identity', () => {
  const link = bongGogglesCanonicalSubjectLink(candidate({ subjectId: 'group/42' }));
  assert.match(link, /subjectId=group%2F42/);
  assert.throws(() => bongGogglesCanonicalSubjectLink(candidate(), 'javascript:alert(1)'), /must use https/);
});

test('notification centre page provides deterministic history, unread count and cursor pagination', () => {
  const items = [
    notificationCentreItem(candidate({ notificationId: 'n-1' }), { createdAt: '2026-09-17T12:00:00Z', read: false }),
    notificationCentreItem(candidate({ notificationId: 'n-2' }), { createdAt: '2026-09-17T13:00:00Z', read: true }),
    notificationCentreItem(candidate({ notificationId: 'n-3' }), { createdAt: '2026-09-17T11:00:00Z', read: false }),
  ];

  const first = notificationCentrePage(items, { limit: 2 });
  assert.deepEqual(first.items.map((item) => item.notificationId), ['n-2', 'n-1']);
  assert.equal(first.unreadCount, 2);
  assert.ok(first.nextCursor);
  assert.equal(first.authoritative, false);

  const second = notificationCentrePage(items, { limit: 2, after: first.nextCursor });
  assert.deepEqual(second.items.map((item) => item.notificationId), ['n-3']);
  assert.equal(second.nextCursor, '');
  assert.equal(second.unreadCount, 2);
});

test('notification centre cursor fails closed instead of silently changing history window', () => {
  const items = [notificationCentreItem(candidate(), { createdAt: '2026-09-17T12:00:00Z' })];
  assert.throws(() => notificationCentrePage(items, { after: 'missing|cursor' }), /cursor not found/);
  assert.throws(() => notificationCentrePage(items, { limit: 101 }), /page limit must be 1..100/);
});

test('degraded notification UX points directly to canonical app, Wallet and Explorer state', () => {
  const fallback = notificationCentreFallbacks();
  assert.equal(fallback.degraded, true);
  assert.equal(fallback.authoritative, false);
  assert.match(fallback.app, /^https:\/\//);
  assert.match(fallback.wallet, /^wallet420:\/\//);
  assert.match(fallback.explorer, /^https:\/\//);
  assert.match(fallback.message, /canonical Bong Goggles, Wallet or Explorer state directly/);
});

test('notification centre surface carries no signing, spending or capability authority', () => {
  const item = notificationCentreItem(candidate(), { createdAt: '2026-09-17T12:00:00Z' });
  const serialized = JSON.stringify(item);
  assert.equal('sign' in item, false);
  assert.equal('spend' in item, false);
  assert.equal('capability' in item, false);
  assert.equal(serialized.includes('privateKey'), false);
});
