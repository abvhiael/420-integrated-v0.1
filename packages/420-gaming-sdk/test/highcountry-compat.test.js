import test from "node:test";
import assert from "node:assert/strict";
import {
  FeatureClass,
  evaluateFeatureAccess,
  shouldPromptDuringRoutinePlay
} from "../../../clients/highcountry-access-v1/src/access-state.js";

test("High Country still keeps routine play wallet-free through shared SDK", () => {
  const decision = evaluateFeatureAccess({ feature: FeatureClass.CORE_GAMEPLAY });
  assert.equal(decision.allowed, true);
  assert.equal(decision.prompt, "none");
  assert.equal(decision.reason, "core-gameplay-remains-wallet-free");
  assert.equal(shouldPromptDuringRoutinePlay(decision), false);
});

test("High Country optional content preserves contextual wallet prompts", () => {
  let decision = evaluateFeatureAccess({ feature: FeatureClass.OPTIONAL_CONTENT });
  assert.equal(decision.prompt, "link-wallet");

  decision = evaluateFeatureAccess({ feature: FeatureClass.OPTIONAL_CONTENT, walletLinked: true });
  assert.equal(decision.prompt, "connect-wallet");

  decision = evaluateFeatureAccess({
    feature: FeatureClass.OPTIONAL_CONTENT,
    walletLinked: true,
    walletConnected: true
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.prompt, "none");
});
