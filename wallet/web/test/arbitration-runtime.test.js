import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARBITRATION_SERVICE_ID,
  arbitrationActionTarget,
  validateArbitrationRuntime,
} from '../core/arbitration-runtime.js';

const hash = (n) => `0x${String(n).padStart(64, '0')}`;
const addr = (n) => `0x${String(n).padStart(40, '0')}`;

function binding() {
  return {
    serviceId: ARBITRATION_SERVICE_ID,
    chainId: 420,
    version: 1,
    router: addr(1),
    routerCodeHash: hash(1),
    dependencies: {
      policies: {address: addr(2), codeHash: hash(2)},
      cases: {address: addr(3), codeHash: hash(3)},
      rulings: {address: addr(4), codeHash: hash(4)},
    },
  };
}

test('Arbitration runtime accepts exact verified service/dependency identity', () => {
  const runtime = validateArbitrationRuntime(binding());
  assert.equal(runtime.serviceId, ARBITRATION_SERVICE_ID);
  assert.equal(arbitrationActionTarget(runtime, 'openCase'), addr(3));
  assert.equal(arbitrationActionTarget(runtime, 'submitRuling'), addr(4));
});

test('Arbitration runtime fails closed on wrong service or missing code identity', () => {
  const wrong = binding();
  wrong.serviceId = '420/service/not-arbitration/v1';
  assert.throws(() => validateArbitrationRuntime(wrong), /service id mismatch/);

  const missing = binding();
  missing.dependencies.rulings.codeHash = `0x${'0'.repeat(64)}`;
  assert.throws(() => validateArbitrationRuntime(missing), /unverified arbitration dependency/);
});

test('Arbitration runtime rejects aliased dependency identities and unsupported actions', () => {
  const aliased = binding();
  aliased.dependencies.cases.address = aliased.router;
  assert.throws(() => validateArbitrationRuntime(aliased), /dependency alias/);
  assert.throws(() => arbitrationActionTarget(binding(), 'seizeFunds'), /unsupported arbitration action/);
});
