import test from "node:test";
import assert from "node:assert/strict";

import {
  PromptKind,
  createGamingClient420
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
import {
  evaluateFinalityState420,
  FinalityDecision420
} from "../../../services/420-gaming-query/src/finality-state.js";

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

const finalityBase = Object.freeze({
  expectedChainId: 420,
  rpcChainId: 420,
  txStatus: "success",
  receiptBlockNumber: 500,
  receiptBlockHash: "0x500",
  canonicalBlockHash: "0x500",
  canonicalHeadNumber: 503,
  finalizedHeadNumber: 503,
  indexerHeadNumber: 503,
  confirmationsRequired: 3
});

for (const game of games) {
  test(`${game.name}: deliberate progressive access survives adversarial E2E states`, async () => {
    const guestCore = game.evaluate({
      feature: game.coreFeature,
      registered: false,
      walletLinked: false,
      walletConnected: false
    });
    assert.equal(guestCore.allowed, true);
    assert.equal(guestCore.prompt, PromptKind.NONE);

    const registeredCore = game.evaluate({
      feature: game.coreFeature,
      registered: true,
      walletLinked: false,
      walletConnected: false
    });
    assert.equal(registeredCore.allowed, true);

    const unlinkedWalletFeature = game.evaluate({
      feature: game.walletFeature,
      registered: true,
      walletLinked: false,
      walletConnected: false
    });
    assert.equal(unlinkedWalletFeature.allowed, false);
    assert.equal(unlinkedWalletFeature.optional, true);
    assert.equal(unlinkedWalletFeature.prompt, PromptKind.LINK_WALLET);

    const disconnectedWalletFeature = game.evaluate({
      feature: game.walletFeature,
      registered: true,
      walletLinked: true,
      walletConnected: false
    });
    assert.equal(disconnectedWalletFeature.allowed, false);
    assert.equal(disconnectedWalletFeature.optional, true);
    assert.equal(disconnectedWalletFeature.prompt, PromptKind.CONNECT_WALLET);

    const poisoned = game.createClient({
      getEntitlement: async () => ({
        gameId: "420/GAMING/GAME/HOSTILE_OTHER_GAME/V1",
        entitlementId: "foreign-entitlement",
        active: true
      })
    });
    assert.equal(
      await poisoned.getEntitlement({ profileId: "profile:1", entitlementId: "foreign-entitlement" }),
      null
    );

    assert.equal("walletHistory" in poisoned, false);
    assert.equal("allEntitlementsForWallet" in poisoned, false);
    assert.equal("allClaimsForWallet" in poisoned, false);

    const reorged = evaluateFinalityState420({ ...finalityBase, canonicalBlockHash: "0xdead" });
    assert.equal(reorged.canonical, false);
    assert.equal(reorged.state, FinalityDecision420.REORGED);

    const pending = evaluateFinalityState420({ ...finalityBase, finalizedHeadNumber: 500 });
    assert.equal(pending.canonical, false);
    assert.equal(pending.state, FinalityDecision420.PENDING);

    const finalized = evaluateFinalityState420(finalityBase);
    assert.equal(finalized.canonical, true);
    assert.equal(finalized.state, FinalityDecision420.FINALIZED);
  });
}

test("GP-16.6 keeps every canonical game namespace distinct", () => {
  const ids = games.map((game) => game.gameId);
  assert.equal(new Set(ids).size, games.length);
  assert.ok(ids.every((id) => id.startsWith("420/GAMING/GAME/")));
});
