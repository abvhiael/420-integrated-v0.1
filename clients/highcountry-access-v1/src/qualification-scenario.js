import { FeatureClass, PromptKind, evaluateFeatureAccess } from "./access-state.js";

export const QualificationEvent = Object.freeze({
  REGISTER: "register",
  LINK_WALLET: "link-wallet",
  CONNECT_WALLET: "connect-wallet",
  DISCONNECT_WALLET: "disconnect-wallet",
  MIGRATION_CONSUMED: "migration-consumed",
  MIGRATION_BOUND: "migration-bound",
  MIGRATION_APPLIED: "migration-applied",
  ENTITLEMENT_ACTIVE: "entitlement-active",
  SESSION_ACTIVE: "session-active",
  SESSION_REVOKED: "session-revoked",
  ATTESTATION_ACTIVE: "attestation-active"
});

export function createQualificationState() {
  return {
    registered: false,
    walletLinked: false,
    walletConnected: false,
    migrationConsumed: false,
    migrationBound: false,
    migrationApplied: false,
    entitlementActive: false,
    sessionActive: false,
    attestationActive: false,
    ordinaryProgress: 0
  };
}

export function applyQualificationEvent(state, event) {
  const next = { ...state };
  switch (event) {
    case QualificationEvent.REGISTER:
      next.registered = true;
      return next;
    case QualificationEvent.LINK_WALLET:
      next.walletLinked = true;
      return next;
    case QualificationEvent.CONNECT_WALLET:
      if (!next.walletLinked) throw new Error("wallet-must-be-linked-before-connect");
      next.walletConnected = true;
      return next;
    case QualificationEvent.DISCONNECT_WALLET:
      next.walletConnected = false;
      return next;
    case QualificationEvent.MIGRATION_CONSUMED:
      if (!next.walletLinked || !next.walletConnected) throw new Error("migration-consume-requires-connected-wallet");
      next.migrationConsumed = true;
      return next;
    case QualificationEvent.MIGRATION_BOUND:
      if (!next.migrationConsumed) throw new Error("migration-bind-requires-consumed-claim");
      next.migrationBound = true;
      return next;
    case QualificationEvent.MIGRATION_APPLIED:
      if (!next.migrationBound) throw new Error("migration-apply-requires-bound-claim");
      if (next.migrationApplied) throw new Error("migration-application-replay");
      next.migrationApplied = true;
      return next;
    case QualificationEvent.ENTITLEMENT_ACTIVE:
      if (!next.walletLinked) throw new Error("entitlement-requires-linked-wallet");
      next.entitlementActive = true;
      return next;
    case QualificationEvent.SESSION_ACTIVE:
      if (!next.walletConnected) throw new Error("session-requires-connected-wallet");
      next.sessionActive = true;
      return next;
    case QualificationEvent.SESSION_REVOKED:
      next.sessionActive = false;
      return next;
    case QualificationEvent.ATTESTATION_ACTIVE:
      if (!next.walletLinked) throw new Error("attestation-requires-linked-wallet");
      next.attestationActive = true;
      return next;
    default:
      throw new TypeError(`Unsupported qualification event: ${event}`);
  }
}

export function advanceOrdinaryProgress(state, amount = 1) {
  if (!Number.isInteger(amount) || amount < 0) throw new TypeError("progress amount must be a non-negative integer");
  return { ...state, ordinaryProgress: state.ordinaryProgress + amount };
}

export function qualifyFeature(state, feature) {
  return evaluateFeatureAccess({
    feature,
    registered: state.registered,
    walletLinked: state.walletLinked,
    walletConnected: state.walletConnected
  });
}

export function qualifyOptionalEntitlement(state) {
  const access = qualifyFeature(state, FeatureClass.OPTIONAL_CONTENT);
  return {
    ...access,
    allowed: access.allowed && state.entitlementActive,
    reason: access.allowed && !state.entitlementActive ? "active-entitlement-required" : access.reason
  };
}

export function qualifyRoutineSession(state) {
  if (!state.walletLinked || !state.walletConnected) {
    return { allowed: false, prompt: state.walletLinked ? PromptKind.CONNECT_WALLET : PromptKind.LINK_WALLET };
  }
  if (!state.sessionActive) return { allowed: false, prompt: PromptKind.NONE, reason: "wallet-escalation-required" };
  return { allowed: true, prompt: PromptKind.NONE, reason: "routine-session-authorized" };
}

export function qualifyCrossGameAttestation(state) {
  const access = qualifyFeature(state, FeatureClass.CROSS_GAME);
  return {
    ...access,
    allowed: access.allowed && state.attestationActive,
    reason: access.allowed && !state.attestationActive ? "specific-active-attestation-required" : access.reason
  };
}
