import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RpcAdmissionController420,
  RpcWebSocketLifecycle420,
  type RpcResourcePolicy420,
  type RpcWebSocketPolicy420,
} from '../src/index.js';

const resourcePolicy: RpcResourcePolicy420 = {
  maxSingleRequestBytes: 1024,
  maxBatchBytes: 4096,
  maxBatchEntries: 10,
  maxBatchCost: 100,
  maxConcurrentUnitsPerClient: 10,
  maxConcurrentUnitsGlobal: 20,
  tokenCapacityPerClient: 100,
  tokenRefillPerSecond: 10,
  maxTrackedClients: 100,
  clientIdleTtlMs: 60_000,
  maxClientKeyLength: 64,
};

const wsPolicy: RpcWebSocketPolicy420 = {
  maxSessions: 3,
  maxSubscriptionsPerSession: 2,
  maxSubscriptionsGlobal: 4,
  maxQueuedMessagesPerSession: 2,
  maxQueuedBytesPerSession: 100,
  maxEventBytes: 80,
  sessionIdleTtlMs: 1_000,
  heartbeatTimeoutMs: 500,
  maxSessionIdLength: 32,
};

function manager(): RpcWebSocketLifecycle420 {
  return new RpcWebSocketLifecycle420(new RpcAdmissionController420(resourcePolicy), wsPolicy);
}

function subscribe(id = 1, kind = 'newHeads'): unknown {
  return { jsonrpc: '2.0', id, method: 'eth_subscribe', params: [kind] };
}

test('opens bounded websocket sessions and rejects duplicate IDs', () => {
  const lifecycle = manager();
  assert.equal(lifecycle.openSession('s1', 'client-a', 0).opened, true);
  assert.equal(lifecycle.openSession('s1', 'client-b', 0).opened, false);
  assert.equal(lifecycle.openSession('s2', 'client-b', 0).opened, true);
  assert.equal(lifecycle.openSession('s3', 'client-c', 0).opened, true);
  assert.equal(lifecycle.openSession('s4', 'client-d', 0).opened, false);
});

test('subscription setup is RPC-5 and RPC-6 gated before lifecycle allocation', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);

  const blocked = lifecycle.prepareSubscribe('s1', { jsonrpc: '2.0', id: 1, method: 'engine_getPayloadV3', params: [] }, 100, 1);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? '', /outside|compatibility|allowed/i);
  assert.equal(lifecycle.snapshot('s1').subscriptions, 0);

  const valid = lifecycle.prepareSubscribe('s1', subscribe(), 100, 2);
  assert.equal(valid.allowed, true);
  assert.equal(valid.subscription?.kind, 'newHeads');
  assert.equal(valid.subscription?.state, 'pending');
  assert.equal(valid.admission?.allowed, true);
  assert.equal(lifecycle.snapshot('s1').subscriptions, 1);
  assert.equal(lifecycle.snapshot('s1').activeSubscriptions, 0);
});

test('binds local subscriptions uniquely to an upstream subscription', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  lifecycle.openSession('s2', 'client-b', 0);
  const a = lifecycle.prepareSubscribe('s1', subscribe(1), 100, 1).subscription!;
  const b = lifecycle.prepareSubscribe('s2', subscribe(2), 100, 1).subscription!;

  assert.equal(lifecycle.bindSubscription(a.id, 'node-a', '0xsub', 2), true);
  assert.equal(lifecycle.bindSubscription(b.id, 'node-a', '0xsub', 2), false);
  assert.equal(lifecycle.snapshot().activeSubscriptions, 1);
});

test('never permits one websocket session to unsubscribe another session subscription', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  lifecycle.openSession('s2', 'client-b', 0);
  const subscription = lifecycle.prepareSubscribe('s1', subscribe(), 100, 1).subscription!;
  lifecycle.bindSubscription(subscription.id, 'node-a', 'up-1', 2);

  const crossSession = lifecycle.prepareUnsubscribe('s2', subscription.id, 3);
  assert.equal(crossSession.allowed, false);
  assert.match(crossSession.reason ?? '', /does not belong/);

  const owner = lifecycle.prepareUnsubscribe('s1', subscription.id, 4);
  assert.equal(owner.allowed, true);
  assert.equal(owner.subscription?.upstreamSubscriptionId, 'up-1');
  assert.equal(lifecycle.completeUnsubscribe(subscription.id, 5), true);
  assert.equal(lifecycle.snapshot().subscriptions, 0);
});

test('routes upstream events only to their owning local subscription', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  const subscription = lifecycle.prepareSubscribe('s1', subscribe(), 100, 1).subscription!;
  lifecycle.bindSubscription(subscription.id, 'node-a', 'up-1', 2);

  assert.equal(lifecycle.deliver('node-b', 'up-1', { number: '0x1' }, 20, 3).delivered, false);
  assert.equal(lifecycle.deliver('node-a', 'up-1', { number: '0x1' }, 20, 3).delivered, true);
  const events = lifecycle.drain('s1');
  assert.equal(events.length, 1);
  assert.equal(events[0]?.subscription, subscription.id);
  assert.deepEqual(events[0]?.result, { number: '0x1' });
  assert.equal(lifecycle.snapshot('s1').session?.queuedBytes, 0);
});

test('fails closed on backpressure instead of growing an unbounded event queue', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  const subscription = lifecycle.prepareSubscribe('s1', subscribe(), 100, 1).subscription!;
  lifecycle.bindSubscription(subscription.id, 'node-a', 'up-1', 2);

  assert.equal(lifecycle.deliver('node-a', 'up-1', 1, 40, 3).delivered, true);
  assert.equal(lifecycle.deliver('node-a', 'up-1', 2, 40, 4).delivered, true);
  const overflow = lifecycle.deliver('node-a', 'up-1', 3, 40, 5);
  assert.equal(overflow.delivered, false);
  assert.equal(overflow.closedSession, true);
  assert.equal(lifecycle.snapshot('s1').session?.state, 'closed');
  assert.equal(lifecycle.snapshot('s1').session?.queuedMessages, 0);
  assert.equal(lifecycle.snapshot().subscriptions, 0);
});

test('rejects oversized subscription events without corrupting active bindings', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  const subscription = lifecycle.prepareSubscribe('s1', subscribe(), 100, 1).subscription!;
  lifecycle.bindSubscription(subscription.id, 'node-a', 'up-1', 2);

  const oversized = lifecycle.deliver('node-a', 'up-1', {}, 81, 3);
  assert.equal(oversized.delivered, false);
  assert.equal(oversized.closedSession, false);
  assert.equal(lifecycle.snapshot('s1').session?.state, 'open');
  assert.equal(lifecycle.snapshot().activeSubscriptions, 1);
});

test('upstream disconnect invalidates bindings and forces client resubscription', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  const subscription = lifecycle.prepareSubscribe('s1', subscribe(), 100, 1).subscription!;
  lifecycle.bindSubscription(subscription.id, 'node-a', 'up-1', 2);

  assert.deepEqual(lifecycle.invalidateUpstream('node-a', 10), ['s1']);
  assert.equal(lifecycle.snapshot('s1').session?.state, 'closed');
  assert.match(lifecycle.snapshot('s1').session?.closeReason ?? '', /resubscription required/);
  assert.equal(lifecycle.snapshot().subscriptions, 0);
  assert.equal(lifecycle.deliver('node-a', 'up-1', {}, 10, 11).delivered, false);
});

test('heartbeat timeout closes sessions and cleans every subscription', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  const first = lifecycle.prepareSubscribe('s1', subscribe(1), 100, 1).subscription!;
  const second = lifecycle.prepareSubscribe('s1', subscribe(2, 'syncing'), 100, 2).subscription!;
  lifecycle.bindSubscription(first.id, 'node-a', 'up-1', 3);
  lifecycle.bindSubscription(second.id, 'node-a', 'up-2', 3);

  assert.deepEqual(lifecycle.sweep(499), []);
  assert.deepEqual(lifecycle.sweep(500), ['s1']);
  assert.equal(lifecycle.snapshot('s1').session?.state, 'closed');
  assert.equal(lifecycle.snapshot().subscriptions, 0);
});

test('heartbeat refresh prevents premature expiry while idle TTL stays bounded', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  assert.equal(lifecycle.heartbeat('s1', 400), true);
  assert.deepEqual(lifecycle.sweep(899), []);
  assert.deepEqual(lifecycle.sweep(900), ['s1']);
});

test('per-session and global subscription limits are enforced', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  lifecycle.openSession('s2', 'client-b', 0);
  lifecycle.openSession('s3', 'client-c', 0);

  assert.equal(lifecycle.prepareSubscribe('s1', subscribe(1), 100, 1).allowed, true);
  assert.equal(lifecycle.prepareSubscribe('s1', subscribe(2), 100, 2).allowed, true);
  assert.equal(lifecycle.prepareSubscribe('s1', subscribe(3), 100, 3).allowed, false);
  assert.equal(lifecycle.prepareSubscribe('s2', subscribe(4), 100, 4).allowed, true);
  assert.equal(lifecycle.prepareSubscribe('s3', subscribe(5), 100, 5).allowed, true);
  assert.equal(lifecycle.prepareSubscribe('s2', subscribe(6), 100, 6).allowed, false);
});

test('closed sessions can be removed but open sessions cannot', () => {
  const lifecycle = manager();
  lifecycle.openSession('s1', 'client-a', 0);
  assert.equal(lifecycle.removeClosedSession('s1'), false);
  assert.equal(lifecycle.closeSession('s1', 'client disconnected', 1), true);
  assert.equal(lifecycle.removeClosedSession('s1'), true);
  assert.equal(lifecycle.snapshot().sessions, 0);
});
