import test from "node:test";
import assert from "node:assert/strict";
import {
  FeatureClass,
  PlayerAccessState,
  PromptKind,
  derivePlayerAccessState,
  evaluateFeatureAccess,
  shouldPromptDuringRoutinePlay
} from "../src/access-state.js";

test("guest can play core gameplay with no wallet prompt", () => {
  const decision = evaluateFeatureAccess({ feature: FeatureClass.CORE_GAMEPLAY });
  assert.equal(decision.allowed, true);
  assert.equal(decision.state, PlayerAccessState.GUEST);
  assert.equal(decision.prompt, PromptKind.NONE);
  assert.equal(shouldPromptDuringRoutinePlay(decision), false);
});

test("registration upgrades cloud save without requiring a wallet", () => {
  const guest = evaluateFeatureAccess({ feature: FeatureClass.CLOUD_SAVE });
  assert.equal(guest.allowed, false);
  assert.equal(guest.prompt, PromptKind.REGISTER);

  const registered = evaluateFeatureAccess({ feature: FeatureClass.CLOUD_SAVE, registered: true });
  assert.equal(registered.allowed, true);
  assert.equal(registered.state, PlayerAccessState.REGISTERED);
  assert.equal(registered.prompt, PromptKind.NONE);
});

test("wallet-only content prompts only when that optional feature is requested", () => {
  const decision = evaluateFeatureAccess({
    feature: FeatureClass.OPTIONAL_CONTENT,
    registered: true
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.prompt, PromptKind.LINK_WALLET);
  assert.equal(decision.optional, true);
  assert.equal(shouldPromptDuringRoutinePlay(decision), false);
});

test("linked but disconnected wallet asks for reconnect at feature boundary", () => {
  const decision = evaluateFeatureAccess({
    feature: FeatureClass.CROSS_GAME,
    registered: true,
    walletLinked: true,
    walletConnected: false
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.state, PlayerAccessState.WALLET_LINKED);
  assert.equal(decision.prompt, PromptKind.CONNECT_WALLET);
});

test("connected wallet unlocks optional web3 feature without altering base state progression", () => {
  const decision = evaluateFeatureAccess({
    feature: FeatureClass.REWARD,
    registered: true,
    walletLinked: true,
    walletConnected: true
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.prompt, PromptKind.NONE);
  assert.equal(derivePlayerAccessState({ registered: false, walletLinked: true }), PlayerAccessState.WALLET_LINKED);
});

test("unknown feature classes fail closed", () => {
  assert.throws(
    () => evaluateFeatureAccess({ feature: "pay-to-win-boost" }),
    /Unsupported High Country feature class/
  );
});
