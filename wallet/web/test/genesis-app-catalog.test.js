import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  GENESIS_APP_SERVICES,
  MISSING_CANONICAL_SERVICE_IDS_FOR_NAMED_GENESIS_PRODUCTS,
  NON_CANONICAL_WALLET_ALIASES,
} from '../core/genesis-app-catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const serviceIdsSource = fs.readFileSync(path.join(root, 'contracts/src/libraries/ServiceIds420.sol'), 'utf8');

function canonicalServiceIds420() {
  return new Set([...serviceIdsSource.matchAll(/keccak256\("([^"]+)"\)/g)].map((match) => match[1]));
}

test('W14.5 Wallet catalogue uses only canonical Genesis service IDs', () => {
  const canonical = canonicalServiceIds420();
  assert.ok(canonical.size >= 40, 'canonical Genesis service set unexpectedly small');
  for (const app of GENESIS_APP_SERVICES) {
    assert.ok(canonical.has(app.serviceId), `Wallet app is not canonical: ${app.id} -> ${app.serviceId}`);
  }
});

test('W14.5 reconciles required Wallet-visible Genesis services', () => {
  const ids = new Set(GENESIS_APP_SERVICES.map((app) => app.serviceId));
  const required = [
    '420/service/protocol-registry/v1',
    '420/service/explorer/v1',
    '420/service/search/v1',
    '420/service/analytics/v1',
    '420/service/appstore/v1',
    '420/service/verify/v1',
    '420/service/notifications/v1',
    '420/service/names/v1',
    '420/service/identity/v1',
    '420/service/arbitration/v1',
    '420/service/messenger/v1',
    '420/service/treasury/v1',
    '420/service/grants/v1',
    '420/service/launchpad/v1',
    '420/service/token/v1',
    '420/service/resource-protocol/v1',
    '420/service/market/v1',
    '420/service/rights/v1',
    '420/service/swap/v1',
    '420/service/pay/v1',
    '420/service/bridge/v1',
    '420/service/stake/v1',
    '420/service/governance/v1',
    '420/service/ai/v1',
    '420/service/compute-market/v1',
    '420/service/attention/v1',
    '420/service/cannaseur/v1',
    '420/service/status/v1',
  ];
  for (const serviceId of required) assert.ok(ids.has(serviceId), `missing reconciled Wallet service: ${serviceId}`);
});

test('W14.5 removes stale noncanonical service aliases from verified app gateway', () => {
  const ids = new Set(GENESIS_APP_SERVICES.map((app) => app.serviceId));
  for (const alias of NON_CANONICAL_WALLET_ALIASES) assert.equal(ids.has(alias.serviceId), false, `stale service alias remains: ${alias.serviceId}`);
});

test('W14.5 records named Genesis products that still lack distinct canonical service IDs', () => {
  const byName = new Map(MISSING_CANONICAL_SERVICE_IDS_FOR_NAMED_GENESIS_PRODUCTS.map((entry) => [entry.name, entry]));
  assert.equal(byName.get('420 Exchange')?.status, 'NO_DISTINCT_CANONICAL_SERVICE_ID');
  assert.equal(byName.get('420 Commerce')?.status, 'NO_DISTINCT_CANONICAL_SERVICE_ID');
  assert.equal(byName.get('420 Grow')?.status, 'NO_CANONICAL_SERVICE_ID');
});

test('W14.5 catalogue has unique ids and service IDs', () => {
  const ids = GENESIS_APP_SERVICES.map((app) => app.id);
  const serviceIds = GENESIS_APP_SERVICES.map((app) => app.serviceId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(serviceIds).size, serviceIds.length);
});
