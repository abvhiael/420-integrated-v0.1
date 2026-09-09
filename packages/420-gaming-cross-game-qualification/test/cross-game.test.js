import test from "node:test";
import assert from "node:assert/strict";

import {
  FeatureClass,
  evaluateFeatureAccess
} from "../../../clients/highcountry-access-v1/src/access-state.js";
import {
  GREEN_ROAD_GAME_ID,
  GreenRoadFeature,
  evaluateGreenRoadAccess,
  createGreenRoadGamingClient
} from "../../../clients/greenroad-access-v1/src/access.js";
import {
  BUDTENDER_GAME_ID,
  BudtenderFeature,
  evaluateBudtenderAccess,
  createBudtenderGamingClient
} from "../../../clients/budtender-access-v1/src/access.js";
import {
  SMOKE_CHROME_GAME_ID,
  SmokeChromeFeature,
  evaluateSmokeChromeAccess,
  createSmokeChromeGamingClient
} from "../../../clients/smoke-chrome-access-v1/src/access.js";

const guest = { registered: false, walletLinked: false, walletConnected: false };
const registered = { registered: true, walletLinked: false, walletConnected: false };
const linked = { registered: true, walletLinked: true, walletConnected: true };

test("all reference games preserve wallet-free core gameplay", () => {
  assert.equal(evaluateFeatureAccess({ feature: FeatureClass.CORE_GAMEPLAY, ...guest }).allowed, true);
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.CORE_ROAD_TRIP, ...guest }).allowed, true);
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.CORE_MANAGEMENT, ...guest }).allowed, true);
  assert.equal(evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CORE_MATCH, ...guest }).allowed, true);
  assert.equal(evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.DECK_BUILDING, ...guest }).allowed, true);
});

test("cloud-save boundary requires registration but not wallet linkage", () => {
  assert.equal(evaluateFeatureAccess({ feature: FeatureClass.CLOUD_SAVE, ...guest }).allowed, false);
  assert.equal(evaluateFeatureAccess({ feature: FeatureClass.CLOUD_SAVE, ...registered }).allowed, true);
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.CLOUD_SAVE, ...registered }).allowed, true);
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.CLOUD_SAVE, ...registered }).allowed, true);
  assert.equal(evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CLOUD_SAVE, ...registered }).allowed, true);
});

test("cross-game and ownership features require deliberate wallet boundary", () => {
  assert.equal(evaluateFeatureAccess({ feature: FeatureClass.CROSS_GAME, ...registered }).allowed, false);
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.CROSS_GAME_ARTIFACT, ...registered }).allowed, false);
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.CROSS_GAME_ITEM, ...registered }).allowed, false);
  assert.equal(evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CROSS_GAME_PRESTIGE, ...registered }).allowed, false);

  assert.equal(evaluateFeatureAccess({ feature: FeatureClass.CROSS_GAME, ...linked }).allowed, true);
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.CROSS_GAME_ARTIFACT, ...linked }).allowed, true);
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.CROSS_GAME_ITEM, ...linked }).allowed, true);
  assert.equal(evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CROSS_GAME_PRESTIGE, ...linked }).allowed, true);
});

test("reference game namespaces remain distinct", () => {
  assert.equal(new Set([GREEN_ROAD_GAME_ID, BUDTENDER_GAME_ID, SMOKE_CHROME_GAME_ID]).size, 3);
});

test("shared clients inject only their own game scope", async () => {
  const seen = [];
  const adapters = {
    getProfile: async (input) => { seen.push(input.gameId); return input; }
  };

  await createGreenRoadGamingClient(adapters).getProfile({ account: "0x1" });
  await createBudtenderGamingClient(adapters).getProfile({ account: "0x1" });
  await createSmokeChromeGamingClient(adapters).getProfile({ account: "0x1" });

  assert.deepEqual(seen, [GREEN_ROAD_GAME_ID, BUDTENDER_GAME_ID, SMOKE_CHROME_GAME_ID]);
});
