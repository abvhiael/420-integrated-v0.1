import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, routeFor } from '../core/router.js';

test('publishes stable V14 route reservations', () => {
  assert.deepEqual(ROUTES.map((route) => route.path), ['/', '/market', '/swap', '/orders', '/bridge', '/portfolio']);
});

test('unknown routes fail safely to markets', () => {
  assert.equal(routeFor('/does-not-exist').id, 'markets');
});
