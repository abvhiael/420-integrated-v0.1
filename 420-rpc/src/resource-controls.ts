import { validateRpcRequest420, type RpcRequestPolicyDecision420 } from './request-policy.js';

export interface RpcResourcePolicy420 {
  maxSingleRequestBytes: number;
  maxBatchBytes: number;
  maxBatchEntries: number;
  maxBatchCost: number;
  maxConcurrentUnitsPerClient: number;
  maxConcurrentUnitsGlobal: number;
  tokenCapacityPerClient: number;
  tokenRefillPerSecond: number;
  maxTrackedClients: number;
  clientIdleTtlMs: number;
  maxClientKeyLength: number;
}

export const DEFAULT_RPC6_RESOURCE_POLICY_420: RpcResourcePolicy420 = {
  maxSingleRequestBytes: 256 * 1024,
  maxBatchBytes: 1024 * 1024,
  maxBatchEntries: 20,
  maxBatchCost: 100,
  maxConcurrentUnitsPerClient: 20,
  maxConcurrentUnitsGlobal: 256,
  tokenCapacityPerClient: 120,
  tokenRefillPerSecond: 2,
  maxTrackedClients: 10_000,
  clientIdleTtlMs: 15 * 60 * 1000,
  maxClientKeyLength: 128,
};

export type RpcResourceRejection420 =
  | 'invalid-client'
  | 'invalid-request'
  | 'request-too-large'
  | 'batch-too-large'
  | 'batch-too-expensive'
  | 'rate-limited'
  | 'client-concurrency-exhausted'
  | 'global-concurrency-exhausted'
  | 'client-table-exhausted';

export interface RpcAdmissionInput420 {
  clientKey: string;
  envelope: unknown;
  encodedBytes: number;
  nowMs: number;
}

export interface RpcAdmissionDecision420 {
  allowed: boolean;
  leaseId: string | null;
  reason: RpcResourceRejection420 | null;
  detail: string | null;
  cost: number;
  concurrencyUnits: number;
  retryAfterMs: number | null;
  validated: readonly RpcRequestPolicyDecision420[];
}

interface ClientState420 {
  tokens: number;
  lastRefillMs: number;
  lastSeenMs: number;
  concurrentUnits: number;
}

interface Lease420 {
  clientKey: string;
  units: number;
}

const METHOD_COSTS: Readonly<Record<string, number>> = {
  web3_clientVersion: 1,
  net_version: 1,
  eth_chainId: 1,
  eth_syncing: 1,
  eth_blockNumber: 1,
  eth_gasPrice: 1,
  eth_maxPriorityFeePerGas: 1,
  eth_getBalance: 2,
  eth_getCode: 2,
  eth_getStorageAt: 3,
  eth_getTransactionCount: 2,
  eth_getBlockByHash: 3,
  eth_getBlockByNumber: 3,
  eth_getBlockTransactionCountByHash: 2,
  eth_getBlockTransactionCountByNumber: 2,
  eth_getTransactionByHash: 2,
  eth_getTransactionByBlockHashAndIndex: 2,
  eth_getTransactionByBlockNumberAndIndex: 2,
  eth_getTransactionReceipt: 2,
  eth_getLogs: 8,
  eth_call: 6,
  eth_estimateGas: 6,
  eth_feeHistory: 4,
  eth_sendRawTransaction: 10,
  eth_subscribe: 4,
  eth_unsubscribe: 1,
};

function reject(reason: RpcResourceRejection420, detail: string, cost = 0, units = 0, retryAfterMs: number | null = null, validated: readonly RpcRequestPolicyDecision420[] = []): RpcAdmissionDecision420 {
  return { allowed: false, leaseId: null, reason, detail, cost, concurrencyUnits: units, retryAfterMs, validated };
}

function validatePolicy(policy: RpcResourcePolicy420): void {
  const positiveIntegerFields: Array<keyof RpcResourcePolicy420> = [
    'maxSingleRequestBytes', 'maxBatchBytes', 'maxBatchEntries', 'maxBatchCost',
    'maxConcurrentUnitsPerClient', 'maxConcurrentUnitsGlobal', 'tokenCapacityPerClient',
    'maxTrackedClients', 'clientIdleTtlMs', 'maxClientKeyLength',
  ];
  for (const key of positiveIntegerFields) {
    const value = policy[key];
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isFinite(policy.tokenRefillPerSecond) || policy.tokenRefillPerSecond <= 0) throw new Error('tokenRefillPerSecond must be positive');
  if (policy.maxSingleRequestBytes > policy.maxBatchBytes) throw new Error('maxSingleRequestBytes must not exceed maxBatchBytes');
  if (policy.maxConcurrentUnitsPerClient > policy.maxConcurrentUnitsGlobal) throw new Error('per-client concurrency must not exceed global concurrency');
}

function methodCost(decision: RpcRequestPolicyDecision420): number {
  if (!decision.allowed || decision.method === null) return 0;
  return METHOD_COSTS[decision.method] ?? 5;
}

function validateEnvelope(envelope: unknown): RpcRequestPolicyDecision420[] {
  if (Array.isArray(envelope)) return envelope.map((entry) => validateRpcRequest420(entry));
  return [validateRpcRequest420(envelope)];
}

export function rpcMethodCost420(method: string): number {
  return METHOD_COSTS[method] ?? 5;
}

export class RpcAdmissionController420 {
  private readonly clients = new Map<string, ClientState420>();
  private readonly leases = new Map<string, Lease420>();
  private globalConcurrentUnits = 0;
  private nextLease = 1;

  constructor(readonly policy: RpcResourcePolicy420 = DEFAULT_RPC6_RESOURCE_POLICY_420) {
    validatePolicy(policy);
  }

  admit(input: RpcAdmissionInput420): RpcAdmissionDecision420 {
    const { clientKey, envelope, encodedBytes, nowMs } = input;
    if (typeof clientKey !== 'string' || clientKey.length === 0 || clientKey.length > this.policy.maxClientKeyLength) return reject('invalid-client', 'clientKey must be non-empty and within the configured length bound');
    if (!Number.isInteger(encodedBytes) || encodedBytes < 0) return reject('invalid-request', 'encodedBytes must be a non-negative integer');
    if (!Number.isFinite(nowMs) || nowMs < 0) return reject('invalid-request', 'nowMs must be a non-negative finite number');

    const batch = Array.isArray(envelope);
    const entries = batch ? envelope.length : 1;
    if (batch && entries === 0) return reject('invalid-request', 'batch request must not be empty');
    if (batch && entries > this.policy.maxBatchEntries) return reject('batch-too-large', `batch contains ${entries} entries; limit is ${this.policy.maxBatchEntries}`);
    const byteLimit = batch ? this.policy.maxBatchBytes : this.policy.maxSingleRequestBytes;
    if (encodedBytes > byteLimit) return reject(batch ? 'batch-too-large' : 'request-too-large', `encoded request is ${encodedBytes} bytes; limit is ${byteLimit}`);

    const validated = validateEnvelope(envelope);
    const invalid = validated.find((decision) => !decision.allowed);
    if (invalid) return reject('invalid-request', invalid.reason ?? 'request failed RPC-5 policy', 0, 0, null, validated);

    const cost = validated.reduce((sum, decision) => sum + methodCost(decision), 0);
    const units = validated.length;
    if (batch && cost > this.policy.maxBatchCost) return reject('batch-too-expensive', `batch cost ${cost} exceeds limit ${this.policy.maxBatchCost}`, cost, units, null, validated);

    this.sweepIdleClients(nowMs);
    let state = this.clients.get(clientKey);
    if (!state) {
      if (this.clients.size >= this.policy.maxTrackedClients) return reject('client-table-exhausted', 'tracked client table is full', cost, units, null, validated);
      state = { tokens: this.policy.tokenCapacityPerClient, lastRefillMs: nowMs, lastSeenMs: nowMs, concurrentUnits: 0 };
      this.clients.set(clientKey, state);
    }
    this.refill(state, nowMs);
    state.lastSeenMs = nowMs;

    if (state.concurrentUnits + units > this.policy.maxConcurrentUnitsPerClient) return reject('client-concurrency-exhausted', 'per-client concurrency limit exceeded', cost, units, null, validated);
    if (this.globalConcurrentUnits + units > this.policy.maxConcurrentUnitsGlobal) return reject('global-concurrency-exhausted', 'global concurrency limit exceeded', cost, units, null, validated);
    if (state.tokens < cost) {
      const deficit = cost - state.tokens;
      const retryAfterMs = Math.ceil((deficit / this.policy.tokenRefillPerSecond) * 1000);
      return reject('rate-limited', 'client token budget exhausted', cost, units, retryAfterMs, validated);
    }

    state.tokens -= cost;
    state.concurrentUnits += units;
    this.globalConcurrentUnits += units;
    const leaseId = `rpc6-${this.nextLease++}`;
    this.leases.set(leaseId, { clientKey, units });
    return { allowed: true, leaseId, reason: null, detail: null, cost, concurrencyUnits: units, retryAfterMs: null, validated };
  }

  release(leaseId: string, nowMs?: number): boolean {
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    this.leases.delete(leaseId);
    const state = this.clients.get(lease.clientKey);
    if (state) {
      state.concurrentUnits = Math.max(0, state.concurrentUnits - lease.units);
      if (nowMs !== undefined && Number.isFinite(nowMs) && nowMs >= 0) state.lastSeenMs = nowMs;
    }
    this.globalConcurrentUnits = Math.max(0, this.globalConcurrentUnits - lease.units);
    return true;
  }

  snapshot(clientKey?: string): { trackedClients: number; activeLeases: number; globalConcurrentUnits: number; client?: { tokens: number; concurrentUnits: number } } {
    const state = clientKey === undefined ? undefined : this.clients.get(clientKey);
    return {
      trackedClients: this.clients.size,
      activeLeases: this.leases.size,
      globalConcurrentUnits: this.globalConcurrentUnits,
      ...(state ? { client: { tokens: state.tokens, concurrentUnits: state.concurrentUnits } } : {}),
    };
  }

  private refill(state: ClientState420, nowMs: number): void {
    if (nowMs <= state.lastRefillMs) return;
    const elapsedSeconds = (nowMs - state.lastRefillMs) / 1000;
    state.tokens = Math.min(this.policy.tokenCapacityPerClient, state.tokens + elapsedSeconds * this.policy.tokenRefillPerSecond);
    state.lastRefillMs = nowMs;
  }

  private sweepIdleClients(nowMs: number): void {
    for (const [key, state] of this.clients) {
      if (state.concurrentUnits === 0 && nowMs - state.lastSeenMs >= this.policy.clientIdleTtlMs) this.clients.delete(key);
    }
  }
}
