import { RpcAdmissionController420, type RpcAdmissionDecision420 } from './resource-controls.js';
import { validateRpcRequest420, type JsonRpcRequest420 } from './request-policy.js';

export type RpcWebSocketSessionState420 = 'open' | 'closed';
export type RpcSubscriptionState420 = 'pending' | 'active' | 'invalidated';
export type RpcSubscriptionKind420 = 'newHeads' | 'logs' | 'newPendingTransactions' | 'syncing';

export interface RpcWebSocketPolicy420 {
  maxSessions: number;
  maxSubscriptionsPerSession: number;
  maxSubscriptionsGlobal: number;
  maxQueuedMessagesPerSession: number;
  maxQueuedBytesPerSession: number;
  maxEventBytes: number;
  sessionIdleTtlMs: number;
  heartbeatTimeoutMs: number;
  maxSessionIdLength: number;
}

export const DEFAULT_RPC7_WEBSOCKET_POLICY_420: RpcWebSocketPolicy420 = {
  maxSessions: 10_000,
  maxSubscriptionsPerSession: 64,
  maxSubscriptionsGlobal: 50_000,
  maxQueuedMessagesPerSession: 256,
  maxQueuedBytesPerSession: 2 * 1024 * 1024,
  maxEventBytes: 256 * 1024,
  sessionIdleTtlMs: 10 * 60 * 1000,
  heartbeatTimeoutMs: 90 * 1000,
  maxSessionIdLength: 128,
};

export interface RpcSubscription420 {
  id: string;
  sessionId: string;
  kind: RpcSubscriptionKind420;
  params: readonly unknown[];
  state: RpcSubscriptionState420;
  upstreamId: string | null;
  upstreamSubscriptionId: string | null;
  createdAtMs: number;
}

export interface RpcQueuedSubscriptionEvent420 {
  subscription: string;
  result: unknown;
  encodedBytes: number;
}

interface RpcWebSocketSession420 {
  id: string;
  clientKey: string;
  state: RpcWebSocketSessionState420;
  openedAtMs: number;
  lastActivityMs: number;
  lastHeartbeatMs: number;
  subscriptions: Set<string>;
  queue: RpcQueuedSubscriptionEvent420[];
  queuedBytes: number;
  closeReason: string | null;
}

export interface RpcSessionOpenDecision420 {
  opened: boolean;
  reason: string | null;
}

export interface RpcSubscriptionPrepareDecision420 {
  allowed: boolean;
  subscription: RpcSubscription420 | null;
  admission: RpcAdmissionDecision420 | null;
  reason: string | null;
}

export interface RpcSubscriptionUnsubscribeDecision420 {
  allowed: boolean;
  subscription: RpcSubscription420 | null;
  reason: string | null;
}

export interface RpcSubscriptionDeliveryDecision420 {
  delivered: boolean;
  closedSession: boolean;
  reason: string | null;
}

function validatePolicy(policy: RpcWebSocketPolicy420): void {
  for (const [key, value] of Object.entries(policy)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer`);
  }
  if (policy.maxSubscriptionsPerSession > policy.maxSubscriptionsGlobal) throw new Error('per-session subscription limit must not exceed global subscription limit');
  if (policy.maxEventBytes > policy.maxQueuedBytesPerSession) throw new Error('maxEventBytes must not exceed maxQueuedBytesPerSession');
  if (policy.heartbeatTimeoutMs > policy.sessionIdleTtlMs) throw new Error('heartbeatTimeoutMs must not exceed sessionIdleTtlMs');
}

function subscriptionKind(request: JsonRpcRequest420): RpcSubscriptionKind420 | null {
  if (request.method !== 'eth_subscribe' || !Array.isArray(request.params)) return null;
  const kind = request.params[0];
  return kind === 'newHeads' || kind === 'logs' || kind === 'newPendingTransactions' || kind === 'syncing' ? kind : null;
}

export class RpcWebSocketLifecycle420 {
  private readonly sessions = new Map<string, RpcWebSocketSession420>();
  private readonly subscriptions = new Map<string, RpcSubscription420>();
  private readonly byUpstreamSubscription = new Map<string, string>();
  private nextSubscription = 1;

  constructor(
    readonly admission: RpcAdmissionController420,
    readonly policy: RpcWebSocketPolicy420 = DEFAULT_RPC7_WEBSOCKET_POLICY_420,
  ) {
    validatePolicy(policy);
  }

  openSession(sessionId: string, clientKey: string, nowMs: number): RpcSessionOpenDecision420 {
    if (!sessionId || sessionId.length > this.policy.maxSessionIdLength) return { opened: false, reason: 'invalid session id' };
    if (!clientKey) return { opened: false, reason: 'client key must be non-empty' };
    if (!Number.isFinite(nowMs) || nowMs < 0) return { opened: false, reason: 'invalid session timestamp' };
    if (this.sessions.has(sessionId)) return { opened: false, reason: 'session id already exists' };
    if (this.sessions.size >= this.policy.maxSessions) return { opened: false, reason: 'websocket session capacity exhausted' };
    this.sessions.set(sessionId, {
      id: sessionId,
      clientKey,
      state: 'open',
      openedAtMs: nowMs,
      lastActivityMs: nowMs,
      lastHeartbeatMs: nowMs,
      subscriptions: new Set(),
      queue: [],
      queuedBytes: 0,
      closeReason: null,
    });
    return { opened: true, reason: null };
  }

  prepareSubscribe(sessionId: string, request: unknown, encodedBytes: number, nowMs: number): RpcSubscriptionPrepareDecision420 {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'open') return { allowed: false, subscription: null, admission: null, reason: 'websocket session is not open' };
    const validated = validateRpcRequest420(request);
    if (!validated.allowed || validated.request === null || validated.method !== 'eth_subscribe') {
      return { allowed: false, subscription: null, admission: null, reason: validated.reason ?? 'request is not an allowed eth_subscribe request' };
    }
    if (session.subscriptions.size >= this.policy.maxSubscriptionsPerSession) return { allowed: false, subscription: null, admission: null, reason: 'per-session subscription limit exceeded' };
    if (this.subscriptions.size >= this.policy.maxSubscriptionsGlobal) return { allowed: false, subscription: null, admission: null, reason: 'global subscription limit exceeded' };

    const admission = this.admission.admit({ clientKey: session.clientKey, envelope: request, encodedBytes, nowMs });
    if (!admission.allowed || admission.leaseId === null) return { allowed: false, subscription: null, admission, reason: admission.detail ?? admission.reason ?? 'subscription admission rejected' };
    this.admission.release(admission.leaseId, nowMs);

    const kind = subscriptionKind(validated.request);
    if (kind === null) return { allowed: false, subscription: null, admission, reason: 'unsupported subscription kind' };
    const id = `rpc7-sub-${this.nextSubscription++}`;
    const subscription: RpcSubscription420 = {
      id,
      sessionId,
      kind,
      params: Array.isArray(validated.request.params) ? [...validated.request.params] : [],
      state: 'pending',
      upstreamId: null,
      upstreamSubscriptionId: null,
      createdAtMs: nowMs,
    };
    this.subscriptions.set(id, subscription);
    session.subscriptions.add(id);
    session.lastActivityMs = nowMs;
    return { allowed: true, subscription: { ...subscription, params: [...subscription.params] }, admission, reason: null };
  }

  bindSubscription(localSubscriptionId: string, upstreamId: string, upstreamSubscriptionId: string, nowMs: number): boolean {
    const subscription = this.subscriptions.get(localSubscriptionId);
    if (!subscription || subscription.state !== 'pending' || !upstreamId || !upstreamSubscriptionId) return false;
    const key = this.upstreamKey(upstreamId, upstreamSubscriptionId);
    if (this.byUpstreamSubscription.has(key)) return false;
    subscription.state = 'active';
    subscription.upstreamId = upstreamId;
    subscription.upstreamSubscriptionId = upstreamSubscriptionId;
    this.byUpstreamSubscription.set(key, localSubscriptionId);
    const session = this.sessions.get(subscription.sessionId);
    if (session) session.lastActivityMs = nowMs;
    return true;
  }

  prepareUnsubscribe(sessionId: string, localSubscriptionId: string, nowMs: number): RpcSubscriptionUnsubscribeDecision420 {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'open') return { allowed: false, subscription: null, reason: 'websocket session is not open' };
    const subscription = this.subscriptions.get(localSubscriptionId);
    if (!subscription || subscription.sessionId !== sessionId) return { allowed: false, subscription: null, reason: 'subscription does not belong to this session' };
    session.lastActivityMs = nowMs;
    return { allowed: true, subscription: { ...subscription, params: [...subscription.params] }, reason: null };
  }

  completeUnsubscribe(localSubscriptionId: string, nowMs: number): boolean {
    const subscription = this.subscriptions.get(localSubscriptionId);
    if (!subscription) return false;
    this.detachSubscription(subscription);
    const session = this.sessions.get(subscription.sessionId);
    if (session) session.lastActivityMs = nowMs;
    return true;
  }

  deliver(upstreamId: string, upstreamSubscriptionId: string, result: unknown, encodedBytes: number, nowMs: number): RpcSubscriptionDeliveryDecision420 {
    if (!Number.isInteger(encodedBytes) || encodedBytes < 0 || encodedBytes > this.policy.maxEventBytes) return { delivered: false, closedSession: false, reason: 'subscription event exceeds configured event-size bound' };
    const localId = this.byUpstreamSubscription.get(this.upstreamKey(upstreamId, upstreamSubscriptionId));
    if (!localId) return { delivered: false, closedSession: false, reason: 'unknown upstream subscription' };
    const subscription = this.subscriptions.get(localId);
    if (!subscription || subscription.state !== 'active') return { delivered: false, closedSession: false, reason: 'subscription is not active' };
    const session = this.sessions.get(subscription.sessionId);
    if (!session || session.state !== 'open') return { delivered: false, closedSession: false, reason: 'subscription session is not open' };
    if (session.queue.length + 1 > this.policy.maxQueuedMessagesPerSession || session.queuedBytes + encodedBytes > this.policy.maxQueuedBytesPerSession) {
      this.closeSession(session.id, 'subscription backpressure limit exceeded', nowMs);
      return { delivered: false, closedSession: true, reason: 'subscription backpressure limit exceeded' };
    }
    session.queue.push({ subscription: localId, result, encodedBytes });
    session.queuedBytes += encodedBytes;
    session.lastActivityMs = nowMs;
    return { delivered: true, closedSession: false, reason: null };
  }

  drain(sessionId: string, maxMessages = Number.MAX_SAFE_INTEGER): RpcQueuedSubscriptionEvent420[] {
    const session = this.sessions.get(sessionId);
    if (!session || maxMessages <= 0) return [];
    const drained = session.queue.splice(0, maxMessages);
    session.queuedBytes = Math.max(0, session.queuedBytes - drained.reduce((sum, event) => sum + event.encodedBytes, 0));
    return drained;
  }

  heartbeat(sessionId: string, nowMs: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'open' || !Number.isFinite(nowMs) || nowMs < 0) return false;
    session.lastHeartbeatMs = nowMs;
    session.lastActivityMs = nowMs;
    return true;
  }

  invalidateUpstream(upstreamId: string, nowMs: number): string[] {
    const affectedSessions = new Set<string>();
    for (const subscription of [...this.subscriptions.values()]) {
      if (subscription.upstreamId !== upstreamId) continue;
      subscription.state = 'invalidated';
      affectedSessions.add(subscription.sessionId);
      this.detachSubscription(subscription);
    }
    for (const sessionId of affectedSessions) this.closeSession(sessionId, `upstream ${upstreamId} disconnected; resubscription required`, nowMs);
    return [...affectedSessions];
  }

  sweep(nowMs: number): string[] {
    const closed: string[] = [];
    for (const session of [...this.sessions.values()]) {
      if (session.state !== 'open') continue;
      const heartbeatExpired = nowMs - session.lastHeartbeatMs >= this.policy.heartbeatTimeoutMs;
      const idleExpired = nowMs - session.lastActivityMs >= this.policy.sessionIdleTtlMs;
      if (heartbeatExpired || idleExpired) {
        this.closeSession(session.id, heartbeatExpired ? 'heartbeat timeout' : 'session idle timeout', nowMs);
        closed.push(session.id);
      }
    }
    return closed;
  }

  closeSession(sessionId: string, reason: string, nowMs: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === 'closed') return false;
    session.state = 'closed';
    session.closeReason = reason;
    session.lastActivityMs = nowMs;
    for (const id of [...session.subscriptions]) {
      const subscription = this.subscriptions.get(id);
      if (subscription) this.detachSubscription(subscription);
    }
    session.queue.length = 0;
    session.queuedBytes = 0;
    return true;
  }

  removeClosedSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'closed') return false;
    this.sessions.delete(sessionId);
    return true;
  }

  snapshot(sessionId?: string): {
    sessions: number;
    openSessions: number;
    subscriptions: number;
    activeSubscriptions: number;
    session?: { state: RpcWebSocketSessionState420; subscriptions: number; queuedMessages: number; queuedBytes: number; closeReason: string | null };
  } {
    const session = sessionId === undefined ? undefined : this.sessions.get(sessionId);
    return {
      sessions: this.sessions.size,
      openSessions: [...this.sessions.values()].filter((entry) => entry.state === 'open').length,
      subscriptions: this.subscriptions.size,
      activeSubscriptions: [...this.subscriptions.values()].filter((entry) => entry.state === 'active').length,
      ...(session ? { session: { state: session.state, subscriptions: session.subscriptions.size, queuedMessages: session.queue.length, queuedBytes: session.queuedBytes, closeReason: session.closeReason } } : {}),
    };
  }

  private detachSubscription(subscription: RpcSubscription420): void {
    if (subscription.upstreamId && subscription.upstreamSubscriptionId) this.byUpstreamSubscription.delete(this.upstreamKey(subscription.upstreamId, subscription.upstreamSubscriptionId));
    const session = this.sessions.get(subscription.sessionId);
    if (session) session.subscriptions.delete(subscription.id);
    this.subscriptions.delete(subscription.id);
  }

  private upstreamKey(upstreamId: string, upstreamSubscriptionId: string): string {
    return `${upstreamId}\u0000${upstreamSubscriptionId}`;
  }
}
