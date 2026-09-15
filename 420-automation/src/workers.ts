import { createHash } from 'node:crypto';

export type AutomationWorkerStatus420 = 'active' | 'draining' | 'disabled';

export interface AutomationWorker420 {
  workerId: string;
  address: string;
  status: AutomationWorkerStatus420;
  registeredAtMs: number;
  lastHeartbeatMs: number;
  stakeRef?: string | null;
}

export interface AutomationWorkerPolicy420 {
  heartbeatTtlMs: number;
  leaseTtlMs: number;
  maxWorkers: number;
  maxActiveLeases: number;
}

export interface AutomationWorkerLease420 {
  leaseId: string;
  jobId: string;
  occurrenceId: string;
  workerId: string;
  acquiredAtMs: number;
  expiresAtMs: number;
}

const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;

function cloneWorker(worker: AutomationWorker420): AutomationWorker420 {
  return { ...worker };
}

function cloneLease(lease: AutomationWorkerLease420): AutomationWorkerLease420 {
  return { ...lease };
}

function validatePolicy420(policy: AutomationWorkerPolicy420): void {
  for (const value of [policy.heartbeatTtlMs, policy.leaseTtlMs, policy.maxWorkers, policy.maxActiveLeases]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('AUT7_POLICY_INVALID');
  }
}

function validateWorker420(worker: AutomationWorker420): void {
  if (worker.workerId.length === 0 || worker.workerId.length > 128) throw new Error('AUT7_WORKER_ID_INVALID');
  if (!ADDRESS20.test(worker.address)) throw new Error('AUT7_WORKER_ADDRESS_INVALID');
  if (!['active', 'draining', 'disabled'].includes(worker.status)) throw new Error('AUT7_WORKER_STATUS_INVALID');
  if (!Number.isSafeInteger(worker.registeredAtMs) || !Number.isSafeInteger(worker.lastHeartbeatMs) || worker.registeredAtMs < 0 || worker.lastHeartbeatMs < worker.registeredAtMs) throw new Error('AUT7_WORKER_TIME_INVALID');
  if (worker.stakeRef != null && (worker.stakeRef.length === 0 || worker.stakeRef.length > 256)) throw new Error('AUT7_STAKE_REF_INVALID');
}

function leaseId420(jobId: string, occurrenceId: string, workerId: string, acquiredAtMs: number): string {
  return `0x${createHash('sha256').update(['420Automation/lease/v1', jobId, occurrenceId, workerId, String(acquiredAtMs)].join('|')).digest('hex')}`;
}

export class AutomationWorkerRegistry420 {
  readonly policy: AutomationWorkerPolicy420;
  private readonly workers = new Map<string, AutomationWorker420>();
  private readonly addressToWorker = new Map<string, string>();
  private readonly leases = new Map<string, AutomationWorkerLease420>();
  private readonly occurrenceToLease = new Map<string, string>();

  constructor(policy: AutomationWorkerPolicy420) {
    validatePolicy420(policy);
    this.policy = { ...policy };
  }

  register(input: AutomationWorker420): AutomationWorker420 {
    validateWorker420(input);
    if (this.workers.has(input.workerId)) throw new Error('AUT7_WORKER_ALREADY_REGISTERED');
    if (this.workers.size >= this.policy.maxWorkers) throw new Error('AUT7_WORKER_CAP_EXCEEDED');
    const address = input.address.toLowerCase();
    if (this.addressToWorker.has(address)) throw new Error('AUT7_WORKER_ADDRESS_ALREADY_REGISTERED');
    const worker = { ...input, address };
    this.workers.set(worker.workerId, worker);
    this.addressToWorker.set(address, worker.workerId);
    return cloneWorker(worker);
  }

  getWorker(workerId: string): AutomationWorker420 | null {
    const worker = this.workers.get(workerId);
    return worker ? cloneWorker(worker) : null;
  }

  heartbeat(workerId: string, nowMs: number): AutomationWorker420 {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error('AUT7_WORKER_UNKNOWN');
    if (worker.status === 'disabled') throw new Error('AUT7_WORKER_DISABLED');
    if (!Number.isSafeInteger(nowMs) || nowMs < worker.lastHeartbeatMs) throw new Error('AUT7_HEARTBEAT_TIME_INVALID');
    worker.lastHeartbeatMs = nowMs;
    return cloneWorker(worker);
  }

  setStatus(workerId: string, status: AutomationWorkerStatus420): AutomationWorker420 {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error('AUT7_WORKER_UNKNOWN');
    if (!['active', 'draining', 'disabled'].includes(status)) throw new Error('AUT7_WORKER_STATUS_INVALID');
    worker.status = status;
    return cloneWorker(worker);
  }

  isWorkerLive(workerId: string, nowMs: number): boolean {
    const worker = this.workers.get(workerId);
    if (!worker || worker.status !== 'active') return false;
    if (!Number.isSafeInteger(nowMs) || nowMs < worker.lastHeartbeatMs) return false;
    return nowMs - worker.lastHeartbeatMs <= this.policy.heartbeatTtlMs;
  }

  private sweepExpired(nowMs: number): void {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('AUT7_NOW_INVALID');
    for (const [leaseId, lease] of this.leases) {
      if (lease.expiresAtMs <= nowMs) {
        this.leases.delete(leaseId);
        if (this.occurrenceToLease.get(lease.occurrenceId) === leaseId) this.occurrenceToLease.delete(lease.occurrenceId);
      }
    }
  }

  acquireLease(input: { jobId: string; occurrenceId: string; workerId: string; nowMs: number }): AutomationWorkerLease420 {
    this.sweepExpired(input.nowMs);
    if (input.jobId.length === 0 || input.jobId.length > 256) throw new Error('AUT7_JOB_ID_INVALID');
    if (!HASH32.test(input.occurrenceId)) throw new Error('AUT7_OCCURRENCE_ID_INVALID');
    if (!this.isWorkerLive(input.workerId, input.nowMs)) throw new Error('AUT7_WORKER_NOT_LIVE');
    if (this.occurrenceToLease.has(input.occurrenceId)) throw new Error('AUT7_OCCURRENCE_ALREADY_LEASED');
    if (this.leases.size >= this.policy.maxActiveLeases) throw new Error('AUT7_LEASE_CAP_EXCEEDED');
    const lease: AutomationWorkerLease420 = {
      leaseId: leaseId420(input.jobId, input.occurrenceId.toLowerCase(), input.workerId, input.nowMs),
      jobId: input.jobId,
      occurrenceId: input.occurrenceId.toLowerCase(),
      workerId: input.workerId,
      acquiredAtMs: input.nowMs,
      expiresAtMs: input.nowMs + this.policy.leaseTtlMs,
    };
    this.leases.set(lease.leaseId, lease);
    this.occurrenceToLease.set(lease.occurrenceId, lease.leaseId);
    return cloneLease(lease);
  }

  renewLease(leaseId: string, workerId: string, nowMs: number): AutomationWorkerLease420 {
    this.sweepExpired(nowMs);
    const lease = this.leases.get(leaseId);
    if (!lease) throw new Error('AUT7_LEASE_UNKNOWN');
    if (lease.workerId !== workerId) throw new Error('AUT7_LEASE_OWNER_MISMATCH');
    if (!this.isWorkerLive(workerId, nowMs)) throw new Error('AUT7_WORKER_NOT_LIVE');
    lease.expiresAtMs = nowMs + this.policy.leaseTtlMs;
    return cloneLease(lease);
  }

  releaseLease(leaseId: string, workerId: string, nowMs: number): boolean {
    this.sweepExpired(nowMs);
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    if (lease.workerId !== workerId) throw new Error('AUT7_LEASE_OWNER_MISMATCH');
    this.leases.delete(leaseId);
    if (this.occurrenceToLease.get(lease.occurrenceId) === leaseId) this.occurrenceToLease.delete(lease.occurrenceId);
    return true;
  }

  getLeaseForOccurrence(occurrenceId: string, nowMs: number): AutomationWorkerLease420 | null {
    this.sweepExpired(nowMs);
    const leaseId = this.occurrenceToLease.get(occurrenceId.toLowerCase());
    if (!leaseId) return null;
    const lease = this.leases.get(leaseId);
    return lease ? cloneLease(lease) : null;
  }

  snapshot(nowMs: number): { registeredWorkers: number; liveWorkers: number; activeLeases: number } {
    this.sweepExpired(nowMs);
    let liveWorkers = 0;
    for (const worker of this.workers.values()) if (this.isWorkerLive(worker.workerId, nowMs)) liveWorkers += 1;
    return { registeredWorkers: this.workers.size, liveWorkers, activeLeases: this.leases.size };
  }
}
