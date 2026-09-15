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
    maxSponsorWindowWei: positiveBigInt420(input.maxSponsorWindowWei ?? '50000000000000000000', 'GAS9_SPONSOR_WINDOW_LIMIT_INVALID'),
    maxAccountOperationsPerWindow: input.maxAccountOperationsPerWindow ?? 100,
    maxPolicyOperationsPerWindow: input.maxPolicyOperationsPerWindow ?? 500,
    maxSponsorOperationsPerWindow: input.maxSponsorOperationsPerWindow ?? 2_000,
    maxConcurrentPerAccount: input.maxConcurrentPerAccount ?? 10,
    maxConcurrentSponsor: input.maxConcurrentSponsor ?? 1_000,
    maxTrackedAuthorizations: input.maxTrackedAuthorizations ?? 10_000,
    maxReservationAgeMs: input.maxReservationAgeMs ?? 300_000,
  };
  positiveInt420(policy.windowMs, 'GAS9_WINDOW_INVALID', 86_400_000);
  positiveInt420(policy.maxAccountOperationsPerWindow, 'GAS9_ACCOUNT_OPS_LIMIT_INVALID', 100_000);
  positiveInt420(policy.maxPolicyOperationsPerWindow, 'GAS9_POLICY_OPS_LIMIT_INVALID', 1_000_000);
  positiveInt420(policy.maxSponsorOperationsPerWindow, 'GAS9_SPONSOR_OPS_LIMIT_INVALID', 10_000_000);
  positiveInt420(policy.maxConcurrentPerAccount, 'GAS9_CONCURRENCY_LIMIT_INVALID', 10_000);
  positiveInt420(policy.maxConcurrentSponsor, 'GAS9_SPONSOR_CONCURRENCY_LIMIT_INVALID', 1_000_000);
  positiveInt420(policy.maxTrackedAuthorizations, 'GAS9_TRACKED_AUTHORIZATIONS_LIMIT_INVALID', 1_000_000);
  positiveInt420(policy.maxReservationAgeMs, 'GAS9_RESERVATION_AGE_INVALID', 3_600_000);
  return Object.freeze(policy);
}

export class GasQuotaController420 {
  constructor(policy = {}) {
    this.policy = validateGasQuotaPolicy420(policy);
    this.windows = new Map();
    this.active = new Map();
    this.nextReservationId = 1;
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

  _reservationId() {
    if (!Number.isSafeInteger(this.nextReservationId) || this.nextReservationId < 1) fail420('GAS9_RESERVATION_ID_EXHAUSTED');
    const id = this.nextReservationId;
    this.nextReservationId += 1;
    return id;
  }

  _exactReservation(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail420('GAS9_RESERVATION_HANDLE_INVALID');
    const authorizationKey = key420(input.authorizationId, 'GAS9_AUTHORIZATION_INVALID');
    const reservationId = positiveInt420(input.reservationId, 'GAS9_RESERVATION_ID_INVALID');
    const current = this.active.get(authorizationKey);
    if (!current || current.reservationId !== reservationId) return null;
    return current;
  }

  reapExpired(nowMs) {
    this._windowId(nowMs);
    let released = 0;
    for (const [authorizationId, reservation] of this.active.entries()) {
      if (reservation.expiresAtMs <= nowMs) {
        this.active.delete(authorizationId);
        released += 1;
      }
    }
    return released;
  }

  reserve({ account, policyId, authorizationId, maxSponsoredCostWei, nowMs, expiresAtMs }) {
    const accountKey = key420(account, 'GAS9_ACCOUNT_INVALID');
    const policyKey = key420(policyId, 'GAS9_POLICY_INVALID');
    const authorizationKey = key420(authorizationId, 'GAS9_AUTHORIZATION_INVALID');
    const cost = positiveBigInt420(maxSponsoredCostWei, 'GAS9_OPERATION_COST_INVALID');
    this._windowId(nowMs);
    const expiry = expiresAtMs ?? nowMs + this.policy.maxReservationAgeMs;
    if (!Number.isSafeInteger(expiry) || expiry <= nowMs || expiry - nowMs > this.policy.maxReservationAgeMs) fail420('GAS9_RESERVATION_EXPIRY_INVALID');

    this.reapExpired(nowMs);
    if (cost > this.policy.maxSponsoredCostPerOperationWei) fail420('GAS9_OPERATION_COST_EXCEEDED');
    if (this.active.has(authorizationKey)) fail420('GAS9_DUPLICATE_AUTHORIZATION');
    if (this.active.size >= this.policy.maxTrackedAuthorizations) fail420('GAS9_STATE_CAPACITY_EXCEEDED');
    if (this.active.size >= this.policy.maxConcurrentSponsor) fail420('GAS9_SPONSOR_CONCURRENCY_EXCEEDED');

    const accountWindowKey = `account:${accountKey}`;
    const policyWindowKey = `policy:${policyKey}`;
    const sponsorWindowKey = 'sponsor:global';
    const accountWindow = this._window(accountWindowKey, nowMs);
    const policyWindow = this._window(policyWindowKey, nowMs);
    const sponsorWindow = this._window(sponsorWindowKey, nowMs);
    if (accountWindow.operations >= this.policy.maxAccountOperationsPerWindow) fail420('GAS9_ACCOUNT_OPERATION_QUOTA_EXCEEDED');
    if (policyWindow.operations >= this.policy.maxPolicyOperationsPerWindow) fail420('GAS9_POLICY_OPERATION_QUOTA_EXCEEDED');
    if (sponsorWindow.operations >= this.policy.maxSponsorOperationsPerWindow) fail420('GAS9_SPONSOR_OPERATION_QUOTA_EXCEEDED');
    if (accountWindow.sponsoredWei + cost > this.policy.maxAccountWindowWei) fail420('GAS9_ACCOUNT_SPEND_QUOTA_EXCEEDED');
    if (policyWindow.sponsoredWei + cost > this.policy.maxPolicyWindowWei) fail420('GAS9_POLICY_SPEND_QUOTA_EXCEEDED');
    if (sponsorWindow.sponsoredWei + cost > this.policy.maxSponsorWindowWei) fail420('GAS9_SPONSOR_SPEND_QUOTA_EXCEEDED');

    let concurrent = 0;
    for (const reservation of this.active.values()) if (reservation.account === accountKey) concurrent += 1;
    if (concurrent >= this.policy.maxConcurrentPerAccount) fail420('GAS9_ACCOUNT_CONCURRENCY_EXCEEDED');

    accountWindow.operations += 1;
    accountWindow.sponsoredWei += cost;
    policyWindow.operations += 1;
    policyWindow.sponsoredWei += cost;
    sponsorWindow.operations += 1;
    sponsorWindow.sponsoredWei += cost;
    const reservationId = this._reservationId();
    const record = Object.freeze({
      account: accountKey,
      policyId: policyKey,
      authorizationId: authorizationKey,
      reservationId,
      reservedWei: cost,
      windowId: this._windowId(nowMs),
      expiresAtMs: expiry,
      accountWindowKey,
      policyWindowKey,
      sponsorWindowKey,
    });
    this.active.set(authorizationKey, record);
    return Object.freeze({
      account: accountKey,
      policyId: policyKey,
      authorizationId: authorizationKey,
      reservationId,
      reservedWei: cost,
      windowId: record.windowId,
      expiresAtMs: expiry,
    });
  }

  release(handle) {
    const reservation = this._exactReservation(handle);
    if (!reservation) return false;
    this.active.delete(reservation.authorizationId);
    return true;
  }

  rollback(handle) {
    const reservation = this._exactReservation(handle);
    if (!reservation) return false;
    this.active.delete(reservation.authorizationId);
    const accountWindow = this.windows.get(reservation.accountWindowKey);
    const policyWindow = this.windows.get(reservation.policyWindowKey);
    const sponsorWindow = this.windows.get(reservation.sponsorWindowKey);
    for (const window of [accountWindow, policyWindow, sponsorWindow]) {
      if (!window || window.id !== reservation.windowId) continue;
      if (window.operations < 1 || window.sponsoredWei < reservation.reservedWei) fail420('GAS9_ROLLBACK_INVARIANT');
      window.operations -= 1;
      window.sponsoredWei -= reservation.reservedWei;
    }
    return true;
  }

  snapshot({ account, policyId, nowMs }) {
    const accountKey = key420(account, 'GAS9_ACCOUNT_INVALID');
    const policyKey = key420(policyId, 'GAS9_POLICY_INVALID');
    this.reapExpired(nowMs);
    const accountWindow = this._window(`account:${accountKey}`, nowMs);
    const policyWindow = this._window(`policy:${policyKey}`, nowMs);
    const sponsorWindow = this._window('sponsor:global', nowMs);
    let concurrent = 0;
    for (const reservation of this.active.values()) if (reservation.account === accountKey) concurrent += 1;
    return Object.freeze({
      windowId: this._windowId(nowMs),
      accountOperations: accountWindow.operations,
      accountSponsoredWei: accountWindow.sponsoredWei,
      policyOperations: policyWindow.operations,
      policySponsoredWei: policyWindow.sponsoredWei,
      sponsorOperations: sponsorWindow.operations,
      sponsorSponsoredWei: sponsorWindow.sponsoredWei,
      accountConcurrent: concurrent,
      sponsorConcurrent: this.active.size,
      trackedAuthorizations: this.active.size,
    });
  }
}
