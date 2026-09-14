import test from "node:test";
import assert from "node:assert/strict";

import {
  AccessRequirement,
  PromptKind,
  createGamingClient420,
  evaluateAccessRequirement
} from "../../420-gaming-sdk/src/index.js";
import {
  FeatureClass,
  evaluateFeatureAccess as evaluateHighCountryAccess
} from "../../../clients/highcountry-access-v1/src/access-state.js";
import {
  GREEN_ROAD_GAME_ID,
  GreenRoadFeature,
  createGreenRoadGamingClient,
  evaluateGreenRoadAccess
} from "../../../clients/greenroad-access-v1/src/access.js";
import {
  BUDTENDER_GAME_ID,
  BudtenderFeature,
  createBudtenderGamingClient,
  evaluateBudtenderAccess
} from "../../../clients/budtender-access-v1/src/access.js";
import {
  SMOKE_CHROME_GAME_ID,
  SmokeChromeFeature,
  createSmokeChromeGamingClient,
  evaluateSmokeChromeAccess
} from "../../../clients/smoke-chrome-access-v1/src/access.js";

const HIGH_COUNTRY_GAME_ID = "420/GAMING/GAME/HIGH_COUNTRY/V1";

const games = [
  {
    name: "High Country",
    gameId: HIGH_COUNTRY_GAME_ID,
    evaluate: evaluateHighCountryAccess,
    coreFeature: FeatureClass.CORE_GAMEPLAY,
    walletFeature: FeatureClass.OPTIONAL_CONTENT,
    createClient: (adapters) => createGamingClient420({ gameId: HIGH_COUNTRY_GAME_ID, adapters })
  },
  {
    name: "The Green Road",
    gameId: GREEN_ROAD_GAME_ID,
    evaluate: evaluateGreenRoadAccess,
    coreFeature: GreenRoadFeature.CORE_ROAD_TRIP,
    walletFeature: GreenRoadFeature.SECRET_ROUTE,
    createClient: createGreenRoadGamingClient
  },
  {
    name: "Budtender",
    gameId: BUDTENDER_GAME_ID,
    evaluate: evaluateBudtenderAccess,
    coreFeature: BudtenderFeature.CORE_MANAGEMENT,
    walletFeature: BudtenderFeature.PREMIUM_DECOR,
    createClient: createBudtenderGamingClient
  },
  {
    name: "Smoke & Chrome",
    gameId: SMOKE_CHROME_GAME_ID,
    evaluate: evaluateSmokeChromeAccess,
    coreFeature: SmokeChromeFeature.CORE_MATCH,
    walletFeature: SmokeChromeFeature.OWNED_EDITION,
    createClient: createSmokeChromeGamingClient
  }
];

for (const game of games) {
  test(`${game.name}: core gameplay remains available to a guest with no wallet`, () => {
    const decision = game.evaluate({
      feature: game.coreFeature,
      registered: false,
      walletLinked: false,
      walletConnected: false
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.prompt, PromptKind.NONE);
  });

  test(`${game.name}: disconnected wallet denies optional wallet feature without blocking core`, () => {
    const walletDecision = game.evaluate({
      feature: game.walletFeature,
      registered: true,
      walletLinked: true,
      walletConnected: false
    });
    assert.equal(walletDecision.allowed, false);
    assert.equal(walletDecision.prompt, PromptKind.CONNECT_WALLET);
    assert.equal(walletDecision.optional, true);

    const coreDecision = game.evaluate({
      feature: game.coreFeature,
      registered: true,
      walletLinked: true,
      walletConnected: false
    });
    assert.equal(coreDecision.allowed, true);
  });

  test(`${game.name}: revoked or unlinked wallet denies optional feature safely`, () => {
    const decision = game.evaluate({
      feature: game.walletFeature,
      registered: true,
      walletLinked: false,
      walletConnected: false
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.prompt, PromptKind.LINK_WALLET);
    assert.equal(decision.optional, true);
  });

  test(`${game.name}: unknown feature fails closed`, () => {
    assert.throws(
      () => game.evaluate({ feature: "hostile-unknown-feature", registered: true, walletLinked: true, walletConnected: true }),
      TypeError
    );
  });

  test(`${game.name}: SDK calls are pinned to the canonical game namespace`, async () => {
    const calls = [];
    const adapters = {
      getProfile: async (input) => { calls.push(input); return null; },
      getEntitlement: async (input) => { calls.push(input); return null; }
    };
    const client = game.createClient(adapters);

    await client.getProfile("0xabc");
    await client.getEntitlement({ profileId: "profile:1", entitlementId: "entitlement:1" });

    assert.equal(client.gameId, game.gameId);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.gameId === game.gameId));
  });

  test(`${game.name}: expired or revoked entitlement result is not converted into access`, async () => {
    const client = game.createClient({
      getEntitlement: async () => null
    });
    const entitlement = await client.getEntitlement({
      profileId: "profile:1",
      entitlementId: "expired-or-revoked"
    });
    assert.equal(entitlement, null);
  });

  test(`${game.name}: cross-game poisoned adapter result fails closed`, async () => {
    const client = game.createClient({
      getEntitlement: async () => ({
        gameId: "420/GAMING/GAME/HOSTILE_OTHER_GAME/V1",
        entitlementId: "poison",
        active: true
      })
    });
    const entitlement = await client.getEntitlement({
      profileId: "profile:1",
      entitlementId: "poison"
    });
    assert.equal(entitlement, null);
  });

  test(`${game.name}: hostile adapter/RPC error propagates without unlocking optional feature`, async () => {
    const client = game.createClient({
      getEntitlement: async () => { throw new Error("rpc unavailable"); }
    });
    await assert.rejects(
      () => client.getEntitlement({ profileId: "profile:1", entitlementId: "e1" }),
      /rpc unavailable/
    );
    const decision = game.evaluate({
      feature: game.walletFeature,
      registered: true,
      walletLinked: false,
      walletConnected: false
    });
    assert.equal(decision.allowed, false);
  });
}

test("shared SDK rejects unknown access requirement instead of guessing", () => {
  assert.throws(
    () => evaluateAccessRequirement({ requirement: "hostile-unknown-requirement" }),
    TypeError
  );
});

test("wallet requirement does not become core progression when wallet is unavailable", () => {
  const decision = evaluateAccessRequirement({
    requirement: AccessRequirement.WALLET,
    registered: true,
    walletLinked: false,
    walletConnected: false
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.optional, true);
});
