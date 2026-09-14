import assert from 'node:assert/strict';
import test from 'node:test';
import { AutomationWorkerRegistry420 } from '../src/index.js';

const worker = { workerId: 'worker.alpha', address: '0x1111111111111111111111111111111111111111', status: 'active' as const, registeredAtMs: 1000, lastHeartbeatMs: 1000 };
const occurrence = `0x${'aa'.repeat(32)}`;

test('AUT-7 registers live workers and acquires one occurrence lease', () => {
  const r = new AutomationWorkerRegistry420({ heartbeatTtlMs: 100, leaseTtlMs: 200, maxWorkers: 4, maxActiveLeases: 4 });
  r.register(worker);
  const lease = r.acquireLease({ jobId: 'job.alpha', occurrenceId: occurrence, workerId: worker.workerId, nowMs: 1050 });
  assert.equal(lease.workerId, worker.workerId);
  assert.equal(r.getLeaseForOccurrence(occurrence, 1050)?.leaseId, lease.leaseId);
  assert.throws(() => r.acquireLease({ jobId: 'job.alpha', occurrenceId: occurrence, workerId: worker.workerId, nowMs: 1051 }), /AUT7_OCCURRENCE_ALREADY_LEASED/);
});

test('AUT-7 lease ownership, release and expiry fail closed', () => {
  const r = new AutomationWorkerRegistry420({ heartbeatTtlMs: 1000, leaseTtlMs: 100, maxWorkers: 4, maxActiveLeases: 4 });
  r.register(worker);
  const lease = r.acquireLease({ jobId: 'job.alpha', occurrenceId: occurrence, workerId: worker.workerId, nowMs: 1000 });
  assert.throws(() => r.releaseLease(lease.leaseId, 'worker.beta', 1010), /AUT7_LEASE_OWNER_MISMATCH/);
  assert.equal(r.releaseLease(lease.leaseId, worker.workerId, 1010), true);
  assert.equal(r.releaseLease(lease.leaseId, worker.workerId, 1011), false);
  const lease2 = r.acquireLease({ jobId: 'job.alpha', occurrenceId: occurrence, workerId: worker.workerId, nowMs: 1020 });
  assert.equal(r.getLeaseForOccurrence(occurrence, lease2.expiresAtMs), null);
});

test('AUT-7 stale, draining, disabled and malformed workers cannot acquire work', () => {
  const r = new AutomationWorkerRegistry420({ heartbeatTtlMs: 10, leaseTtlMs: 100, maxWorkers: 4, maxActiveLeases: 4 });
  r.register(worker);
  assert.throws(() => r.acquireLease({ jobId: 'job.alpha', occurrenceId: occurrence, workerId: worker.workerId, nowMs: 1011 }), /AUT7_WORKER_NOT_LIVE/);
  r.heartbeat(worker.workerId, 1020);
  r.setStatus(worker.workerId, 'draining');
  assert.throws(() => r.acquireLease({ jobId: 'job.alpha', occurrenceId: occurrence, workerId: worker.workerId, nowMs: 1020 }), /AUT7_WORKER_NOT_LIVE/);
  r.setStatus(worker.workerId, 'disabled');
  assert.throws(() => r.heartbeat(worker.workerId, 1030), /AUT7_WORKER_DISABLED/);
  assert.throws(() => r.register({ ...worker, workerId: 'bad', address: '0x123' }), /AUT7_WORKER_ADDRESS_INVALID/);
});

test('AUT-7 enforces worker and lease cardinality caps', () => {
  const r = new AutomationWorkerRegistry420({ heartbeatTtlMs: 1000, leaseTtlMs: 1000, maxWorkers: 1, maxActiveLeases: 1 });
  r.register(worker);
  assert.throws(() => r.register({ ...worker, workerId: 'worker.beta', address: '0x2222222222222222222222222222222222222222' }), /AUT7_WORKER_CAP_EXCEEDED/);
  r.acquireLease({ jobId: 'job.alpha', occurrenceId: occurrence, workerId: worker.workerId, nowMs: 1000 });
  assert.throws(() => r.acquireLease({ jobId: 'job.beta', occurrenceId: `0x${'bb'.repeat(32)}`, workerId: worker.workerId, nowMs: 1000 }), /AUT7_LEASE_CAP_EXCEEDED/);
});
