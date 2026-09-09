import test from "node:test";
import assert from "node:assert/strict";

import { FeatureClass, PromptKind } from "../src/access-state.js";
import {
  QualificationEvent,
  advanceOrdinaryProgress,
  applyQualificationEvent,
  createQualificationState,
  qualifyCrossGameAttestation,
  qualifyFeature,
  qualifyOptionalEntitlement,
  qualifyRoutineSession
} from "../src/qualification-scenario.js";

test("guest-only core play remains available and wallet-free", () => {
  let state = createQualificationState();
  state = advanceOrdinaryProgress(state, 7);
  const access = qualifyFeature(state, FeatureClass.CORE_GAMEPLAY);
  assert.equal(access.allowed, true);
  assert.equal(access.prompt, PromptKind.NONE);
  assert.equal(state.ordinaryProgress, 7);
});

test("registration unlocks cloud save without requiring a wallet", () => {
  let state = createQualificationState();
  assert.equal(qualifyFeature(state, FeatureClass.CLOUD_SAVE).prompt, PromptKind.REGISTER);
  state = applyQualificationEvent(state, QualificationEvent.REGISTER);
  const access = qualifyFeature(state, FeatureClass.CLOUD_SAVE);
  assert.equal(access.allowed, true);
  assert.equal(access.prompt, PromptKind.NONE);
  assert.equal(state.walletLinked, false);
});

test("wallet-only features prompt contextually rather than during routine play", () => {
  let state = createQualificationState();
  assert.equal(qualifyFeature(state, FeatureClass.CORE_GAMEPLAY).prompt, PromptKind.NONE);
  assert.equal(qualifyFeature(state, FeatureClass.OPTIONAL_CONTENT).prompt, PromptKind.LINK_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.LINK_WALLET);
  assert.equal(qualifyFeature(state, FeatureClass.OPTIONAL_CONTENT).prompt, PromptKind.CONNECT_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.CONNECT_WALLET);
  assert.equal(qualifyFeature(state, FeatureClass.OPTIONAL_CONTENT).prompt, PromptKind.NONE);
});

test("guest migration follows consume -> bind -> apply and rejects replay", () => {
  let state = createQualificationState();
  state = applyQualificationEvent(state, QualificationEvent.LINK_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.CONNECT_WALLET);
  assert.throws(() => applyQualificationEvent(state, QualificationEvent.MIGRATION_BOUND), /consumed-claim/);
  state = applyQualificationEvent(state, QualificationEvent.MIGRATION_CONSUMED);
  state = applyQualificationEvent(state, QualificationEvent.MIGRATION_BOUND);
  state = applyQualificationEvent(state, QualificationEvent.MIGRATION_APPLIED);
  assert.equal(state.migrationApplied, true);
  assert.throws(() => applyQualificationEvent(state, QualificationEvent.MIGRATION_APPLIED), /replay/);
});

test("optional entitlement requires both wallet access and active entitlement", () => {
  let state = createQualificationState();
  assert.equal(qualifyOptionalEntitlement(state).allowed, false);
  state = applyQualificationEvent(state, QualificationEvent.LINK_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.CONNECT_WALLET);
  assert.equal(qualifyOptionalEntitlement(state).allowed, false);
  state = applyQualificationEvent(state, QualificationEvent.ENTITLEMENT_ACTIVE);
  assert.equal(qualifyOptionalEntitlement(state).allowed, true);
});

test("disconnect and reconnect only block wallet-only features", () => {
  let state = createQualificationState();
  state = applyQualificationEvent(state, QualificationEvent.LINK_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.CONNECT_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.DISCONNECT_WALLET);
  assert.equal(qualifyFeature(state, FeatureClass.CORE_GAMEPLAY).allowed, true);
  assert.equal(qualifyFeature(state, FeatureClass.MARKETPLACE).prompt, PromptKind.CONNECT_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.CONNECT_WALLET);
  assert.equal(qualifyFeature(state, FeatureClass.MARKETPLACE).allowed, true);
});

test("revoked routine session escalates without breaking core play", () => {
  let state = createQualificationState();
  state = applyQualificationEvent(state, QualificationEvent.LINK_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.CONNECT_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.SESSION_ACTIVE);
  assert.equal(qualifyRoutineSession(state).allowed, true);
  state = applyQualificationEvent(state, QualificationEvent.SESSION_REVOKED);
  const routine = qualifyRoutineSession(state);
  assert.equal(routine.allowed, false);
  assert.equal(routine.reason, "wallet-escalation-required");
  assert.equal(qualifyFeature(state, FeatureClass.CORE_GAMEPLAY).allowed, true);
});

test("cross-game access requires a specific active attestation", () => {
  let state = createQualificationState();
  state = applyQualificationEvent(state, QualificationEvent.LINK_WALLET);
  state = applyQualificationEvent(state, QualificationEvent.CONNECT_WALLET);
  assert.equal(qualifyCrossGameAttestation(state).allowed, false);
  state = applyQualificationEvent(state, QualificationEvent.ATTESTATION_ACTIVE);
  assert.equal(qualifyCrossGameAttestation(state).allowed, true);
});

test("wallet linkage does not change ordinary progression", () => {
  let guest = createQualificationState();
  let linked = createQualificationState();
  linked = applyQualificationEvent(linked, QualificationEvent.LINK_WALLET);
  linked = applyQualificationEvent(linked, QualificationEvent.CONNECT_WALLET);

  guest = advanceOrdinaryProgress(guest, 42);
  linked = advanceOrdinaryProgress(linked, 42);

  assert.equal(guest.ordinaryProgress, linked.ordinaryProgress);
  assert.equal(guest.ordinaryProgress, 42);
});
