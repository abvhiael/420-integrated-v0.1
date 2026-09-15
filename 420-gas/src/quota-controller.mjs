export class GasQuotaError420 extends Error {
  constructor(code) {
    super(code);
    this.name = 'GasQuotaError420';
    this.code = code;
  }
}

function fail420(code) {
  throw new GasQuotaError420(code);
}

function positiveInt420(value, code, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) fail420(code);
  return value;
}

function positiveBigInt420(value, code) {
  const parsed = typeof value === 'bigint' ? value : (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : -1n);
  if (parsed <= 0n) fail420(code);
  return parsed;
}

function key420(value, code) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) fail420(code);
  return value.toLowerCase();
}

export function validateGasQuotaPolicy420(input = {}) {
  const policy = {
    windowMs: input.windowMs ?? 60_000,
    maxSponsoredCostPerOperationWei: positiveBigInt420(input.maxSponsoredCostPerOperationWei ?? '1000000000000000000', 'GAS9_OPERATION_COST_LIMIT_INVALID'),
    maxAccountWindowWei: positiveBigInt420(input.maxAccountWindowWei ?? '5000000000000000000', 'GAS9_ACCOUNT_WINDOW_LIMIT_INVALID'),
    maxPolicyWindowWei: positiveBigInt420(input.maxPolicyWindowWei ?? '10000000000000000000', 'GAS9_POLICY_WINDOW_LIMIT_INVALID'),
    maxAccountOperationsPerWindow: input.maxAccountOperationsPerWindow ?? 100,
    maxPolicyOperationsPerWindow: input.maxPolicyOperationsPerWindow ?? 500,
    maxConcurrentPerAccount: input.maxConcurrentPerAccount ?? 10,
    maxTrackedAuthorizations: input.maxTrackedAuthorizations ?? 10_000,
  };
  positiveInt420(policy.windowMs, 'GAS9_WINDOW_INVALID', 86_400_000);
  positiveInt420(policy.maxAccountOperationsPerWindow, 'GAS9_ACCOUNT_OPS_LIMIT_INVALID', 100_000);
  positiveInt420(policy.maxPolicyOperationsPerWindow, 'GAS9_POLICY_OPS_LIMIT_INVALID', 1_000_000);
  positiveInt420(policy.maxConcurrentPerAccount, 'GAS9_CONCURRENCY_LIMIT_INVALID', 10_000);
  positiveInt420(policy.maxTrackedAuthorizations, 'GAS9_TRACKED_AUTHORIZATIONS_LIMIT_INVALID', 1_000_000);
  return Object.freeze(policy);
}

export class GasQuotaController420 {
  constructor(policy = {}) {
    this.policy = validateGasQuotaPolicy420(policy);
    this.windows = new Map();
    this.active = new Map();
  }

  _windowId(nowMs) {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) fail420('GAS9_TIME_INVALID');
    return Math.floor(nowMs / this.policy.windowMs);
  }

  _window(key, nowMs) {
    const id = this._windowId(nowMs);
    const current = this.windows.get(key);
    if (current && current.id === id) return current;
    const next = { id, operations: 0, sponsoredWei: 0n };
    this.windows.set(key, next);
    return next;
  }

  reserve({ account, policyId, authorizationId, maxSponsoredCostWei, nowMs }) {
    const accountKey = key420(account, 'GAS9_ACCOUNT_INVALID');
    const policyKey = key420(policyId, 'GAS9_POLICY_INVALID');
    const authorizationKey = key420(authorizationId, 'GAS9_AUTHORIZATION_INVALID');
    const cost = positiveBigInt420(maxSponsoredCostWei, 'GAS9_OPERATION_COST_INVALID');
    if (cost > this.policy.maxSponsoredCostPerOperationWei) fail420('GAS9_OPERATION_COST_EXCEEDED');
    if (this.active.has(authorizationKey)) fail420('GAS9_DUPLICATE_AUTHORIZATION');
    if (this.active.size >= this.policy.maxTrackedAuthorizations) fail420('GAS9_STATE_CAPACITY_EXCEEDED');

    const accountWindow = this._window(`account:${accountKey}`, nowMs);
    const policyWindow = this._window(`policy:${policyKey}`, nowMs);
    if (accountWindow.operations >= this.policy.maxAccountOperationsPerWindow) fail420('GAS9_ACCOUNT_OPERATION_QUOTA_EXCEEDED');
    if (policyWindow.operations >= this.policy.maxPolicyOperationsPerWindow) fail420('GAS9_POLICY_OPERATION_QUOTA_EXCEEDED');
    if (accountWindow.sponsoredWei + cost > this.policy.maxAccountWindowWei) fail420('GAS9_ACCOUNT_SPEND_QUOTA_EXCEEDED');
    if (policyWindow.sponsoredWei + cost > this.policy.maxPolicyWindowWei) fail420('GAS9_POLICY_SPEND_QUOTA_EXCEEDED');

    let concurrent = 0;
    for (const reservation of this.active.values()) if (reservation.account === accountKey) concurrent += 1;
    if (concurrent >= this.policy.maxConcurrentPerAccount) fail420('GAS9_ACCOUNT_CONCURRENCY_EXCEEDED');

    accountWindow.operations += 1;
    accountWindow.sponsoredWei += cost;
    policyWindow.operations += 1;
    policyWindow.sponsoredWei += cost;
    const reservation = Object.freeze({ account: accountKey, policyId: policyKey, authorizationId: authorizationKey, reservedWei: cost, windowId: this._windowId(nowMs) });
    this.active.set(authorizationKey, reservation);
    return reservation;
  }

  release(authorizationId) {
    const authorizationKey = key420(authorizationId, 'GAS9_AUTHORIZATION_INVALID');
    return this.active.delete(authorizationKey);
  }

  snapshot({ account, policyId, nowMs }) {
    const accountKey = key420(account, 'GAS9_ACCOUNT_INVALID');
    const policyKey = key420(policyId, 'GAS9_POLICY_INVALID');
    const accountWindow = this._window(`account:${accountKey}`, nowMs);
    const policyWindow = this._window(`policy:${policyKey}`, nowMs);
    let concurrent = 0;
    for (const reservation of this.active.values()) if (reservation.account === accountKey) concurrent += 1;
    return Object.freeze({
      windowId: this._windowId(nowMs),
      accountOperations: accountWindow.operations,
      accountSponsoredWei: accountWindow.sponsoredWei,
      policyOperations: policyWindow.operations,
      policySponsoredWei: policyWindow.sponsoredWei,
      accountConcurrent: concurrent,
      trackedAuthorizations: this.active.size,
    });
  }
}
